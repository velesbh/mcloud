import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/clerk/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { dispatchFileOp } from "@/lib/server/file-ops-bridge";
import { isS3Configured, s3Upload, s3Delete, S3_BUCKET } from "@/lib/storage/s3";

/**
 * Upload bridge — two storage backends supported:
 *
 * S3-compatible (preferred — set S3_* env vars):
 *   1. Upload file to S3 at {serverId}/inbox/{filename}
 *   2. Tell daemon to import-url using a presigned S3 download URL
 *   3. Delete the S3 object after daemon confirms
 *
 * Supabase Storage (fallback when S3 not configured):
 *   1. Auto-create the server-files bucket if needed
 *   2. Upload to {serverId}/inbox/{filename}
 *   3. Tell daemon to import using storageKey
 *   4. Delete after daemon confirms
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = createAdminSupabaseClient();

  const { data: server } = await admin
    .from("servers")
    .select("id, node_id, clerk_user_id")
    .eq("id", id)
    .single();
  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (server.clerk_user_id !== userId && !(await isAdmin()))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!server.node_id)
    return NextResponse.json({ error: "Server has no node assigned" }, { status: 409 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const targetDir = (formData.get("targetDir") as string | null) ?? "/";
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const filename = file.name.replace(/[^\w.\-]/g, "_");
  const targetPath = targetDir.replace(/\/+$/, "") + "/" + filename;
  const storageKey = `${id}/inbox/${Date.now()}-${filename}`;
  const buf = Buffer.from(await file.arrayBuffer());

  if (isS3Configured()) {
    /* ── S3 path ── */
    try {
      await s3Upload(storageKey, buf, file.type || "application/octet-stream");
    } catch (e) {
      return NextResponse.json({ error: `s3: ${String(e)}` }, { status: 500 });
    }

    // Build a presigned download URL (5 min) so the daemon can pull via HTTP
    const { s3SignedDownloadUrl } = await import("@/lib/storage/s3");
    const downloadUrl = await s3SignedDownloadUrl(storageKey, 300);

    const result = await dispatchFileOp(server.node_id, id, "import-url", {
      url: downloadUrl,
      targetPath,
    }, 120_000);

    // Clean up the staging object regardless of result
    await s3Delete(storageKey);

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json({ ok: true, path: targetPath, size: buf.length, backend: "s3" });

  } else {
    /* ── Supabase Storage fallback ── */
    // Auto-create the bucket on first use (idempotent)
    const { error: bucketErr } = await admin.storage.createBucket("server-files", {
      public: false,
      fileSizeLimit: 256 * 1024 * 1024,
    });
    if (bucketErr && !bucketErr.message.toLowerCase().includes("already exist")) {
      return NextResponse.json({ error: `storage: ${bucketErr.message}` }, { status: 500 });
    }

    const { error: uploadError } = await admin.storage
      .from("server-files")
      .upload(storageKey, buf, { contentType: file.type || "application/octet-stream", upsert: true });
    if (uploadError)
      return NextResponse.json({ error: `storage: ${uploadError.message}` }, { status: 500 });

    const result = await dispatchFileOp(server.node_id, id, "import", {
      storageKey,
      targetPath,
    }, 120_000);

    // Always clean up — bucket is transit only
    await admin.storage.from("server-files").remove([storageKey]).catch(() => {/* best-effort */});

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json({ ok: true, path: targetPath, size: buf.length, backend: "supabase" });
  }
}

export const runtime = "nodejs";
export const maxDuration = 60;
