import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { dispatchFileOp } from "@/lib/server/file-ops-bridge";
import { isS3Configured, s3SignedUploadUrl, s3SignedDownloadUrl } from "@/lib/storage/s3";

/**
 * Unified file manager endpoint. Body shape:
 *   { op: "list" | "read" | "write" | "mkdir" | "delete" | "rename"
 *      | "import-url" | "export" | "zip" | "unzip", ...args }
 *
 * For `import` (file upload), use POST /api/servers/[id]/fs/upload instead —
 * that endpoint accepts the multipart body and stages it to Supabase Storage
 * before calling the daemon.
 *
 * For `export`, if the main app has S3 configured we inject the S3 credentials
 * into the dispatch args so the daemon uses the same bucket — no separate S3
 * config needed on the daemon server.
 */

async function getServerOrThrow(userId: string, id: string) {
  const admin = createAdminSupabaseClient();
  const { data: server } = await admin
    .from("servers")
    .select("id, node_id, clerk_user_id")
    .eq("id", id)
    .single();
  if (!server) return { error: "Not found", status: 404 as const };
  if (server.clerk_user_id !== userId) return { error: "Forbidden", status: 403 as const };
  if (!server.node_id) return { error: "Server has no node assigned", status: 409 as const };
  return { server };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ownership = await getServerOrThrow(userId, id);
  if ("error" in ownership) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status });
  }
  const { server } = ownership;

  const body = await req.json();
  const { op, ...args } = body;

  if (!op) return NextResponse.json({ error: "Missing op" }, { status: 400 });

  // ── Export: handle entirely in the main app to avoid daemon storage issues ──
  // Tell daemon to read the raw bytes, then we stream them straight to the
  // client — no S3/Supabase needed for the download path.
  if (op === "export") {
    const filePath = args.path as string;

    // Ask daemon to read the file content (binary-safe via base64)
    const readResult = await dispatchFileOp(server.node_id!, id, "read-base64", { path: filePath }, 60_000);
    if (!readResult.ok) {
      return NextResponse.json({ error: readResult.error }, { status: 502 });
    }

    const base64 = readResult.data.content as string;
    const filename = (readResult.data.filename as string) || filePath.split("/").pop() || "download";
    const buf = Buffer.from(base64, "base64");

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buf.length),
      },
    });
  }

  // For all other ops: dispatch straight to daemon
  const result = await dispatchFileOp(server.node_id!, id, op, args, 60_000);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json(result.data);

}

// ── GET: generate a presigned S3 upload URL so the browser can upload
//         large files directly to S3, bypassing Vercel's 4.5 MB body limit ──
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ownership = await getServerOrThrow(userId, id);
  if ("error" in ownership) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status });
  }

  if (!isS3Configured()) {
    return NextResponse.json({ error: "S3 not configured — use the multipart upload endpoint instead" }, { status: 409 });
  }

  const filename = req.nextUrl.searchParams.get("filename") ?? "upload";
  const safe = filename.replace(/[^\w.\-]/g, "_");
  const storageKey = `${id}/inbox/${Date.now()}-${safe}`;

  const uploadUrl = await s3SignedUploadUrl(storageKey, 300);   // 5-min PUT URL
  const downloadUrl = await s3SignedDownloadUrl(storageKey, 600); // for daemon import

  return NextResponse.json({ uploadUrl, downloadUrl, storageKey, key: storageKey });

}
