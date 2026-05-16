import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { log } from "./logger.js";
import { supabase } from "./supabase.js";
import { broadcastConsole, broadcastServerStatus, persistConsoleLine } from "./console-bridge.js";
import { ensureJar } from "./jar-manager.js";
import { installJava, requiredJavaMajor } from "./java-installer.js";
import { installModpack } from "./modpack-installer.js";

interface Running {
  serverId: string;
  proc: ChildProcess;
  startedAt: Date;
}

const procs = new Map<string, Running>();

export function getRunning() {
  return procs;
}

async function ensureServerDir(serverId: string): Promise<string> {
  const dir = path.join(config.serversDir, serverId);
  await mkdir(dir, { recursive: true });
  return dir;
}

async function ensureEula(dir: string) {
  const eula = path.join(dir, "eula.txt");
  try { await access(eula); } catch {
    await writeFile(eula, "eula=true\n", "utf8");
  }
}

async function setStatus(serverId: string, status: string) {
  await supabase
    .from("servers")
    .update({ status, last_active_at: new Date().toISOString() })
    .eq("id", serverId);
  // Push status immediately to subscribed clients — no polling delay
  void broadcastServerStatus(serverId, status);
}


/**
 * Spawns the process and wires up stdout/stderr/event handlers.
 * On ENOENT (Java missing), auto-installs the correct JRE and retries once.
 */
async function spawnServer(
  serverId: string,
  cmd: string,
  args: string[],
  cwd: string,
  gameVersion: string,
  isRetry = false
): Promise<void> {
  const proc = spawn(cmd, args, { cwd });
  let markedRunning = false;

  async function markRunning() {
    if (markedRunning) return;
    markedRunning = true;
    await setStatus(serverId, "running");
    await broadcastConsole(serverId, "> Server is online", "system");
  }

  proc.stdout.on("data", (b: Buffer) => {
    const text = b.toString("utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.replace(/\r$/, "");
      if (!trimmed) continue;
      void broadcastConsole(serverId, trimmed, "server");
      void persistConsoleLine(serverId, trimmed, "server");
      // Paper/Vanilla/Fabric all log "Done (Xs)!" when the server is ready
      if (!markedRunning && trimmed.includes("Done (") && trimmed.includes("For help")) {
        void markRunning();
      }
    }
  });

  proc.stderr.on("data", (b: Buffer) => {
    const text = b.toString("utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.replace(/\r$/, "");
      if (!trimmed) continue;
      void broadcastConsole(serverId, trimmed, "server");
      void persistConsoleLine(serverId, trimmed, "server");
    }
  });

  proc.on("error", async (err) => {
    procs.delete(serverId);
    const nodeErr = err as NodeJS.ErrnoException;
    log.error("server process error", { serverId, err: err.message });

    if (nodeErr.code === "ENOENT" && !isRetry) {
      // Java not found — try to install it, then retry once
      const major = requiredJavaMajor(gameVersion);
      await broadcastConsole(
        serverId,
        `[daemon] Java ${major} not found — attempting auto-install...`,
        "system"
      );
      const ok = await installJava(gameVersion, serverId);
      if (ok) {
        await broadcastConsole(serverId, "[daemon] Retrying server start with new Java...", "system");
        await spawnServer(serverId, cmd, args, cwd, gameVersion, true);
      } else {
        await broadcastConsole(
          serverId,
          `[error] Auto-install failed. Install manually: apt-get install -y openjdk-${major}-jre-headless`,
          "system"
        );
        await setStatus(serverId, "error");
      }
    } else {
      await broadcastConsole(serverId, `[error] ${err.message}`, "system");
      await setStatus(serverId, "error");
    }
  });

  proc.on("spawn", () => {
    log.info("server spawned", { serverId, pid: proc.pid });
    procs.set(serverId, { serverId, proc, startedAt: new Date() });
  });

  proc.on("exit", async (code, signal) => {
    log.info("server exited", { serverId, code, signal });
    procs.delete(serverId);
    // Always reset to offline — if the JVM crashed before the 2s "running" timer
    // this is the only place that clears the "starting" state.
    // (ENOENT is handled by the "error" event above, so no double-set.)
    await setStatus(serverId, "offline");
    await broadcastConsole(serverId, `> Server stopped (code=${code ?? signal ?? "?"})`, "system");
  });

  // Register immediately so the kill handler can find the proc
  procs.set(serverId, { serverId, proc, startedAt: new Date() });
}

export async function startServer(serverId: string) {
  if (procs.has(serverId)) {
    log.warn("startServer: already running", { serverId });
    return;
  }

  const { data: srv, error } = await supabase
    .from("servers")
    .select("id, name, edition, game_version, loader, ram_mb, max_players, motd, allocation_id, modpack_url, modpack_installed, allocations(local_ip, port)")
    .eq("id", serverId)
    .single();

  if (error || !srv) {
    log.error("startServer: server not found", { serverId, error });
    return;
  }

  await setStatus(serverId, "starting");
  await broadcastConsole(serverId, `> Starting ${srv.name} (${srv.edition} ${srv.game_version})...`, "system");

  const dir = await ensureServerDir(serverId);
  await ensureEula(dir);

  // Install modpack on first start (if URL set and not yet installed)
  const srvWithModpack = srv as typeof srv & { modpack_url?: string | null; modpack_installed?: boolean };
  if (srvWithModpack.modpack_url && !srvWithModpack.modpack_installed) {
    try {
      await installModpack(serverId, srvWithModpack.modpack_url);
    } catch (err) {
      log.error("modpack install failed", { serverId, err: String(err) });
      await broadcastConsole(serverId, `[modpack] Install failed: ${String(err)}`, "system");
      await setStatus(serverId, "error");
      return;
    }
  }

  // Resolve bind address + port from allocation (fall back to 0.0.0.0:25565)
  const alloc = Array.isArray(srv.allocations)
    ? srv.allocations[0]
    : srv.allocations as { local_ip?: string; port?: number } | null;
  const bindIp   = alloc?.local_ip ?? "0.0.0.0";
  const bindPort = alloc?.port ?? 25565;

  // Write server.properties
  const props = [
    `motd=${srv.motd ?? srv.name}`,
    `max-players=${srv.max_players ?? 20}`,
    `server-ip=${bindIp}`,
    `server-port=${bindPort}`,
    `online-mode=true`,
    `enable-rcon=false`,
  ].join("\n");
  await writeFile(path.join(dir, "server.properties"), props, "utf8");
  log.info("server.properties written", { serverId, bindIp, bindPort });

  let cmd: string;
  let args: string[];

  if (srv.edition === "bedrock") {
    if (!config.bedrockBin) {
      await broadcastConsole(serverId, "[error] BEDROCK_BIN not configured on daemon", "system");
      await setStatus(serverId, "error");
      return;
    }
    cmd = config.bedrockBin;
    args = [];
  } else {
    // Auto-download the jar if missing
    let jar: string;
    try {
      await broadcastConsole(serverId, `> Fetching ${srv.loader} ${srv.game_version} jar...`, "system");
      jar = await ensureJar(srv.loader, srv.game_version);
    } catch (err) {
      const msg = `[error] Failed to download server jar: ${String(err)}`;
      log.error("jar download failed", { serverId, err });
      await broadcastConsole(serverId, msg, "system");
      await setStatus(serverId, "error");
      return;
    }

    cmd = config.javaBin;
    const xmx = `-Xmx${srv.ram_mb}M`;
    const xms = `-Xms${Math.floor(srv.ram_mb / 2)}M`;
    args = [xmx, xms, "-jar", jar, "nogui"];
  }

  // Spawn with optional auto-install retry on ENOENT (Java missing)
  await spawnServer(serverId, cmd, args, dir, srv.game_version);
}

export async function stopServer(serverId: string) {
  const running = procs.get(serverId);
  if (!running) {
    log.warn("stopServer: not running", { serverId });
    await setStatus(serverId, "offline");
    return;
  }
  await setStatus(serverId, "stopping");
  await broadcastConsole(serverId, "> Stopping server...", "system");
  if (running.proc.stdin && !running.proc.stdin.destroyed) {
    running.proc.stdin.write("stop\n");
  }
  // Hard-kill after 30s if graceful didn't work
  setTimeout(() => {
    if (procs.has(serverId)) {
      log.warn("hard-killing server", { serverId });
      running.proc.kill("SIGKILL");
    }
  }, 30_000);
}

export async function restartServer(serverId: string) {
  await stopServer(serverId);
  // wait for exit
  let waited = 0;
  while (procs.has(serverId) && waited < 35_000) {
    await new Promise((r) => setTimeout(r, 500));
    waited += 500;
  }
  await startServer(serverId);
}

export async function sendConsoleCommand(serverId: string, cmd: string) {
  const running = procs.get(serverId);
  if (!running || !running.proc.stdin || running.proc.stdin.destroyed) {
    await broadcastConsole(serverId, "[daemon] server not running", "system");
    return;
  }
  running.proc.stdin.write(cmd + "\n");
  void persistConsoleLine(serverId, cmd, "user");
}

export async function shutdownAll() {
  log.info("shutting down all servers", { count: procs.size });
  await Promise.all([...procs.keys()].map((id) => stopServer(id)));
}
