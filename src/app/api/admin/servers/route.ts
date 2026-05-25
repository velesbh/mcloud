import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/clerk/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * POST /api/admin/servers
 *
 * Admin-only: create a fresh, empty server for any user with arbitrary
 * resources. Bypasses all quota / stock / premium-reserve checks.
 *
 * Body:
 *   name                 string (required)
 *   owner_clerk_user_id  string (required)
 *   node_id              UUID  (optional — auto-pick any online node with a free allocation)
 *   ram_mb               number (required)
 *   disk_mb              number (required)
 *   cpu_percent          number (required)
 *   edition              "java" | "bedrock" (default "java")
 *   game_version         string (default "1.21.4")
 *   loader               string (default "vanilla")
 *   region_id            UUID (optional)
 *   motd                 string (optional)
 *   max_players          number (optional, default 20)
 *   is_premium           boolean (optional, default false) — exempt from hibernation
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const ownerClerkUserId = String(body.owner_clerk_user_id ?? "").trim();
  const nodeIdInput = body.node_id ? String(body.node_id) : null;
  const ramMb = Number(body.ram_mb ?? 0);
  const diskMb = Number(body.disk_mb ?? 0);
  const cpuPercent = Number(body.cpu_percent ?? 0);
  const edition = (body.edition === "bedrock" ? "bedrock" : "java") as "java" | "bedrock";
  const gameVersion = String(body.game_version ?? "1.21.4");
  const loader = String(body.loader ?? "vanilla");
  const regionId = body.region_id ? String(body.region_id) : null;
  const motd = body.motd ? String(body.motd) : null;
  const maxPlayers = Number(body.max_players ?? 20);
  const isPremium = body.is_premium === true;

  if (!name || !ownerClerkUserId) {
    return NextResponse.json({ error: "name and owner_clerk_user_id are required" }, { status: 400 });
  }
  if (ramMb <= 0 || diskMb <= 0 || cpuPercent <= 0) {
    return NextResponse.json({ error: "ram_mb, disk_mb, cpu_percent must be positive" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();

  // ── Resolve or create profile for owner ───────────────────────────
  let { data: profile } = await admin
    .from("profiles")
    .select("id, max_servers, max_ram_mb, max_disk_mb, max_cpu_percent")
    .eq("clerk_user_id", ownerClerkUserId)
    .maybeSingle();

  if (!profile) {
    const { data: created, error: createErr } = await admin
      .from("profiles")
      .insert({
        clerk_user_id: ownerClerkUserId,
        email: `${ownerClerkUserId}@imported.local`,
        display_name: null,
        role: "user",
      } as never)
      .select("id, max_servers, max_ram_mb, max_disk_mb, max_cpu_percent")
      .single();
    if (createErr || !created) {
      return NextResponse.json(
        { error: `Failed to create owner profile: ${createErr?.message ?? "unknown"}` },
        { status: 500 }
      );
    }
    profile = created;
  }

  // ── Pick node ─────────────────────────────────────────────────────
  let nodeId = nodeIdInput;
  if (!nodeId) {
    // Auto-pick: any node with a free allocation. We deliberately skip
    // stock math — admins create with whatever they ask for.
    const { data: alloc } = await admin
      .from("allocations")
      .select("node_id")
      .is("server_id", null)
      .limit(1)
      .maybeSingle();
    nodeId = alloc?.node_id ?? null;
    if (!nodeId) {
      return NextResponse.json(
        { error: "noAllocations", message: "No free allocations on any node. Add some in admin → Allocations." },
        { status: 503 }
      );
    }
  } else {
    const { data: node } = await admin.from("nodes").select("id").eq("id", nodeId).maybeSingle();
    if (!node) return NextResponse.json({ error: "Node not found" }, { status: 404 });
  }

  // ── Pick a free allocation on that node ──────────────────────────
  const { data: allocation } = await admin
    .from("allocations")
    .select("id, ip, port")
    .eq("node_id", nodeId)
    .is("server_id", null)
    .order("is_default", { ascending: false })
    .order("port", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!allocation) {
    return NextResponse.json(
      { error: "noAllocations", message: "No free allocations on this node." },
      { status: 503 }
    );
  }

  // ── Bump profile quotas so the SERVER_LIMIT_REACHED trigger lets us in.
  // (Same trick the import route uses — admin creates bypass user quotas.)
  const { data: existing } = await admin
    .from("servers")
    .select("ram_mb, disk_mb")
    .eq("user_id", profile.id);
  const usedRam = (existing ?? []).reduce((s, r) => s + (r.ram_mb ?? 0), 0);
  const usedDisk = (existing ?? []).reduce((s, r) => s + (r.disk_mb ?? 0), 0);
  const usedServers = (existing ?? []).length;

  await admin.from("profiles").update({
    max_servers:     Math.max(profile.max_servers     ?? 1,    usedServers + 1),
    max_ram_mb:      Math.max(profile.max_ram_mb      ?? 1024, usedRam  + ramMb),
    max_disk_mb:     Math.max(profile.max_disk_mb     ?? 5120, usedDisk + diskMb),
    max_cpu_percent: Math.max(profile.max_cpu_percent ?? 100,  cpuPercent),
  } as never).eq("id", profile.id);

  // ── Insert server row ────────────────────────────────────────────
  const { data: server, error: insertErr } = await admin
    .from("servers")
    .insert({
      user_id: profile.id,
      clerk_user_id: ownerClerkUserId,
      name,
      edition,
      game_version: gameVersion,
      loader: loader as never,
      ram_mb: ramMb,
      cpu_percent: cpuPercent,
      disk_mb: diskMb,
      region_id: regionId,
      node_id: nodeId,
      allocation_id: allocation.id,
      motd: motd ?? "A Minecraft Server",
      max_players: maxPlayers,
      status: "offline",
      is_premium: isPremium,
      last_active_at: new Date().toISOString(),
    } as never)
    .select()
    .single();

  if (insertErr || !server) {
    return NextResponse.json({ error: insertErr?.message ?? "Failed to create server" }, { status: 500 });
  }

  await admin
    .from("allocations")
    .update({ server_id: server.id, assigned_at: new Date().toISOString() })
    .eq("id", allocation.id);

  // Default file skeleton (mirrors /api/servers POST).
  await admin.from("server_files").insert([
    { server_id: server.id, path: "/", name: "root", is_directory: true },
    { server_id: server.id, path: "/world", name: "world", is_directory: true },
    { server_id: server.id, path: "/plugins", name: "plugins", is_directory: true },
    { server_id: server.id, path: "/mods", name: "mods", is_directory: true },
  ]);

  await admin.from("console_events").insert({
    server_id: server.id,
    line: `[MCloud] Server "${server.name}" created by admin${isPremium ? " (premium — no hibernation)" : ""}. Press Start to launch.`,
    source: "system",
  });

  return NextResponse.json(server, { status: 201 });
}
