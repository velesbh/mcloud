import { readFile } from "node:fs/promises";
import { getRunning } from "./server-manager.js";
import { broadcastMetrics } from "./console-bridge.js";
import { log } from "./logger.js";
import { supabase } from "./supabase.js";
const cpuSnapshots = new Map();
/**
 * Read VmRSS (resident set size) from /proc/{pid}/status in MB.
 * Returns 0 if unreadable (non-Linux, pid gone, etc.)
 */
async function readRamMb(pid) {
    try {
        const text = await readFile(`/proc/${pid}/status`, "utf8");
        const match = text.match(/VmRSS:\s+(\d+)\s+kB/);
        return match ? Math.round(parseInt(match[1]) / 1024) : 0;
    }
    catch {
        return 0;
    }
}
/**
 * Calculate CPU usage % since the last call for this pid.
 * Uses /proc/{pid}/stat (fields 14=utime, 15=stime in clock ticks).
 * Returns 0 on first call or error.
 */
async function readCpuPercent(pid) {
    try {
        const text = await readFile(`/proc/${pid}/stat`, "utf8");
        const fields = text.split(" ");
        const utime = parseInt(fields[13]);
        const stime = parseInt(fields[14]);
        const now = Date.now();
        const prev = cpuSnapshots.get(pid);
        cpuSnapshots.set(pid, { utime, stime, wallMs: now });
        if (!prev)
            return 0;
        const ticksPerSec = 100; // HZ=100 on most Linux kernels
        const ticksDelta = (utime + stime) - (prev.utime + prev.stime);
        const wallSec = (now - prev.wallMs) / 1000;
        if (wallSec <= 0)
            return 0;
        return Math.min(Math.round((ticksDelta / ticksPerSec / wallSec) * 100), 100);
    }
    catch {
        return 0;
    }
}
/**
 * Every 5 s, read real RAM + CPU metrics for every running server process
 * and push them to the `console:{serverId}` Realtime channel so the
 * overview page can display live values without polling.
 */
export function startMetricsBroadcaster() {
    setInterval(async () => {
        const running = getRunning();
        for (const [serverId, info] of running) {
            const pid = info.proc.pid;
            if (!pid)
                continue;
            const [ramMb, cpuPercent] = await Promise.all([
                readRamMb(pid),
                readCpuPercent(pid),
            ]);
            void broadcastMetrics(serverId, ramMb, cpuPercent);
            log.debug("metrics", { serverId, pid, ramMb, cpuPercent });
        }
    }, 5_000);
    // Every 60 s, persist a snapshot to the server_metrics table for historical analytics.
    setInterval(async () => {
        const running = getRunning();
        for (const [serverId, info] of running) {
            const pid = info.proc.pid;
            if (!pid)
                continue;
            const [ramMb, cpuPercent] = await Promise.all([readRamMb(pid), readCpuPercent(pid)]);
            const { error } = await supabase.from("server_metrics").insert({
                server_id: serverId,
                ram_used_mb: ramMb,
                cpu_percent: cpuPercent,
                player_count: 0, // TODO: wire player count from RCON/log parsing
            });
            if (error)
                log.warn("metrics persist error", { serverId, error: error.message });
        }
    }, 60_000);
    log.info("metrics broadcaster started");
}
//# sourceMappingURL=metrics-broadcaster.js.map