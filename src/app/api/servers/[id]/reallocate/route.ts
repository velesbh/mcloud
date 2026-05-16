import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

/**
 * POST /api/servers/[id]/reallocate
 *
 * Wakes a hibernated server back up. The server keeps its files but
 * needs a node + allocation reassigned. If stock is unavailable we
 * return 503 — the user has to try again or pick a smaller region.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = createAdminSupabaseClient();

  const { data: srv, error: srvErr } = await supabase
    .from("servers")
    .select("id, clerk_user_id, status, ram_mb, cpu_percent, disk_mb, region_id")
    .eq("id", id)
    .single();

  if (srvErr || !srv) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (srv.clerk_user_id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (srv.status !== "hibernated") {
    return NextResponse.json({ error: "notHibernated" }, { status: 400 });
  }

  // Find a node with stock (rpc is intentionally typed as `any` — the
  // strict Database type would force Supabase's TS resolver into a recursion).
  const { data: pickedNodeId, error: pickErr } = await (
    supabase as unknown as { rpc: (fn: string, args: object) => Promise<{ data: string | null; error: { message: string } | null }> }
  ).rpc("pick_node_with_stock", {
    want_region: srv.region_id,
    want_ram_mb: srv.ram_mb,
    want_cpu: srv.cpu_percent,
    want_disk_mb: srv.disk_mb,
  });
  if (pickErr) return NextResponse.json({ error: pickErr.message }, { status: 500 });
  if (!pickedNodeId) {
    return NextResponse.json(
      { error: "outOfStock", message: "All nodes are full right now. Try again later." },
      { status: 503 }
    );
  }

  // Pick an available allocation on that node
  const { data: alloc } = await supabase
    .from("allocations")
    .select("id")
    .eq("node_id", pickedNodeId)
    .is("server_id", null)
    .limit(1)
    .single();

  const updates: Database["public"]["Tables"]["servers"]["Update"] = {
    node_id: pickedNodeId,
    status: "offline",
    hibernated_at: null,
    last_active_at: new Date().toISOString(),
  };
  if (alloc?.id) {
    updates.allocation_id = alloc.id;
    await supabase
      .from("allocations")
      .update({ server_id: id } as Database["public"]["Tables"]["allocations"]["Update"])
      .eq("id", alloc.id);
  }

  const { error: updErr } = await supabase
    .from("servers")
    .update(updates)
    .eq("id", id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, node_id: pickedNodeId });
}
