import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { log } from "./logger.js";
import { supabase } from "./supabase.js";
import { broadcastConsole, persistConsoleLine } from "./console-bridge.js";

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
}

/**
 * Locate (or hint that we need) the server jar for a given loader+version.
 * Real impl would download from Mojang/PaperMC/etc. For now we expect
 * the file to be pre-staged.
 */
function jarFor(loader: string, version: string): string {
  // Convention: <SERVERS_DIR>/_jars/{loader}-{version}.jar
  return path.join(config.serversDir, "_jars", `${loader}-${version}.jar`);
}

export async function startServer(serverId: string) {
  if (procs.has(serverId)) {
    log.warn("startServer: already running", { serverId });
    return;
  }

  const { data: srv, error } = await supabase
    .from("servers")
    .select("id, name, edition, game_version, loader, ram_mb, max_players, motd")
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

  // Write server.properties (simple version)
  const props = [
    `motd=${srv.motd ?? srv.name}`,
    `max-players=${srv.max_players ?? 20}`,
    `online-mode=true`,
    `enable-rcon=false`,
  ].join("\n");
  await writeFile(path.join(dir, "server.properties"), props, "utf8");

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
    const jar = jarFor(srv.loader, srv.game_version);
    cmd = config.javaBin;
    const xmx = `-Xmx${srv.ram_mb}M`;
    const xms = `-Xms${Math.floor(srv.ram_mb / 2)}M`;
    args = [xmx, xms, "-jar", jar, "nogui"];
  }

  const proc = spawn(cmd, args, { cwd: dir });

  proc.stdout.on("data", (b) => {
    const text = b.toString("utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.replace(/\r$/, "");
      if (!trimmed) continue;
      void broadcastConsole(serverId, trimmed, "server");
      void persistConsoleLine(serverId, trimmed, "server");
    }
  });

  proc.stderr.on("data", (b) => {
    const text = b.toString("utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.replace(/\r$/, "");
      if (!trimmed) continue;
      void broadcastConsole(serverId, trimmed, "server");
      void persistConsoleLine(serverId, trimmed, "server");
    }
  });

  proc.on("spawn", () => {
    log.info("server spawned", { serverId, pid: proc.pid });
    // Wait a beat for jar to fully boot, then mark running
    setTimeout(async () => {
      if (procs.has(serverId)) {
        await setStatus(serverId, "running");
        await broadcastConsole(serverId, "> Server is online", "system");
      }
    }, 2000);
  });

  proc.on("exit", async (code, signal) => {
    log.info("server exited", { serverId, code, signal });
    procs.delete(serverId);
    await setStatus(serverId, "offline");
    await broadcastConsole(serverId, `> Server stopped (code=${code ?? "?"})`, "system");
  });

  procs.set(serverId, { serverId, proc, startedAt: new Date() });
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
