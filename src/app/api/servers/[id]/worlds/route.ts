import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { dispatchWorldOp } from "@/lib/server/file-ops-bridge";

async function getServer(userId: string, id: string) {
  const admin = createAdminSupabaseClient();
  const { data: server } = await admin
    .from("servers")
    .select("id, node_id, clerk_user_id")
    .eq("id", id)
    .single();
  if (!server) return { error: "Not found", status: 404 as const };
  if (server.clerk_user_id !== userId) return { error: "Forbidden", status: 403 as const };
  if (!server.node_id) return { error: "No node assigned", status: 409 as const };
  return { server };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const r = await getServer(userId, id);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const result = await dispatchWorldOp(r.server.node_id!, id, "list", {});
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json(result.data);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const r = await getServer(userId, id);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

  const { op, ...args } = await req.json();
  if (!op) return NextResponse.json({ error: "Missing op" }, { status: 400 });

  const result = await dispatchWorldOp(r.server.node_id!, id, op, args, 120_000);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json(result.data);
}
