import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { getRunning } from "./server-manager.js";
import { broadcastMetrics } from "./console-bridge.js";
import { log } from "./logger.js";
import { supabase } from "./supabase.js";
import { config } from "./config.js";

const execFileAsync = promisify(execFile);

interface CpuSnapshot {
  utime: number;
  stime: number;
  wallMs: number;
}
const cpuSnapshots = new Map<number, CpuSnapshot>();

/**
 * Read VmRSS (resident set size) from /proc/{pid}/status in MB.
 * Returns 0 if unreadable (non-Linux, pid gone, etc.)
 */
async function readRamMb(pid: number): Promise<number> {
  try {
    const text = await readFile(`/proc/${pid}/status`, "utf8");
    const match = text.match(/VmRSS:\s+(\d+)\s+kB/);
    return match ? Math.round(parseInt(match[1]) / 1024) : 0;
  } catch {
    return 0;
  }
}

/**
 * Measure actual on-disk usage of a server directory with `du -sm`.
 * Returns 0 on any error (non-Linux, dir gone, etc.)
 */
async function readDiskMb(serverId: string): Promise<number> {
  const dir = path.join(config.serversDir, serverId);
  try {
    const { stdout } = await execFileAsync("du", ["-sm", "--apparent-size", dir], { timeout: 5000 });
    // Output: "<MB>\t<path>"
    const mb = parseInt(stdout.split("\t")[0], 10);
    return isNaN(mb) ? 0 : mb;
  } catch {
    return 0;
  }
}

/**
 * Calculate CPU usage % since the last call for this pid.
 * Uses /proc/{pid}/stat (fields 14=utime, 15=stime in clock ticks).
 * Returns 0 on first call or error.
 */
async function readCpuPercent(pid: number): Promise<number> {
  try {
    const text = await readFile(`/proc/${pid}/stat`, "utf8");
    const fields = text.split(" ");
    const utime = parseInt(fields[13]);
    const stime = parseInt(fields[14]);
    const now = Date.now();

    const prev = cpuSnapshots.get(pid);
    cpuSnapshots.set(pid, { utime, stime, wallMs: now });

    if (!prev) return 0;

    const ticksPerSec = 100; // HZ=100 on most Linux kernels
    const ticksDelta = (utime + stime) - (prev.utime + prev.stime);
    const wallSec = (now - prev.wallMs) / 1000;
    if (wallSec <= 0) return 0;

    return Math.min(Math.round((ticksDelta / ticksPerSec / wallSec) * 100), 100);
  } catch {
    return 0;
  }
}

/**
 * Every 5 s, read real RAM + CPU metrics for every running server process
 * and push them to the `console:{serverId}` Realtime channel so the
 * overview page can display live values without polling.
 */
export function startMetricsBroadcaster() {
  // Per-server disk cache: re-measure every 60 s (du is slow), reuse value
  // for the 5-second live broadcasts in between.
  const diskCache = new Map<string, number>();

  setInterval(async () => {
    const running = getRunning();
    for (const [serverId, info] of running) {
      const pid = info.proc.pid;
      if (!pid) continue;

      const [ramMb, cpuPercent] = await Promise.all([
        readRamMb(pid),
        readCpuPercent(pid),
      ]);
      const diskUsedMb = diskCache.get(serverId) ?? 0;

      void broadcastMetrics(serverId, ramMb, cpuPercent, diskUsedMb);
      log.debug("metrics", { serverId, pid, ramMb, cpuPercent, diskUsedMb });
    }
  }, 5_000);

  // Every 60 s: persist a DB snapshot AND refresh the disk cache (du is expensive).
  setInterval(async () => {
    const running = getRunning();
    for (const [serverId, info] of running) {
      const pid = info.proc.pid;
      if (!pid) continue;
      const [ramMb, cpuPercent, diskUsedMb] = await Promise.all([
        readRamMb(pid),
        readCpuPercent(pid),
        readDiskMb(serverId),
      ]);
      diskCache.set(serverId, diskUsedMb);
      const { error } = await supabase.from("server_metrics").insert({
        server_id: serverId,
        ram_used_mb: ramMb,
        cpu_percent: cpuPercent,
        player_count: 0, // TODO: wire player count from RCON/log parsing
        disk_used_mb: diskUsedMb,
      });
      if (error) log.warn("metrics persist error", { serverId, error: error.message });
    }
  }, 60_000);

  log.info("metrics broadcaster started");
}
