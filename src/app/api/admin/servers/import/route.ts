import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/clerk/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isS3Configured, s3Upload, s3SignedDownloadUrl } from "@/lib/storage/s3";
import { dispatchFileOp } from "@/lib/server/file-ops-bridge";
import { randomUUID } from "node:crypto";

/**
 * POST /api/admin/servers/import
 * Multipart form fields:
 *   file                (File)   — ZIP archive of the server data
 *   node_id             (string) — target node UUID
 *   name                (string) — display name for the new server
 *   ram_mb              (number)
 *   disk_mb             (number)
 *   cpu_percent         (number)
 *   owner_clerk_user_id (string) — Clerk user ID the server belongs to
 *
 * Flow:
 *  1. Upload ZIP to S3 (preferred) or Supabase Storage at imports/{uuid}.zip
 *  2. Create server DB record with status "installing"
 *  3. Dispatch "import-zip" file-op to the daemon with the download URL
 *     NOTE: The daemon must handle the "import-zip" op — download the ZIP from
 *     the provided URL and extract it into the server's working directory.
 *  4. On daemon success → set server status to "offline"
 *     On daemon error / timeout → set server status to "error"
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // ── Parse multipart form ────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form data" }, { status: 400 });
  }

  const file = formData.get("file");
  const nodeId = formData.get("node_id") as string | null;
  const name = formData.get("name") as string | null;
  const ramMb = Number(formData.get("ram_mb") ?? 0);
  const diskMb = Number(formData.get("disk_mb") ?? 0);
  const cpuPercent = Number(formData.get("cpu_percent") ?? 0);
  const ownerClerkUserId = formData.get("owner_clerk_user_id") as string | null;

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }
  if (!nodeId || !name || !ownerClerkUserId) {
    return NextResponse.json({ error: "Missing required fields: node_id, name, owner_clerk_user_id" }, { status: 400 });
  }
  if (ramMb <= 0 || diskMb <= 0 || cpuPercent <= 0) {
    return NextResponse.json({ error: "ram_mb, disk_mb and cpu_percent must be positive numbers" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();

  // ── Verify node exists ─────────────────────────────────────────────
  const { data: node } = await admin
    .from("nodes")
    .select("id, name")
    .eq("id", nodeId)
    .single();
  if (!node) return NextResponse.json({ error: "Node not found" }, { status: 404 });

  // ── Resolve or create profile for owner ───────────────────────────
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", ownerClerkUserId)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json(
      { error: "Owner profile not found. The user must have logged in at least once." },
      { status: 404 }
    );
  }

  // ── Upload ZIP ─────────────────────────────────────────────────────
  const importId = randomUUID();
  const storageKey = `imports/${importId}.zip`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  let downloadUrl: string;

  if (isS3Configured()) {
    await s3Upload(storageKey, fileBuffer, "application/zip");
    // Generate a presigned URL valid for 1 hour (the daemon needs time to download)
    downloadUrl = await s3SignedDownloadUrl(storageKey, 3600);
  } else {
    // Fall back to Supabase Storage
    const { error: uploadErr } = await admin.storage
      .from("imports")
      .upload(`${importId}.zip`, fileBuffer, { contentType: "application/zip", upsert: false });
    if (uploadErr) {
      return NextResponse.json({ error: `Storage upload failed: ${uploadErr.message}` }, { status: 500 });
    }
    const { data: urlData } = admin.storage.from("imports").getPublicUrl(`${importId}.zip`);
    downloadUrl = urlData.publicUrl;
  }

  // ── Pick a free allocation on the target node ──────────────────────
  const { data: allocation } = await admin
    .from("allocations")
    .select("id, ip, local_ip, port")
    .eq("node_id", nodeId)
    .is("server_id", null)
    .order("port", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!allocation) {
    return NextResponse.json(
      { error: "noAllocations", message: "No free allocations on this node. Add allocations in the admin panel." },
      { status: 503 }
    );
  }

  // ── Create server record ───────────────────────────────────────────
  const { data: server, error: insertErr } = await admin
    .from("servers")
    .insert({
      user_id: profile.id,
      clerk_user_id: ownerClerkUserId,
      name,
      edition: "java",
      game_version: "imported",
      loader: "vanilla",
      ram_mb: ramMb,
      cpu_percent: cpuPercent,
      disk_mb: diskMb,
      node_id: nodeId,
      allocation_id: allocation.id,
      status: "installing",
      last_active_at: new Date().toISOString(),
    } as never)
    .select()
    .single();

  if (insertErr || !server) {
    return NextResponse.json({ error: insertErr?.message ?? "Failed to create server record" }, { status: 500 });
  }

  // Mark allocation as taken
  await admin
    .from("allocations")
    .update({ server_id: server.id, assigned_at: new Date().toISOString() })
    .eq("id", allocation.id);

  // Insert console welcome event
  await admin.from("console_events").insert({
    server_id: server.id,
    line: `[MCloud] Importing server "${name}" from ZIP. Please wait…`,
    source: "system",
  });

  // ── Dispatch import-zip op to daemon ──────────────────────────────
  // NOTE: The daemon must handle the "import-zip" op. It should:
  //  1. Download the ZIP from `zipUrl`
  //  2. Extract it to the server's working directory (targetPath "/")
  //  3. Reply with an "import-result" broadcast containing { opId, ok: true }
  //     or an "error" broadcast on failure.
  const opResult = await dispatchFileOp(
    nodeId,
    server.id,
    "import-zip",
    { zipUrl: downloadUrl, targetPath: "/", storageKey },
    // Allow up to 5 minutes for large ZIPs
    300_000
  );

  if (opResult.ok) {
    await admin.from("servers").update({ status: "offline" }).eq("id", server.id);
    await admin.from("console_events").insert({
      server_id: server.id,
      line: `[MCloud] Import complete. Server is ready to start.`,
      source: "system",
    });
    return NextResponse.json({ ok: true, server }, { status: 201 });
  } else {
    await admin.from("servers").update({ status: "error" }).eq("id", server.id);
    await admin.from("console_events").insert({
      server_id: server.id,
      line: `[MCloud] Import failed: ${opResult.error}`,
      source: "system",
    });
    return NextResponse.json(
      { error: "importFailed", message: opResult.error, server },
      { status: 500 }
    );
  }
}
