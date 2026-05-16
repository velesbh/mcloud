import { supabase } from "./supabase.js";
import { log } from "./logger.js";

/**
 * Broadcast a console line into the `console:{server_id}` Realtime channel.
 * Clients subscribe to this for live console output.
 */
const channelCache = new Map<string, ReturnType<typeof supabase.channel>>();

function getChannel(serverId: string) {
  let ch = channelCache.get(serverId);
  if (!ch) {
    ch = supabase.channel(`console:${serverId}`, {
      config: { broadcast: { self: false, ack: false } },
    });
    void ch.subscribe();
    channelCache.set(serverId, ch);
  }
  return ch;
}

export async function broadcastConsole(
  serverId: string,
  line: string,
  source: "server" | "user" | "system"
) {
  try {
    const ch = getChannel(serverId);
    await ch.send({
      type: "broadcast",
      event: "line",
      payload: { line, source, ts: Date.now() },
    });
  } catch (e) {
    log.warn("broadcastConsole failed", { serverId, err: String(e) });
  }
}

/**
 * Broadcast a status change on the console channel so clients can react
 * immediately without waiting for a DB poll.
 */
export async function broadcastServerStatus(serverId: string, status: string) {
  try {
    const ch = getChannel(serverId);
    await ch.send({
      type: "broadcast",
      event: "status",
      payload: { status, ts: Date.now() },
    });
  } catch (e) {
    log.warn("broadcastServerStatus failed", { serverId, err: String(e) });
  }
}

/**
 * Broadcast real-time resource metrics so the overview page can show
 * actual RAM/CPU usage without polling the DB.
 */
export async function broadcastMetrics(
  serverId: string,
  ramMb: number,
  cpuPercent: number
) {
  try {
    const ch = getChannel(serverId);
    await ch.send({
      type: "broadcast",
      event: "metrics",
      payload: { ramMb, cpuPercent, ts: Date.now() },
    });
  } catch (e) {
    log.warn("broadcastMetrics failed", { serverId, err: String(e) });
  }
}

/** Persist a single console line for replay (last 100 displayed on mount). */
export async function persistConsoleLine(
  serverId: string,
  line: string,
  source: "server" | "user" | "system"
) {
  try {
    await supabase.from("console_events").insert({
      server_id: serverId,
      line,
      source,
    });
  } catch (e) {
    log.warn("persistConsoleLine failed", { serverId, err: String(e) });
  }
}
