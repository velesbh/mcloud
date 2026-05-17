import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/clerk/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isS3Configured, s3Upload, s3SignedDownloadUrl } from "@/lib/storage/s3";
import { dispatchFileOp } from "@/lib/server/file-ops-bridge";
import { randomUUID } from "node:crypto";

/**
 * POST /api/admin/servers/import
 * Accepts multipart/form-data with these fields:
 *
 *   source_type          "zip" (default) | "dir"
 *   node_id              target node UUID
 *   name                 display name for the new server
 *   ram_mb / disk_mb / cpu_percent
 *   owner_clerk_user_id  Clerk user ID the server belongs to
 *
 *   --- source_type=zip ---
 *   file                 ZIP archive of the server data
 *
 *   --- source_type=dir ---
 *   source_path          Absolute path on the node, e.g. /opt/servers/my-server
 *
 * Flow (zip):  upload ZIP → S3/Supabase → dispatch "import-zip" to daemon
 * Flow (dir):  no upload → dispatch "import-dir" to daemon with srcAbsPath
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

  const sourceType = (formData.get("source_type") as string | null) ?? "zip";
  const file = formData.get("file");
  const sourcePath = formData.get("source_path") as string | null;
  const nodeId = formData.get("node_id") as string | null;
  const name = formData.get("name") as string | null;
  const ramMb = Number(formData.get("ram_mb") ?? 0);
  const diskMb = Number(formData.get("disk_mb") ?? 0);
  const cpuPercent = Number(formData.get("cpu_percent") ?? 0);
  const ownerClerkUserId = formData.get("owner_clerk_user_id") as string | null;

  if (sourceType === "zip" && (!file || !(file instanceof File))) {
    return NextResponse.json({ error: "Missing file field for ZIP import" }, { status: 400 });
  }
  if (sourceType === "dir" && !sourcePath?.trim()) {
    return NextResponse.json({ error: "Missing source_path for directory import" }, { status: 400 });
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
  let { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", ownerClerkUserId)
    .maybeSingle();

  if (!profile) {
    // Auto-create a minimal profile so admins can import for any Clerk user ID
    // even if that user has never signed in yet. The webhook will update it on first login.
    const { data: created, error: createErr } = await admin
      .from("profiles")
      .insert({
        clerk_user_id: ownerClerkUserId,
        email: `${ownerClerkUserId}@imported.local`,
        display_name: null,
        role: "user",
      } as never)
      .select("id")
      .single();
    if (createErr || !created) {
      return NextResponse.json(
        { error: `Failed to create owner profile: ${createErr?.message ?? "unknown"}` },
        { status: 500 }
      );
    }
    profile = created;
  }

  // ── Upload ZIP (zip mode only) ──────────────────────────────────────
  let downloadUrl: string | null = null;
  let storageKey: string | null = null;

  if (sourceType === "zip") {
    const importId = randomUUID();
    storageKey = `imports/${importId}.zip`;
    const fileBuffer = Buffer.from(await (file as File).arrayBuffer());

    if (isS3Configured()) {
      await s3Upload(storageKey, fileBuffer, "application/zip");
      downloadUrl = await s3SignedDownloadUrl(storageKey, 3600);
    } else {
      const { error: uploadErr } = await admin.storage
        .from("imports")
        .upload(`${importId}.zip`, fileBuffer, { contentType: "application/zip", upsert: false });
      if (uploadErr) {
        return NextResponse.json({ error: `Storage upload failed: ${uploadErr.message}` }, { status: 500 });
      }
      const { data: urlData } = admin.storage.from("imports").getPublicUrl(`${importId}.zip`);
      downloadUrl = urlData.publicUrl;
    }
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
    line: sourceType === "dir"
      ? `[MCloud] Importing server "${name}" from directory ${sourcePath}. Please wait…`
      : `[MCloud] Importing server "${name}" from ZIP. Please wait…`,
    source: "system",
  });

  // ── Dispatch op to daemon ─────────────────────────────────────────
  const opResult = await dispatchFileOp(
    nodeId,
    server.id,
    sourceType === "dir" ? "import-dir" : "import-zip",
    sourceType === "dir"
      ? { srcAbsPath: sourcePath!.trim(), targetPath: "/" }
      : { zipUrl: downloadUrl, targetPath: "/", storageKey },
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
