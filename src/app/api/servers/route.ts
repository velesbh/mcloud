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
    .select("*, allocations!servers_allocation_id_fkey(ip, port), regions!servers_region_id_fkey(name, flag_emoji)")
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
    } as Database["mcloud"]["Tables"]["profiles"]["Insert"],
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

  // ─── Premium allocation guard ─────────────────────────────────────
  // Read the global premium_allocation_percent setting. If the user is
  // on the free tier (plan_key === null) we must ensure we don't give
  // them resources that are reserved for premium users.
  const isPremium = quotas.plan_key !== null;

  let premiumReservePercent = 0;
  if (!isPremium) {
    const { data: settingRow } = await adminSupabase
      .from("admin_settings")
      .select("value")
      .eq("key", "premium_allocation_percent")
      .maybeSingle();
    premiumReservePercent = settingRow ? Number(settingRow.value) : 0;
  }

  // ─── Stock check ──────────────────────────────────────────────────
  // Ask the DB which node (if any) can fit this server, given current
  // allocations and the per-node `overallocation_percent` setting.
  // Cast through `unknown` — Supabase's deep generic inference chokes
  // when we type the rpc strictly. The SQL function is the contract.
  const { data: pickedNodeId, error: pickErr } = await (
    adminSupabase as unknown as { rpc: (fn: string, args: object) => Promise<{ data: string | null; error: { message: string } | null }> }
  ).rpc("pick_node_with_stock", {
    want_region: input.region_id ?? null,
    want_ram_mb: input.ram_mb,
    want_cpu: input.cpu_percent,
    want_disk_mb: input.disk_mb,
  });

  if (pickErr) {
    return NextResponse.json({ error: pickErr.message }, { status: 500 });
  }
  if (!pickedNodeId) {
    return NextResponse.json(
      { error: "outOfStock", message: "No node has enough free capacity right now. Try a different region or a smaller server." },
      { status: 503 }
    );
  }

  // ─── Premium reservation check (free users only) ──────────────────
  // After picking a node, verify the allocation would not eat into the
  // premium-reserved portion of that node's capacity.
  if (!isPremium && premiumReservePercent > 0) {
    const { data: node } = await adminSupabase
      .from("nodes")
      .select("total_ram_mb, total_cpu, total_disk_mb, overallocation_percent")
      .eq("id", pickedNodeId)
      .single();

    const { data: nodeServers } = await adminSupabase
      .from("servers")
      .select("ram_mb, cpu_percent, disk_mb")
      .eq("node_id", pickedNodeId);

    if (node) {
      const overPct = 1 + (node.overallocation_percent ?? 0) / 100;
      const capacityRam = Math.floor(node.total_ram_mb * overPct);
      const capacityCpu = Math.floor(node.total_cpu * overPct);
      const capacityDisk = Math.floor(node.total_disk_mb * overPct);

      const usedRam = (nodeServers ?? []).reduce((s, srv) => s + srv.ram_mb, 0);
      const usedCpu = (nodeServers ?? []).reduce((s, srv) => s + srv.cpu_percent, 0);
      const usedDisk = (nodeServers ?? []).reduce((s, srv) => s + srv.disk_mb, 0);

      const reserveFraction = premiumReservePercent / 100;
      const freeableRam = capacityRam - usedRam - input.ram_mb;
      const freeableCpu = capacityCpu - usedCpu - input.cpu_percent;
      const freeableDisk = capacityDisk - usedDisk - input.disk_mb;

      const minFreeRam = Math.floor(capacityRam * reserveFraction);
      const minFreeCpu = Math.floor(capacityCpu * reserveFraction);
      const minFreeDisk = Math.floor(capacityDisk * reserveFraction);

      if (freeableRam < minFreeRam || freeableCpu < minFreeCpu || freeableDisk < minFreeDisk) {
        return NextResponse.json(
          {
            error: "premiumReserved",
            message: `This node's remaining capacity is reserved for premium users. Upgrade your plan or choose fewer resources.`,
          },
          { status: 503 }
        );
      }
    }
  }

  // Pick a free allocation from the chosen node — admin must add them manually
  const { data: allocation } = await adminSupabase
    .from("allocations")
    .select("id, ip, local_ip, port")
    .eq("node_id", pickedNodeId)
    .is("server_id", null)
    .order("port", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!allocation) {
    return NextResponse.json(
      { error: "noAllocations", message: "No free IP:port allocations available on this node. Ask your admin to add allocations in the admin panel." },
      { status: 503 }
    );
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
      node_id: pickedNodeId,
      allocation_id: allocation?.id ?? null,
      motd: input.motd ?? "A Minecraft Server",
      max_players: input.max_players ?? 20,
      status: "offline",
      last_active_at: new Date().toISOString(),
      modpack_url: input.modpack_url ?? null,
      modpack_name: input.modpack_name ?? null,
    } as never)
    .select()
    .single();

  // Mark the allocation as taken
  if (server && allocation) {
    await adminSupabase
      .from("allocations")
      .update({ server_id: server.id, assigned_at: new Date().toISOString() })
      .eq("id", allocation.id);
  }

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
