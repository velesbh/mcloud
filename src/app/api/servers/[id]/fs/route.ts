import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { dispatchFileOp } from "@/lib/server/file-ops-bridge";
import { isS3Configured } from "@/lib/storage/s3";

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

  // For export ops: inject the main app's S3 config so the daemon can use it
  // directly without needing its own S3 env vars.
  let dispatchArgs = args;
  if (op === "export" && isS3Configured()) {
    const rawRegion = process.env.S3_REGION ?? "";
    dispatchArgs = {
      ...args,
      s3Config: {
        endpoint: process.env.S3_ENDPOINT,
        region: /^[a-zA-Z0-9-]+$/.test(rawRegion) ? rawRegion : "auto",
        bucket: process.env.S3_BUCKET ?? "mcloud-files",
        accessKey: process.env.S3_ACCESS_KEY,
        secretKey: process.env.S3_SECRET_KEY,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      },
    };
  }

  const result = await dispatchFileOp(server.node_id!, id, op, dispatchArgs, 60_000);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json(result.data);
}
