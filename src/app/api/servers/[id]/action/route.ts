import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Action = "start" | "stop" | "restart";

const BOOT_LOG_LINES = [
  "[Server thread/INFO]: Starting Minecraft server on *:25565",
  "[Server thread/INFO]: Loading properties",
  "[Server thread/INFO]: Default game type: SURVIVAL",
  "[Server thread/INFO]: Preparing level \"world\"",
  "[Server thread/INFO]: Preparing start region for dimension minecraft:overworld",
  "[Server thread/INFO]: Preparing spawn area: 0%",
  "[Server thread/INFO]: Preparing spawn area: 50%",
  "[Server thread/INFO]: Preparing spawn area: 100%",
  "[Server thread/INFO]: Done (2.847s)! For help, type \"help\"",
];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { action } = (await req.json()) as { action: Action };

  const supabase = await createServerSupabaseClient();

  // Verify ownership
  const { data: server } = await supabase
    .from("servers")
    .select("id, name, status")
    .eq("id", id)
    .single();

  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const adminSupabase = createAdminSupabaseClient();

  if (action === "start") {
    await adminSupabase.from("servers").update({ status: "starting" }).eq("id", id);

    // Simulate boot sequence with console events
    const now = Date.now();
    const events = BOOT_LOG_LINES.map((line, i) => ({
      server_id: id,
      line,
      source: "server" as const,
    }));

    await adminSupabase.from("console_events").insert(events);
    await adminSupabase
      .from("servers")
      .update({ status: "running", last_started_at: new Date().toISOString() })
      .eq("id", id);

    // Broadcast to realtime channel
    await adminSupabase.channel(`console:${id}`).send({
      type: "broadcast",
      event: "log",
      payload: { line: "[MCloud] Server is now online!", source: "system" },
    });
  } else if (action === "stop") {
    await adminSupabase.from("servers").update({ status: "stopping" }).eq("id", id);
    await adminSupabase.from("console_events").insert({
      server_id: id,
      line: "[Server thread/INFO]: Stopping server",
      source: "server",
    });
    await adminSupabase.from("servers").update({ status: "offline" }).eq("id", id);
  } else if (action === "restart") {
    await adminSupabase
      .from("servers")
      .update({ status: "restarting" })
      .eq("id", id);
    await adminSupabase.from("console_events").insert({
      server_id: id,
      line: "[MCloud] Server is restarting...",
      source: "system",
    });
    await adminSupabase
      .from("servers")
      .update({ status: "starting" })
      .eq("id", id);
    const events = BOOT_LOG_LINES.map((line) => ({
      server_id: id,
      line,
      source: "server" as const,
    }));
    await adminSupabase.from("console_events").insert(events);
    await adminSupabase
      .from("servers")
      .update({ status: "running", last_started_at: new Date().toISOString() })
      .eq("id", id);
  }

  const { data: updated } = await adminSupabase
    .from("servers")
    .select("status")
    .eq("id", id)
    .single();

  return NextResponse.json({ status: updated?.status });
}
