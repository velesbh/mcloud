import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/clerk/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * Send a console command. Relays to the daemon over `node:{node_id}`.
 * The daemon writes to the server process stdin and broadcasts output
 * back on `console:{server_id}`.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { command } = await req.json();
  if (!command || typeof command !== "string") {
    return NextResponse.json({ error: "missingCommand" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const { data: server } = await admin
    .from("servers")
    .select("id, clerk_user_id, status, node_id")
    .eq("id", id)
    .single();

  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (server.clerk_user_id !== userId && !(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!server.node_id) {
    return NextResponse.json({ error: "noNode" }, { status: 409 });
  }

  const channel = admin.channel(`node:${server.node_id}`);
  await new Promise<void>((resolve) => {
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.send({
          type: "broadcast",
          event: "command",
          payload: { serverId: id, cmd: command },
        });
        resolve();
      }
    });
    setTimeout(resolve, 1500);
  });
  void admin.removeChannel(channel);

  return NextResponse.json({ ok: true });
}

/** Last 100 console lines for replay on console mount. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("console_events")
    .select("*")
    .eq("server_id", id)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
