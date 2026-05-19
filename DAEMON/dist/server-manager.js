import { spawn } from "node:child_process";
import { mkdir, writeFile, access, rm } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { log } from "./logger.js";
import { supabase } from "./supabase.js";
import { broadcastConsole, broadcastServerStatus, persistConsoleLine } from "./console-bridge.js";
import { ensureJar } from "./jar-manager.js";
import { installJava, requiredJavaMajor, javaBinForMajor } from "./java-installer.js";
import { installModpack } from "./modpack-installer.js";
import { dockerAvailable, ensureImage, imageForJava, killContainer, removeContainer, containerName, spawnDockerJava, stopContainer, } from "./docker-runner.js";
const procs = new Map();
export function getRunning() {
    return procs;
}
async function ensureServerDir(serverId) {
    const dir = path.join(config.serversDir, serverId);
    await mkdir(dir, { recursive: true });
    return dir;
}
async function ensureEula(dir) {
    const eula = path.join(dir, "eula.txt");
    try {
        await access(eula);
    }
    catch {
        await writeFile(eula, "eula=true\n", "utf8");
    }
}
/**
 * Minecraft writes session.lock to the world directory when running.
 * If a previous process crashed/was killed, the lock survives and blocks
 * the next start. We delete all session.lock files before launching.
 */
async function clearSessionLocks(dir) {
    // Walk the entire server directory and delete every session.lock found.
    // This handles custom world names and nested dimension directories.
    const { readdir, stat } = await import("node:fs/promises");
    async function walk(d, depth = 0) {
        if (depth > 6)
            return; // safety limit
        let entries;
        try {
            entries = await readdir(d);
        }
        catch {
            return;
        }
        await Promise.all(entries.map(async (name) => {
            const full = path.join(d, name);
            if (name === "session.lock") {
                await rm(full, { force: true });
                log.info("cleared session.lock", { path: full });
            }
            else {
                try {
                    const s = await stat(full);
                    if (s.isDirectory())
                        await walk(full, depth + 1);
                }
                catch { /* ignore */ }
            }
        }));
    }
    await walk(dir);
}
async function setStatus(serverId, status) {
    await supabase
        .from("servers")
        .update({ status, last_active_at: new Date().toISOString() })
        .eq("id", serverId);
    // Push status immediately to subscribed clients — no polling delay
    void broadcastServerStatus(serverId, status);
}
// (legacy spawnServer removed — replaced by spawnDockerised / spawnDirect)
export async function startServer(serverId) {
    if (procs.has(serverId)) {
        log.warn("startServer: already running", { serverId });
        return;
    }
    // FK hint required — two FK paths exist between servers↔allocations.
    // Use the column-name hint (!allocation_id) which references the FK on the servers side.
    const { data: srv, error } = await supabase
        .from("servers")
        .select("id, name, edition, game_version, loader, ram_mb, cpu_percent, max_players, motd, allocation_id, modpack_url, modpack_installed, env_vars, allocations!allocation_id(local_ip, port)")
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
    await clearSessionLocks(dir);
    // Install modpack on first start (if URL set and not yet installed)
    const srvWithModpack = srv;
    if (srvWithModpack.modpack_url && !srvWithModpack.modpack_installed) {
        try {
            await installModpack(serverId, srvWithModpack.modpack_url);
        }
        catch (err) {
            log.error("modpack install failed", { serverId, err: String(err) });
            await broadcastConsole(serverId, `[modpack] Install failed: ${String(err)}`, "system");
            await setStatus(serverId, "error");
            return;
        }
    }
    // Resolve bind address + port from allocation (fall back to 0.0.0.0:25565)
    const alloc = Array.isArray(srv.allocations)
        ? srv.allocations[0]
        : srv.allocations;
    const bindIp = alloc?.local_ip ?? "0.0.0.0";
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
    if (srv.edition === "bedrock") {
        if (!config.bedrockBin) {
            await broadcastConsole(serverId, "[error] BEDROCK_BIN not configured on daemon", "system");
            await setStatus(serverId, "error");
            return;
        }
        // Bedrock still runs directly (binary not available as an official image)
        await spawnDirect(serverId, config.bedrockBin, [], dir, srv.game_version);
        return;
    }
    // ── Java path: containerised ────────────────────────────────────────
    const envVars = srv.env_vars ?? {};
    const customJar = typeof envVars.startup_jar === "string" && envVars.startup_jar.trim()
        ? envVars.startup_jar.trim()
        : null;
    // Resolve the jar (relative to the container's /data, which is the server dir)
    let jarRel;
    if (customJar) {
        jarRel = customJar;
        await broadcastConsole(serverId, `> Using custom jar: ${customJar}`, "system");
    }
    else {
        try {
            await broadcastConsole(serverId, `> Fetching ${srv.loader} ${srv.game_version} jar...`, "system");
            const jarAbs = await ensureJar(srv.loader, srv.game_version);
            // Copy/link the jar into the server dir so it's reachable inside the container
            const dest = path.join(dir, "server.jar");
            try {
                await rm(dest, { force: true });
            }
            catch { /* ignore */ }
            await import("node:fs/promises").then((fs) => fs.copyFile(jarAbs, dest));
            jarRel = "server.jar";
        }
        catch (err) {
            log.error("jar download failed", { serverId, err });
            await broadcastConsole(serverId, `[error] Failed to download server jar: ${String(err)}`, "system");
            await setStatus(serverId, "error");
            return;
        }
    }
    // Choose Java major: env_vars.java_version overrides game-version default
    const requestedJavaMajor = typeof envVars.java_version === "string" && envVars.java_version.trim()
        ? parseInt(envVars.java_version.trim(), 10)
        : null;
    const javaMajor = requestedJavaMajor && !isNaN(requestedJavaMajor)
        ? requestedJavaMajor
        : requiredJavaMajor(srv.game_version);
    const xmx = `-Xmx${srv.ram_mb}M`;
    const xms = `-Xms${Math.floor(srv.ram_mb / 2)}M`;
    const javaArgs = [xmx, xms, "-jar", jarRel, "nogui"];
    // ── Containerised path (preferred) ────────────────────────────────
    if (dockerAvailable()) {
        const image = imageForJava(javaMajor);
        const ok = await ensureImage(image, (line) => {
            void broadcastConsole(serverId, `[docker] ${line}`, "system");
        });
        if (ok) {
            await broadcastConsole(serverId, `> Starting in container: ${image} (Java ${javaMajor})`, "system");
            await spawnDockerised(serverId, dir, image, srv.ram_mb, srv.cpu_percent ?? 100, javaArgs, srv.game_version);
            return;
        }
        await broadcastConsole(serverId, `[warn] Failed to pull ${image} — falling back to host Java`, "system");
    }
    // ── Legacy host-Java path (backwards-compat for nodes without Docker) ──
    await broadcastConsole(serverId, `> Docker not available — using host Java ${javaMajor}`, "system");
    let resolvedJava = javaBinForMajor(javaMajor);
    if (resolvedJava === "java") {
        await broadcastConsole(serverId, `> Java ${javaMajor} not found — installing via apt...`, "system");
        const installed = await installJava(srv.game_version, serverId, javaMajor);
        if (!installed) {
            await broadcastConsole(serverId, `[error] Failed to install Java ${javaMajor}. Install Docker (apt-get install -y docker.io) or Java manually.`, "system");
            await setStatus(serverId, "error");
            return;
        }
        resolvedJava = javaBinForMajor(javaMajor);
        if (resolvedJava === "java")
            resolvedJava = config.javaBin || "java";
    }
    await broadcastConsole(serverId, `> Using Java ${javaMajor}: ${resolvedJava}`, "system");
    // Jar inside the host dir — pass absolute path
    const hostJarArgs = [xmx, xms, "-jar", path.join(dir, jarRel), "nogui"];
    await spawnDirect(serverId, resolvedJava, hostJarArgs, dir, srv.game_version);
}
/**
 * Wire up stdout/stderr/event handlers around a `docker run` child process.
 */
async function spawnDockerised(serverId, dir, image, ramMb, cpuPercent, javaArgs, gameVersion) {
    const proc = spawnDockerJava({
        serverId,
        hostDir: dir,
        image,
        ramMb,
        cpuPercent,
        javaArgs,
    });
    attachProcHandlers(serverId, proc, gameVersion, /* isDocker */ true);
}
/** Spawn a non-container process (Bedrock fallback). */
async function spawnDirect(serverId, cmd, args, cwd, gameVersion) {
    const proc = spawn(cmd, args, { cwd });
    attachProcHandlers(serverId, proc, gameVersion, /* isDocker */ false);
}
/** Common stdout/stderr/exit wiring shared by docker and direct spawns. */
function attachProcHandlers(serverId, proc, gameVersion, isDocker) {
    void gameVersion; // kept for symmetry / future use
    let markedRunning = false;
    async function markRunning() {
        if (markedRunning)
            return;
        markedRunning = true;
        await setStatus(serverId, "running");
        await broadcastConsole(serverId, "> Server is online", "system");
    }
    proc.stdout?.on("data", (b) => {
        const text = b.toString("utf8");
        for (const line of text.split("\n")) {
            const trimmed = line.replace(/\r$/, "");
            if (!trimmed)
                continue;
            void broadcastConsole(serverId, trimmed, "server");
            void persistConsoleLine(serverId, trimmed, "server");
            if (!markedRunning && trimmed.includes("Done (") && trimmed.includes("For help")) {
                void markRunning();
            }
        }
    });
    proc.stderr?.on("data", (b) => {
        const text = b.toString("utf8");
        for (const line of text.split("\n")) {
            const trimmed = line.replace(/\r$/, "");
            if (!trimmed)
                continue;
            void broadcastConsole(serverId, trimmed, "server");
            void persistConsoleLine(serverId, trimmed, "server");
        }
    });
    proc.on("error", async (err) => {
        procs.delete(serverId);
        log.error("server process error", { serverId, err: err.message });
        await broadcastConsole(serverId, `[error] ${err.message}`, "system");
        await setStatus(serverId, "error");
    });
    proc.on("spawn", () => {
        log.info("server spawned", { serverId, pid: proc.pid, isDocker });
        procs.set(serverId, { serverId, proc, startedAt: new Date() });
    });
    proc.on("exit", async (code, signal) => {
        log.info("server exited", { serverId, code, signal, isDocker });
        procs.delete(serverId);
        if (isDocker)
            removeContainer(containerName(serverId));
        await setStatus(serverId, "offline");
        await broadcastConsole(serverId, `> Server stopped (code=${code ?? signal ?? "?"})`, "system");
    });
    // Register immediately so the kill handler can find the proc
    procs.set(serverId, { serverId, proc, startedAt: new Date() });
}
export async function stopServer(serverId) {
    const running = procs.get(serverId);
    if (!running) {
        log.warn("stopServer: not running", { serverId });
        await setStatus(serverId, "offline");
        // Belt-and-braces: if a container is somehow still around, remove it
        removeContainer(containerName(serverId));
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
            stopContainer(serverId, 5);
            running.proc.kill("SIGKILL");
        }
    }, 30_000);
}
/** Force-kill — used by the admin "Kill" button. Stops container + process. */
export async function killServerProc(serverId) {
    const running = procs.get(serverId);
    killContainer(serverId);
    if (running) {
        try {
            running.proc.kill("SIGKILL");
        }
        catch { /* already dead */ }
    }
}
export async function restartServer(serverId) {
    await stopServer(serverId);
    // wait for exit
    let waited = 0;
    while (procs.has(serverId) && waited < 35_000) {
        await new Promise((r) => setTimeout(r, 500));
        waited += 500;
    }
    await startServer(serverId);
}
export async function sendConsoleCommand(serverId, cmd) {
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
//# sourceMappingURL=server-manager.js.map