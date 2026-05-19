import { spawn, execSync, type ChildProcess } from "node:child_process";
import { realpathSync } from "node:fs";
import { log } from "./logger.js";

/**
 * Each Minecraft server runs inside its own Eclipse Temurin container with:
 *   - the server directory mounted at /data (resolves symlinks first)
 *   - host networking so the JVM binds to the allocated port directly
 *   - --memory / --cpus resource caps
 *   - all Linux capabilities dropped, no-new-privileges set
 *   - stdin kept open so the daemon can write "stop" / commands
 *
 * The container name `mcloud-<serverId>` makes it easy to docker stop / kill
 * / inspect from outside the daemon.
 */

const DEFAULT_JAVA_MAJOR = 21;

export function containerName(serverId: string): string {
  return `mcloud-${serverId}`;
}

/** Pick the Eclipse Temurin image tag for a given Java major. */
export function imageForJava(major: number): string {
  return `eclipse-temurin:${major}-jre`;
}

/** Check if `docker` is available on this host. */
export function dockerAvailable(): boolean {
  try {
    execSync("docker --version", { stdio: "ignore", timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

/** Remove any stale container with the given name (no-op if absent). */
export function removeContainer(name: string): void {
  try {
    execSync(`docker rm -f ${name}`, { stdio: "ignore", timeout: 5000 });
  } catch { /* not running — fine */ }
}

/**
 * Resolve the host path (following symlinks) so docker -v mounts the real
 * directory. Pterodactyl-imported servers live behind a symlink.
 */
export function resolveHostPath(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}

/** Pull image if it's not already on the host. Streams progress to `onLine`. */
export async function ensureImage(
  image: string,
  onLine: (line: string) => void
): Promise<boolean> {
  // Cheap local check first
  try {
    execSync(`docker image inspect ${image}`, { stdio: "ignore", timeout: 5000 });
    return true;
  } catch { /* not present, pull it */ }

  onLine(`Pulling ${image}...`);
  return await new Promise((resolve) => {
    const proc = spawn("docker", ["pull", image]);
    proc.stdout.on("data", (b: Buffer) => {
      for (const raw of b.toString("utf8").split("\n")) {
        const line = raw.replace(/\r$/, "").trim();
        if (line) onLine(line);
      }
    });
    proc.stderr.on("data", (b: Buffer) => {
      for (const raw of b.toString("utf8").split("\n")) {
        const line = raw.replace(/\r$/, "").trim();
        if (line) onLine(line);
      }
    });
    proc.on("error", (err) => {
      onLine(`[docker-pull-error] ${err.message}`);
      resolve(false);
    });
    proc.on("exit", (code) => resolve(code === 0));
  });
}

export interface DockerSpawnOpts {
  serverId: string;
  hostDir: string;       // server directory on the host
  image: string;         // e.g. eclipse-temurin:21-jre
  ramMb: number;
  cpuPercent: number;    // 100 = 1 core
  /** Args passed to `java` inside the container, including the -jar etc. */
  javaArgs: string[];
}

/**
 * Spawn a dockerised JVM for a server. Returns the ChildProcess for the
 * `docker run` itself — stdout/stderr/exit/stdin all behave the same as
 * before, so the rest of server-manager doesn't change.
 */
export function spawnDockerJava(opts: DockerSpawnOpts): ChildProcess {
  const name = containerName(opts.serverId);

  // Clean up any stale container from a previous crash before starting
  removeContainer(name);

  const mountSrc = resolveHostPath(opts.hostDir);
  const cpus = Math.max(opts.cpuPercent / 100, 0.1).toFixed(2);

  const args = [
    "run",
    "-i",                                 // keep stdin open
    "--rm",                               // auto-remove on exit
    "--name", name,
    "-v", `${mountSrc}:/data`,
    "-w", "/data",
    "--network", "host",                  // bind to allocated host port directly
    "--memory", `${opts.ramMb}m`,
    "--memory-swap", `${opts.ramMb}m`,    // disable swap so OOM is enforced
    "--cpus", cpus,
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges",
    opts.image,
    "java",
    ...opts.javaArgs,
  ];

  log.info("spawning docker container", { name, image: opts.image, ramMb: opts.ramMb, cpus });

  return spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });
}

/** Force-stop the container (used by Kill button). */
export function killContainer(serverId: string): void {
  const name = containerName(serverId);
  try {
    execSync(`docker kill ${name}`, { stdio: "ignore", timeout: 5000 });
  } catch {
    // already gone
  }
}

/** Graceful container stop with timeout fallback. */
export function stopContainer(serverId: string, timeoutSec = 30): void {
  const name = containerName(serverId);
  try {
    execSync(`docker stop -t ${timeoutSec} ${name}`, { stdio: "ignore", timeout: (timeoutSec + 5) * 1000 });
  } catch { /* container already gone */ }
}

export { DEFAULT_JAVA_MAJOR };
