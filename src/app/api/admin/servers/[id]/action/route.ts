import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/clerk/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { ServerStatus } from "@/lib/supabase/types";

type AdminAction = "start" | "stop" | "restart" | "kill";

/**
 * Admin-only server lifecycle actions.
 * Unlike the user-facing route, this bypasses ownership checks and adds "kill"
 * (SIGKILL — immediate process termination, no graceful shutdown).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { action } = (await req.json()) as { action: AdminAction };
  if (!["start", "stop", "restart", "kill"].includes(action)) {
    return NextResponse.json({ error: "invalidAction" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const { data: server } = await admin
    .from("servers")
    .select("id, name, status, node_id")
    .eq("id", id)
    .single();

  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!server.node_id) {
    return NextResponse.json({ error: "noNode", message: "Server has no node assigned." }, { status: 409 });
  }

  // Optimistic DB state
  const optimistic: Record<AdminAction, ServerStatus> = {
    start:   "starting",
    stop:    "stopping",
    restart: "restarting",
    kill:    "offline",
  };
  await admin.from("servers").update({ status: optimistic[action] }).eq("id", id);

  // Broadcast to daemon
  const daemonEvent = action === "kill" ? "kill" : action;
  const channel = admin.channel(`node:${server.node_id}`);
  await new Promise<void>((resolve) => {
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.send({
          type: "broadcast",
          event: daemonEvent,
          payload: { serverId: id },
        });
        resolve();
      }
    });
    setTimeout(resolve, 1500);
  });
  void admin.removeChannel(channel);

  return NextResponse.json({ ok: true, action, status: optimistic[action] });
}
