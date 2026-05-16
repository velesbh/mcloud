import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { dispatchFileOp } from "@/lib/server/file-ops-bridge";

/**
 * Upload bridge:
 *   1. Receive multipart file from browser
 *   2. Ensure the storage bucket exists (auto-create on first use)
 *   3. Upload to server-files/{id}/inbox/{filename}
 *   4. Tell the daemon to fetch + write into the server's filesystem
 *   5. Delete the inbox file immediately after the daemon confirms receipt
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
  if (server.clerk_user_id !== userId)
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

  // Ensure bucket exists — create it if this is the first upload ever.
  // `createBucket` is idempotent-ish: we ignore "already exists" errors.
  const { error: bucketErr } = await admin.storage.createBucket("server-files", {
    public: false,
    fileSizeLimit: 256 * 1024 * 1024, // 256 MB max per file
  });
  if (bucketErr && !bucketErr.message.toLowerCase().includes("already exist")) {
    return NextResponse.json({ error: `storage: ${bucketErr.message}` }, { status: 500 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage
    .from("server-files")
    .upload(storageKey, buf, { contentType: file.type || "application/octet-stream", upsert: true });
  if (uploadError)
    return NextResponse.json({ error: `storage: ${uploadError.message}` }, { status: 500 });

  // Tell the daemon to pull the file from storage and write it to disk.
  const result = await dispatchFileOp(server.node_id, id, "import", {
    storageKey,
    targetPath,
  }, 120_000);

  // Always clean up the inbox file — whether or not the daemon succeeded.
  // The bucket is purely a transit staging area; we don't want leftover blobs.
  await admin.storage.from("server-files").remove([storageKey]).catch(() => {/* best-effort */});

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ ok: true, path: targetPath, size: buf.length });
}

// Allow larger uploads (Vercel's max is 4.5 MB on Hobby, higher on Pro)
export const runtime = "nodejs";
export const maxDuration = 60;
