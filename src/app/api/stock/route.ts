import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * GET /api/stock?ram_mb=1024&disk_mb=5120[&region_id=...]
 *
 * Pre-flight check used by the server creator. Returns whether at least
 * one node can satisfy the requested resources AND has a free allocation.
 * This mirrors the logic in pick_node_with_stock exactly, so the wizard
 * banner and the actual server creation are always in agreement.
 *
 * CPU is intentionally NOT a constraint — Docker shares CPU via CFS and
 * the host scheduler, so CPU is effectively unlimited from a stock
 * perspective. Only RAM and disk are partitioned.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const ramMb = parseInt(sp.get("ram_mb") ?? "0", 10);
  const diskMb = parseInt(sp.get("disk_mb") ?? "0", 10);
  const regionId = sp.get("region_id");

  if (!ramMb || !diskMb) {
    return NextResponse.json({ error: "ram_mb and disk_mb required" }, { status: 400 });
  }

  type NodeStockRow = {
    id: string;
    name: string;
    region_id: string | null;
    free_ram_mb: number;
    free_disk_mb: number;
    status: string;
  };

  const admin = createAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = admin as any;
  let query = adminAny
    .from("node_stock")
    .select("id, name, region_id, free_ram_mb, free_disk_mb, status")
    .eq("status", "online");
  if (regionId) query = query.eq("region_id", regionId);

  const { data: rawNodes, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const all: NodeStockRow[] = rawNodes ?? [];

  // Largest free RAM/disk across all online nodes (helps suggest smaller sizes)
  const maxFreeRam = all.reduce((m, n) => Math.max(m, n.free_ram_mb), 0);
  const maxFreeDisk = all.reduce((m, n) => Math.max(m, n.free_disk_mb), 0);

  // Nodes with enough capacity for the requested RAM + disk
  const fitting = all.filter((n) => n.free_ram_mb >= ramMb && n.free_disk_mb >= diskMb);

  if (fitting.length === 0) {
    return NextResponse.json({
      available: false,
      reason: "noCapacity",
      fitting_nodes: 0,
      online_nodes: all.length,
      max_free_ram_mb: maxFreeRam,
      max_free_disk_mb: maxFreeDisk,
    });
  }

  // Among fitting nodes, check which ones also have a free allocation.
  // This mirrors pick_node_with_stock's EXISTS(allocations) check so the
  // pre-flight result and the actual creation always agree.
  type AllocRow = { node_id: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allocRows } = await (admin as any)
    .from("allocations")
    .select("node_id")
    .in("node_id", fitting.map((n) => n.id))
    .is("server_id", null);

  const nodesWithAlloc = new Set<string>(
    ((allocRows ?? []) as AllocRow[]).map((r) => r.node_id)
  );
  const readyNodes = fitting.filter((n) => nodesWithAlloc.has(n.id));

  return NextResponse.json({
    available: readyNodes.length > 0,
    reason: readyNodes.length === 0 ? "noAllocations" : null,
    fitting_nodes: fitting.length,
    ready_nodes: readyNodes.length,
    online_nodes: all.length,
    max_free_ram_mb: maxFreeRam,
    max_free_disk_mb: maxFreeDisk,
  });
}
