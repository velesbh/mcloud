// v2 — no embedded join; profiles fetched in a separate bulk query
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
  role: string | null;
  is_premium: boolean;
}

async function fetchOurServers(): Promise<Candidate[]> {
  const { data, error } = await supabase
    .from("servers")
    .select("id, user_id, last_active_at, status, node_id, allocation_id, hibernated_at, is_premium")
    .eq("node_id", config.nodeId);
  if (error) {
    log.error("hibernation: fetch failed", { error });
    return [];
  }

  // Look up plan tier + role in bulk (one extra query beats N+1)
  const userIds = [...new Set((data ?? []).map((r: any) => r.user_id).filter(Boolean))];
  const planMap: Record<string, string> = {};
  const roleMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("clerk_user_id, plan_tier, role")
      .in("clerk_user_id", userIds);
    for (const p of profiles ?? []) {
      planMap[p.clerk_user_id] = (p as any).plan_tier ?? "free";
      roleMap[p.clerk_user_id] = (p as any).role ?? "user";
    }
  }

  return (data ?? []).map((r: any) => ({
    id: r.id,
    user_id: r.user_id,
    last_active_at: r.last_active_at,
    status: r.status,
    node_id: r.node_id,
    allocation_id: r.allocation_id,
    hibernated_at: r.hibernated_at,
    plan_tier: planMap[r.user_id] ?? "free",
    role: roleMap[r.user_id] ?? "user",
    is_premium: r.is_premium === true,
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
    // Premium servers and admin-owned servers are exempt from hibernation
    // and the 30-day idle deletion sweep. Same for users on a paid plan.
    const isExempt =
      s.is_premium === true ||
      s.role === "admin" ||
      (s.plan_tier ?? "free") !== "free";
    const isFree = !isExempt;

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
