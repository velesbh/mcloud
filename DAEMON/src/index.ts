import { config } from "./config.js";
import { log } from "./logger.js";
import { supabase } from "./supabase.js";
import {
  startServer,
  stopServer,
  restartServer,
  sendConsoleCommand,
  shutdownAll,
  getRunning,
  killServerProc,
} from "./server-manager.js";
import { subscribeFileManager } from "./file-manager.js";
import { startHibernationCron } from "./hibernation.js";
import { startMetricsBroadcaster } from "./metrics-broadcaster.js";
import { handleFileOp } from "./file-ops.js";
import { handleWorldOp } from "./world-manager.js";
import { wcSupabase } from "./webcloud-supabase.js";
import { runDeployment, stopProjectRuntime } from "./webcloud-deploy.js";
import { ensurePortPoolSeeded } from "./webcloud-port.js";

/**
 * Upsert this node into the DB on startup so it auto-registers.
 * If the node already exists (same NODE_ID), just mark it online.
 * If it doesn't exist yet, create it with all details from env/auto-detect.
 */
async function registerNode() {
  const payload: Record<string, unknown> = {
    id: config.nodeId,
    name: config.nodeName,
    fqdn: config.nodeFqdn,
    ip: config.nodeIp,
    total_ram_mb: config.nodeTotalRamMb,
    total_cpu: config.nodeTotalCpu,
    total_disk_mb: config.nodeTotalDiskMb,
    overallocation_percent: config.nodeOverallocationPercent,
    status: "online",
    last_seen_at: new Date().toISOString(),
  };
  // Only set region_id when explicitly configured — don't overwrite
  // an admin-assigned region on daemon restart.
  if (config.nodeRegionId) payload.region_id = config.nodeRegionId;

  const { error } = await supabase
    .from("nodes")
    .upsert(payload, { onConflict: "id" });
  if (error) {
    log.error("registerNode failed", { error });
    process.exit(1);
  }
  log.info("node registered", {
    id: config.nodeId,
    name: config.nodeName,
    ip: config.nodeIp,
    region: config.nodeRegionId ?? "unassigned",
  });
}

/**
 * Mirror the node row into the `webcloud` schema. Admin-managed columns
 * (region_id, webcloud_allocation_percent) are deliberately omitted so
 * daemon restarts don't clobber operator choices.
 */
async function registerWebCloudNode() {
  const payload: Record<string, unknown> = {
    id: config.nodeId,
    name: config.nodeName,
    fqdn: config.nodeFqdn,
    total_ram_mb: config.nodeTotalRamMb,
    total_disk_mb: config.nodeTotalDiskMb,
    overallocation_percent: config.nodeOverallocationPercent,
    status: "online",
    last_heartbeat: new Date().toISOString(),
  };
  // region_id MUST be present on first insert (NOT NULL constraint). If the
  // mcloud daemon was started with NODE_REGION_ID we reuse it; otherwise the
  // webcloud row stays absent until the admin assigns one and we'll retry
  // next heartbeat tick.
  if (config.nodeRegionId) payload.region_id = config.nodeRegionId;
  else {
    log.info("webcloud: skipping node registration — NODE_REGION_ID not set");
    return;
  }

  const { error } = await wcSupabase.from("nodes").upsert(payload, { onConflict: "id" });
  if (error) {
    log.warn("registerWebCloudNode failed (non-fatal)", { error: error.message });
    return;
  }
  await ensurePortPoolSeeded();
  log.info("webcloud node registered", { id: config.nodeId });
}

/**
 * Periodic heartbeat so admin can detect dead daemons.
 */
function startHeartbeat() {
  let consecutiveFailures = 0;

  async function beat() {
    const running = [...getRunning().keys()];
    const { error } = await supabase
      .from("nodes")
      .update({
        status: "online",
        last_seen_at: new Date().toISOString(),
        running_count: running.length,
      })
      .eq("id", config.nodeId);

    if (error) {
      consecutiveFailures++;
      log.warn("heartbeat failed", { attempt: consecutiveFailures, error });
      if (consecutiveFailures >= 5) {
        log.error("5 consecutive heartbeat failures — check Supabase connectivity");
      }
    } else {
      consecutiveFailures = 0;
    }

    // Mirror the heartbeat into webcloud.nodes so its stock view marks this
    // node available. Silently swallow errors (e.g. row not yet inserted
    // because no region is assigned) — they're already logged at register.
    await wcSupabase
      .from("nodes")
      .update({ status: "online", last_heartbeat: new Date().toISOString() })
      .eq("id", config.nodeId);
  }

  setInterval(() => void beat(), 15_000);
}

/**
 * Subscribe to WebCloud-specific commands on `webcloud-node:{node_id}`.
 *   - "deploy" { deploymentId }  — kick off the full build/deploy pipeline
 *   - "stop"   { projectId }     — stop a project's runtime container
 */
function subscribeWebCloudCommands() {
  const channel = wcSupabase.channel(`webcloud-node:${config.nodeId}`, {
    config: { broadcast: { self: false, ack: false } },
  });

  channel.on("broadcast", { event: "deploy" }, async (msg) => {
    const id = msg.payload?.deploymentId;
    if (!id) return;
    log.info("wc cmd: deploy", { deploymentId: id });
    // Fire-and-forget — the orchestrator updates DB state itself
    void runDeployment(id);
  });

  channel.on("broadcast", { event: "stop" }, async (msg) => {
    const id = msg.payload?.projectId;
    if (!id) return;
    log.info("wc cmd: stop", { projectId: id });
    await stopProjectRuntime(id);
  });

  void channel.subscribe((status) => {
    log.info(`webcloud-node channel: ${status}`);
  });
}

/**
 * Subscribe to commands sent to this node.
 *
 * Channel format: `node:{node_id}` events:
 *   - "start"   { serverId }
 *   - "stop"    { serverId }
 *   - "restart" { serverId }
 *   - "command" { serverId, cmd }
 *   - "watch"   { serverId }   ← causes daemon to subscribe to its file-manager
 */
function subscribeCommands() {
  const channel = supabase.channel(`node:${config.nodeId}`, {
    config: { broadcast: { self: false, ack: false } },
  });

  channel.on("broadcast", { event: "start" }, async (msg) => {
    const id = msg.payload?.serverId;
    if (!id) return;
    log.info("cmd: start", { serverId: id });
    subscribeFileManager(id);
    await startServer(id);
  });

  channel.on("broadcast", { event: "stop" }, async (msg) => {
    const id = msg.payload?.serverId;
    if (id) {
      log.info("cmd: stop", { serverId: id });
      await stopServer(id);
    }
  });

  channel.on("broadcast", { event: "restart" }, async (msg) => {
    const id = msg.payload?.serverId;
    if (id) {
      log.info("cmd: restart", { serverId: id });
      await restartServer(id);
    }
  });

  channel.on("broadcast", { event: "command" }, async (msg) => {
    const { serverId, cmd } = msg.payload ?? {};
    if (serverId && cmd) {
      log.info("cmd: console", { serverId, cmd });
      await sendConsoleCommand(serverId, cmd);
    }
  });

  channel.on("broadcast", { event: "kill" }, async (msg) => {
    const id = msg.payload?.serverId;
    if (!id) return;
    log.info("cmd: kill (SIGKILL)", { serverId: id });
    await killServerProc(id);
    // Force DB state regardless of whether process existed
    await supabase.from("servers").update({ status: "offline" }).eq("id", id);
  });

  channel.on("broadcast", { event: "watch" }, (msg) => {
    const id = msg.payload?.serverId;
    if (id) subscribeFileManager(id);
  });

  // File operations: list/read/write/upload/download/zip/unzip/etc.
  channel.on("broadcast", { event: "file-op" }, async (msg) => {
    const p = msg.payload as { op?: string; opId?: string; serverId?: string } & Record<string, unknown>;
    if (!p?.op || !p.opId || !p.serverId) return;
    log.info("file-op", { op: p.op, serverId: p.serverId, opId: p.opId });
    await handleFileOp(p as Parameters<typeof handleFileOp>[0]);
  });

  // World operations: list/set-active/delete/rename/import-url/export
  channel.on("broadcast", { event: "world-op" }, async (msg) => {
    const p = msg.payload as { op?: string; opId?: string; serverId?: string } & Record<string, unknown>;
    if (!p?.op || !p.opId || !p.serverId) return;
    log.info("world-op", { op: p.op, serverId: p.serverId, opId: p.opId });
    await handleWorldOp(p as Parameters<typeof handleWorldOp>[0]);
  });

  void channel.subscribe((status) => {
    log.info(`node channel: ${status}`);
  });
}

/**
 * Subscribe file-manager channels for any server already assigned to this node.
 */
async function subscribeKnownServers() {
  const { data, error } = await supabase
    .from("servers")
    .select("id")
    .eq("node_id", config.nodeId);
  if (error) {
    // Non-fatal — no servers assigned to this node yet, or schema not ready
    log.info("subscribeKnownServers: no servers found or schema not ready (OK on first run)");
    return;
  }
  for (const row of data ?? []) {
    subscribeFileManager(row.id);
  }
  log.info("subscribed file-manager channels", { count: data?.length ?? 0 });
}

async function main() {
  log.info("MCloud+WebCloud daemon starting", { nodeId: config.nodeId });
  await registerNode();
  await registerWebCloudNode();
  startHeartbeat();
  subscribeCommands();
  subscribeWebCloudCommands();
  await subscribeKnownServers();
  startHibernationCron();
  startMetricsBroadcaster();
  log.info("daemon ready");
}

main().catch((e) => {
  log.error("fatal", { err: String(e) });
  process.exit(1);
});

async function shutdown(sig: string) {
  log.info(`got ${sig}, shutting down`);
  await supabase.from("nodes").update({ status: "offline" }).eq("id", config.nodeId);
  await shutdownAll();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
