import { supabase } from "./supabase.js";
import { log } from "./logger.js";
import { config } from "./config.js";
import { rm } from "node:fs/promises";
import path from "node:path";

const SEVEN_DAYS_MS = 7  * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

interface Candidate {
  id: string;
  user_id: string;
  last_active_at: string | null;
  status: string;
  node_id: string | null;
  allocation_id: string | null;
  hibernated_at: string | null;
  plan_tier: string | null;
}

async function fetchOurServers(): Promise<Candidate[]> {
  // Use a left-join to user's plan; default plan_tier = 'free'
  const { data, error } = await supabase
    .from("servers")
    .select("id, user_id, last_active_at, status, node_id, allocation_id, hibernated_at, profiles(plan_tier)")
    .eq("node_id", config.nodeId);
  if (error) {
    log.error("hibernation: fetch failed", { error });
    return [];
  }
  return (data ?? []).map((r: any) => ({
    id: r.id,
    user_id: r.user_id,
    last_active_at: r.last_active_at,
    status: r.status,
    node_id: r.node_id,
    allocation_id: r.allocation_id,
    hibernated_at: r.hibernated_at,
    plan_tier: r.profiles?.plan_tier ?? "free",
  }));
}

async function hibernate(s: Candidate) {
  log.info("hibernating server", { id: s.id });
  // Release allocation + node so resources go back to stock
  await supabase
    .from("servers")
    .update({
      status: "hibernated",
      hibernated_at: new Date().toISOString(),
      node_id: null,
      allocation_id: null,
    })
    .eq("id", s.id);
  if (s.allocation_id) {
    await supabase.from("allocations").update({ server_id: null }).eq("id", s.allocation_id);
  }
}

async function deleteForever(s: Candidate) {
  log.info("deleting expired server", { id: s.id });
  // Wipe files
  const dir = path.join(config.serversDir, s.id);
  try {
    await rm(dir, { recursive: true, force: true });
  } catch (e) {
    log.warn("deleteForever: rm failed", { id: s.id, err: String(e) });
  }
  // Wipe DB rows (cascade handles related)
  await supabase.from("servers").delete().eq("id", s.id);
}

async function runOnce() {
  const now = Date.now();
  const servers = await fetchOurServers();
  for (const s of servers) {
    const last = s.last_active_at ? new Date(s.last_active_at).getTime() : 0;
    const idleMs = last ? now - last : Infinity;
    const isFree = (s.plan_tier ?? "free") === "free";

    if (s.status === "hibernated") {
      const since = s.hibernated_at ? new Date(s.hibernated_at).getTime() : 0;
      if (since && now - since >= THIRTY_DAYS_MS - SEVEN_DAYS_MS) {
        await deleteForever(s);
      }
      continue;
    }

    if (isFree && s.status === "offline" && idleMs >= SEVEN_DAYS_MS) {
      await hibernate(s);
    }

    // Total-life cap regardless of state: 30 days idle → gone
    if (isFree && idleMs >= THIRTY_DAYS_MS) {
      await deleteForever(s);
    }
  }
}

export function startHibernationCron() {
  log.info("hibernation cron started", { intervalHours: 1 });
  void runOnce();
  setInterval(() => void runOnce(), HOUR_MS);
}
