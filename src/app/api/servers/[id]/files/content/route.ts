import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { dispatchFileOp } from "@/lib/server/file-ops-bridge";

/**
 * GET  /api/servers/[id]/files/content?path=/server.properties → text
 * PUT  /api/servers/[id]/files/content?path=/server.properties (text body)
 *
 * Both proxy to the daemon's file-ops (read/write) — the node's filesystem
 * is the source of truth for server files (server.properties, mods/, etc.).
 */

async function getServer(userId: string, id: string) {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("servers")
    .select("id, clerk_user_id, node_id")
    .eq("id", id)
    .single();
  if (!data) return { error: "Not found", status: 404 as const };
  if (data.clerk_user_id !== userId) return { error: "Forbidden", status: 403 as const };
  if (!data.node_id) return { error: "No node assigned", status: 409 as const };
  return { server: data };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const path = req.nextUrl.searchParams.get("path");
  if (!path) return new NextResponse("Missing path", { status: 400 });

  const r = await getServer(userId, id);
  if ("error" in r) return new NextResponse(r.error, { status: r.status });

  const result = await dispatchFileOp(r.server.node_id!, id, "read", { path }, 30_000);
  if (!result.ok) {
    return new NextResponse(result.error, { status: 502 });
  }
  const content = (result.data.content as string | undefined) ?? "";
  return new NextResponse(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const path = req.nextUrl.searchParams.get("path");
  if (!path) return new NextResponse("Missing path", { status: 400 });

  const r = await getServer(userId, id);
  if ("error" in r) return new NextResponse(r.error, { status: r.status });

  const content = await req.text();
  const result = await dispatchFileOp(r.server.node_id!, id, "write", { path, content }, 30_000);
  if (!result.ok) return new NextResponse(result.error, { status: 502 });
  return new NextResponse("OK");
}
