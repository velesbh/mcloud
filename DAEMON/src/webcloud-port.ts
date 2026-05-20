import { wcSupabase } from "./webcloud-supabase.js";
import { wcConfig } from "./webcloud-config.js";
import { log } from "./logger.js";
import { config } from "./config.js";

/**
 * Lazily seed a node's port pool. We INSERT-IGNORE one row per port in
 * [WEBCLOUD_PORT_START, WEBCLOUD_PORT_END]. Done once per daemon start;
 * later calls are cheap thanks to the `(node_id, port)` UNIQUE constraint.
 */
let seeded = false;
export async function ensurePortPoolSeeded(): Promise<void> {
  if (seeded) return;
  const { count } = await wcSupabase
    .from("node_ports")
    .select("*", { count: "exact", head: true })
    .eq("node_id", config.nodeId);
  if ((count ?? 0) > 0) {
    seeded = true;
    return;
  }
  const rows = [];
  for (let p = wcConfig.portRangeStart; p <= wcConfig.portRangeEnd; p++) {
    rows.push({ node_id: config.nodeId, port: p });
  }
  // Chunk inserts so a single statement isn't 10k rows wide.
  const CHUNK = 1000;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await wcSupabase.from("node_ports").insert(rows.slice(i, i + CHUNK));
    if (error && !error.message.includes("duplicate key")) {
      log.warn("port pool seed failed", { error: error.message });
      return;
    }
  }
  seeded = true;
  log.info("webcloud port pool seeded", { count: rows.length });
}

/**
 * Atomically reserve one free port on this node and bind it to the given
 * deployment. Returns null if the pool is exhausted.
 */
export async function allocatePort(deploymentId: string): Promise<number | null> {
  await ensurePortPoolSeeded();
  const { data, error } = await wcSupabase.rpc("allocate_port", {
    pick_node_id: config.nodeId,
    pick_deploy_id: deploymentId,
  });
  if (error) {
    log.error("allocate_port rpc failed", { error: error.message });
    return null;
  }
  return (data as number | null) ?? null;
}

export async function releasePort(deploymentId: string): Promise<void> {
  const { error } = await wcSupabase.rpc("release_port", { pick_deploy_id: deploymentId });
  if (error) log.warn("release_port rpc failed", { error: error.message });
}
