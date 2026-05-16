import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/clerk/auth";
import { createNodeSchema } from "@/lib/validations/node";
import type { Database } from "@/lib/supabase/types";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("nodes")
    .select("*, regions!nodes_region_id_fkey(name, flag_emoji)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[nodes GET]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Attach real allocated RAM + CPU + allocation counts per node
  const nodes = data ?? [];
  if (nodes.length === 0) return NextResponse.json([]);

  const nodeIds = nodes.map((n) => n.id);
  const admin = createAdminSupabaseClient();

  const { data: servers } = await admin
    .from("servers")
    .select("node_id, ram_mb, cpu_percent")
    .in("node_id", nodeIds);

  const { data: allocations } = await admin
    .from("allocations")
    .select("node_id, server_id")
    .in("node_id", nodeIds);

  // Sum allocated resources per node
  const allocMap = new Map<string, { ram: number; cpu: number; totalAllocs: number; usedAllocs: number }>();
  for (const id of nodeIds) {
    allocMap.set(id, { ram: 0, cpu: 0, totalAllocs: 0, usedAllocs: 0 });
  }
  for (const s of servers ?? []) {
    if (!s.node_id) continue;
    const e = allocMap.get(s.node_id);
    if (e) { e.ram += s.ram_mb; e.cpu += s.cpu_percent; }
  }
  for (const a of allocations ?? []) {
    if (!a.node_id) continue;
    const e = allocMap.get(a.node_id);
    if (e) { e.totalAllocs++; if (a.server_id) e.usedAllocs++; }
  }

  const enriched = nodes.map((n) => ({
    ...n,
    allocated_ram_mb: allocMap.get(n.id)?.ram ?? 0,
    allocated_cpu: allocMap.get(n.id)?.cpu ?? 0,
    total_allocations: allocMap.get(n.id)?.totalAllocs ?? 0,
    used_allocations: allocMap.get(n.id)?.usedAllocs ?? 0,
  }));

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createNodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("nodes")
    .insert(parsed.data as Database["mcloud"]["Tables"]["nodes"]["Insert"])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
