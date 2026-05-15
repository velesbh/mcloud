import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSchema } from "@/lib/validations/server";
import { getUserQuotas } from "@/lib/billing/quotas";
import type { Database } from "@/lib/supabase/types";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("servers")
    .select("*, allocations(ip, port), regions(name, flag_emoji)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress ?? "";

  const body = await req.json();
  const parsed = createServerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const adminSupabase = createAdminSupabaseClient();
  const quotas = await getUserQuotas();

  // Sync profile row with the current Clerk-billing-resolved quotas.
  await adminSupabase.from("profiles").upsert(
    {
      clerk_user_id: userId,
      email,
      max_servers: quotas.max_servers,
      max_ram_mb: quotas.max_ram_mb,
      max_disk_mb: quotas.max_disk_mb,
    } as Database["public"]["Tables"]["profiles"]["Insert"],
    { onConflict: "clerk_user_id" }
  );

  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .single();
  const profileId = profile?.id;

  if (!profileId) {
    return NextResponse.json({ error: "Profile not found" }, { status: 500 });
  }

  const { data: input } = parsed;

  if (input.ram_mb > quotas.max_ram_mb) {
    return NextResponse.json({ error: "ramExceedsPlan", quotas }, { status: 403 });
  }
  if (input.disk_mb > quotas.max_disk_mb) {
    return NextResponse.json({ error: "diskExceedsPlan", quotas }, { status: 403 });
  }
  if (input.cpu_percent > quotas.max_cpu_percent) {
    return NextResponse.json({ error: "cpuExceedsPlan", quotas }, { status: 403 });
  }

  const { data: server, error } = await adminSupabase
    .from("servers")
    .insert({
      user_id: profileId,
      clerk_user_id: userId,
      name: input.name,
      edition: input.edition,
      game_version: input.game_version,
      loader: input.loader,
      ram_mb: input.ram_mb,
      cpu_percent: input.cpu_percent,
      disk_mb: input.disk_mb,
      region_id: input.region_id ?? null,
      motd: input.motd ?? "A Minecraft Server",
      max_players: input.max_players ?? 20,
      status: "offline",
    })
    .select()
    .single();

  if (error) {
    if (error.message.includes("SERVER_LIMIT_REACHED")) {
      return NextResponse.json({ error: "serverLimit" }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Create default file structure
  await adminSupabase.from("server_files").insert([
    { server_id: server.id, path: "/", name: "root", is_directory: true },
    { server_id: server.id, path: "/world", name: "world", is_directory: true },
    { server_id: server.id, path: "/plugins", name: "plugins", is_directory: true },
    { server_id: server.id, path: "/mods", name: "mods", is_directory: true },
    { server_id: server.id, path: "/server.properties", name: "server.properties", is_directory: false, size_bytes: 512, mime_type: "text/plain" },
  ]);

  // Insert welcome console event
  await adminSupabase.from("console_events").insert({
    server_id: server.id,
    line: `[MCloud] Server "${server.name}" created. Press Start to launch.`,
    source: "system",
  });

  return NextResponse.json(server, { status: 201 });
}
