import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/clerk/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * GET /api/servers/[id]/metrics
 * Returns the last 60 metric samples for this server (last ~60 minutes),
 * ordered oldest-first so sparklines render left-to-right.
 *
 * POST /api/servers/[id]/metrics
 * Insert a new metric row. Used by the daemon or admin tooling.
 * Body: { ram_used_mb, cpu_percent, player_count }
 */

async function getServerAndCheckOwnership(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  serverId: string
) {
  // Admins bypass RLS — use the admin client so they can see any server
  const adminAccess = await isAdmin();
  const client = adminAccess ? createAdminSupabaseClient() : supabase;
  const { data, error } = await client
    .from("servers")
    .select("id, clerk_user_id")
    .eq("id", serverId)
    .single();

  if (error || !data) return null;
  if (data.clerk_user_id !== userId && !adminAccess) return null;
  return data;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const server = await getServerAndCheckOwnership(supabase, userId, id);
  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch last 60 rows sorted ascending so sparkline renders chronologically.
  // Inner query fetches newest 60, outer re-sorts ascending.
  const { data, error } = await supabase
    .from("server_metrics")
    .select("id, server_id, sampled_at, ram_used_mb, cpu_percent, player_count")
    .eq("server_id", id)
    .order("sampled_at", { ascending: false })
    .limit(60);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Reverse so oldest is first for sparkline rendering
  const rows = (data ?? []).reverse();
  return NextResponse.json(rows);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const server = await getServerAndCheckOwnership(supabase, userId, id);
  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as { ram_used_mb?: number; cpu_percent?: number; player_count?: number };
  const { ram_used_mb = 0, cpu_percent = 0, player_count = 0 } = body;

  const { data, error } = await supabase
    .from("server_metrics")
    .insert({ server_id: id, ram_used_mb, cpu_percent, player_count })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
