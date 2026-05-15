import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { command } = await req.json();

  const supabase = await createServerSupabaseClient();
  const { data: server } = await supabase
    .from("servers")
    .select("id, status")
    .eq("id", id)
    .single();

  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const adminSupabase = createAdminSupabaseClient();

  // Insert user command
  await adminSupabase.from("console_events").insert({
    server_id: id,
    line: `> ${command}`,
    source: "user",
  });

  // Simulate server response for common commands
  let response: string | null = null;
  const cmd = command.trim().toLowerCase();
  if (cmd === "list") {
    response = "[Server thread/INFO]: There are 0 of a max of 20 players online:";
  } else if (cmd === "help") {
    response = "[Server thread/INFO]: --- Showing help page 1 of 1 (/help <page>) ---";
  } else if (cmd.startsWith("say ")) {
    response = `[Server thread/INFO]: [${userId.slice(0, 8)}] ${command.slice(4)}`;
  } else if (cmd === "stop") {
    await adminSupabase.from("servers").update({ status: "stopping" }).eq("id", id);
    response = "[Server thread/INFO]: Stopping server";
    await adminSupabase.from("servers").update({ status: "offline" }).eq("id", id);
  } else {
    response = `[Server thread/WARN]: Unknown command: ${command.split(" ")[0]}`;
  }

  if (response) {
    await adminSupabase.from("console_events").insert({
      server_id: id,
      line: response,
      source: "server",
    });
  }

  return NextResponse.json({ success: true });
}

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
