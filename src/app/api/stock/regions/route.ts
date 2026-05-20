import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * GET /api/stock/regions?ram_mb=X&disk_mb=Y
 *
 * Returns availability for every active region in a single DB round-trip.
 * Used by the CreateServerWizard to grey-out regions that can't fit the
 * requested resources, so users never reach the "outOfStock" error at all.
 *
 * Response shape:
 * {
 *   any: boolean,                   // true if at least one region is ready
 *   regions: {
 *     [region_id]: {
 *       available: boolean,
 *       reason: "noCapacity" | "noAllocations" | null,
 *       max_free_ram_mb: number,
 *       max_free_disk_mb: number,
 *       online_nodes: number,
 *     }
 *   }
 * }
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const ramMb = parseInt(sp.get("ram_mb") ?? "0", 10);
  const diskMb = parseInt(sp.get("disk_mb") ?? "0", 10);

  if (!ramMb || !diskMb) {
    return NextResponse.json({ error: "ram_mb and disk_mb required" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = admin as any;

  // 1. All online nodes with their region + free resources
  const { data: rawNodes, error: nodeErr } = await adminAny
    .from("node_stock")
    .select("id, region_id, free_ram_mb, free_disk_mb, status")
    .eq("status", "online");
  if (nodeErr) return NextResponse.json({ error: nodeErr.message }, { status: 500 });

  // 2. All active regions
  const { data: rawRegions, error: regErr } = await admin
    .from("regions")
    .select("id, name");
  if (regErr) return NextResponse.json({ error: regErr.message }, { status: 500 });

  type NodeRow = { id: string; region_id: string | null; free_ram_mb: number; free_disk_mb: number };
  const nodes: NodeRow[] = rawNodes ?? [];
  const regions: { id: string }[] = rawRegions ?? [];

  // Nodes that can fit the requested resources
  const fittingIds = new Set(
    nodes.filter((n) => n.free_ram_mb >= ramMb && n.free_disk_mb >= diskMb).map((n) => n.id)
  );

  // Free allocations — only for fitting nodes to minimise the result set
  type AllocRow = { node_id: string };
  const { data: allocRows } = await adminAny
    .from("allocations")
    .select("node_id")
    .in("node_id", [...fittingIds])
    .is("server_id", null);

  const nodesWithAlloc = new Set<string>(
    ((allocRows ?? []) as AllocRow[]).map((r) => r.node_id)
  );

  // Build per-region result
  const result: Record<string, {
    available: boolean;
    reason: "noCapacity" | "noAllocations" | null;
    max_free_ram_mb: number;
    max_free_disk_mb: number;
    online_nodes: number;
  }> = {};

  for (const region of regions) {
    const regionNodes = nodes.filter((n) => n.region_id === region.id);
    const fitting = regionNodes.filter((n) => fittingIds.has(n.id));
    const ready = fitting.filter((n) => nodesWithAlloc.has(n.id));

    const maxFreeRam = regionNodes.reduce((m, n) => Math.max(m, n.free_ram_mb), 0);
    const maxFreeDisk = regionNodes.reduce((m, n) => Math.max(m, n.free_disk_mb), 0);

    result[region.id] = {
      available: ready.length > 0,
      reason: ready.length > 0 ? null : fitting.length > 0 ? "noAllocations" : "noCapacity",
      max_free_ram_mb: maxFreeRam,
      max_free_disk_mb: maxFreeDisk,
      online_nodes: regionNodes.length,
    };
  }

  const any = Object.values(result).some((r) => r.available);
  return NextResponse.json({ any, regions: result });
}
