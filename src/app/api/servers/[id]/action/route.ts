import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/clerk/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { ServerStatus } from "@/lib/supabase/types";

type Action = "start" | "stop" | "restart" | "kill";

/**
 * Server lifecycle actions. We don't run servers in Next — we tell the daemon
 * via the `node:{node_id}` Realtime channel and let it handle the heavy lifting.
 * "kill" is also available to users to force-reset stuck states.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { action } = (await req.json()) as { action: Action };
  if (!["start", "stop", "restart", "kill"].includes(action)) {
    return NextResponse.json({ error: "invalidAction" }, { status: 400 });
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
  if (server.status === "hibernated" && action !== "kill") {
    return NextResponse.json(
      { error: "hibernated", message: "This server is hibernated. Reallocate it first." },
      { status: 409 }
    );
  }
  if (!server.node_id) {
    return NextResponse.json(
      { error: "noNode", message: "Server has no node assigned." },
      { status: 409 }
    );
  }

  // Optimistic state bump so the UI flips immediately
  const optimistic: Record<Action, ServerStatus> = {
    start: "starting",
    stop: "stopping",
    restart: "restarting",
    kill: "offline",
  };
  const newStatus: ServerStatus = optimistic[action];
  await admin.from("servers").update({ status: newStatus }).eq("id", id);

  // Tell the daemon (if kill, skip if server has no node — just DB reset)
  if (server.node_id) {
    const channel = admin.channel(`node:${server.node_id}`);
    await new Promise<void>((resolve) => {
      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.send({
            type: "broadcast",
            event: action,
            payload: { serverId: id },
          });
          resolve();
        }
      });
      setTimeout(resolve, 1500);
    });
    void admin.removeChannel(channel);
  }

  // Touch last_active_at — keeps the server out of the hibernation guillotine
  if (action !== "kill") {
    await admin
      .from("servers")
      .update({ last_active_at: new Date().toISOString() })
      .eq("id", id);
  }

  return NextResponse.json({ status: optimistic[action] });
}
