import { spawn, execSync } from "node:child_process";
import { wcConfig } from "./webcloud-config.js";
import type { DeploymentLogger } from "./webcloud-logs.js";

/**
 * WebCloud container helpers.
 *
 * Two phases per deployment:
 *   1. **build**: ephemeral container that installs deps and produces a
 *      build artifact (e.g. `npm run build` → `.next/` or `dist/`).
 *   2. **runtime**: long-lived container that serves the artifact, bound to
 *      `127.0.0.1:<host_port>`. Pangolin (or Traefik) terminates TLS on the
 *      public hostname and forwards through the WireGuard tunnel to that
 *      port.
 *
 * Container names follow `wc-build-<deploymentId>` and `wc-run-<projectId>`
 * so a deploy can find + kill the predecessor when it succeeds.
 */

export function buildContainerName(deploymentId: string): string {
  return `wc-build-${deploymentId}`;
}
export function runtimeContainerName(projectId: string): string {
  return `wc-run-${projectId}`;
}

export function removeContainer(name: string): void {
  try {
    execSync(`docker rm -f ${name}`, { stdio: "ignore", timeout: 5000 });
  } catch { /* not running */ }
}

export function stopContainer(name: string, timeoutSec = 10): void {
  try {
    execSync(`docker stop -t ${timeoutSec} ${name}`, {
      stdio: "ignore",
      timeout: (timeoutSec + 5) * 1000,
    });
  } catch { /* already gone */ }
}

export async function ensureImage(image: string, logger: DeploymentLogger): Promise<boolean> {
  try {
    execSync(`docker image inspect ${image}`, { stdio: "ignore", timeout: 5000 });
    return true;
  } catch { /* needs pull */ }

  logger.emit(`Pulling ${image}…`, "system");
  return await new Promise((resolve) => {
    const proc = spawn("docker", ["pull", image]);
    proc.stdout.on("data", (b: Buffer) => streamLines(b, (l) => logger.emit(l, "build")));
    proc.stderr.on("data", (b: Buffer) => streamLines(b, (l) => logger.emit(l, "build")));
    proc.on("exit", (code) => resolve(code === 0));
  });
}

function streamLines(buf: Buffer, onLine: (l: string) => void) {
  for (const raw of buf.toString("utf8").split("\n")) {
    const line = raw.replace(/\r$/, "").trim();
    if (line) onLine(line);
  }
}

export interface RunBuildOpts {
  deploymentId: string;
  image: string;
  workspaceVolume: string; // host path mounted at /workspace
  envArgs: string[];
  script: string; // shell pipeline: install && build
  logger: DeploymentLogger;
}

/**
 * Run an ephemeral build container. Streams stdout/stderr line-by-line to the
 * deployment logger and resolves with the exit code. Hard timeout kills the
 * container so a runaway build can't hold the slot forever.
 */
export function runBuildContainer(opts: RunBuildOpts): Promise<number> {
  return new Promise((resolve) => {
    const name = buildContainerName(opts.deploymentId);
    removeContainer(name);

    const args = [
      "run", "--rm", "--name", name,
      "-v", `${opts.workspaceVolume}:/workspace`,
      "-w", "/workspace",
      "--memory", "2g",
      "--cpus", "2",
      ...opts.envArgs,
      opts.image,
      "sh", "-lc", opts.script,
    ];

    const proc = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });
    const t = setTimeout(() => {
      opts.logger.emit(`Build timeout after ${wcConfig.buildTimeoutSec}s — killing container`, "error");
      try { execSync(`docker kill ${name}`, { stdio: "ignore" }); } catch { /* ignore */ }
    }, wcConfig.buildTimeoutSec * 1000);

    proc.stdout.on("data", (b: Buffer) => streamLines(b, (l) => opts.logger.emit(l, "build")));
    proc.stderr.on("data", (b: Buffer) => streamLines(b, (l) => opts.logger.emit(l, "build")));
    proc.on("exit", (code) => { clearTimeout(t); resolve(code ?? 1); });
  });
}

export interface RunRuntimeOpts {
  projectId: string;
  image: string;
  workspaceVolume: string;
  hostPort: number;
  containerPort: number;          // PORT env passed inside container
  envArgs: string[];
  startCmd: string;               // single shell command
  ramMb: number;
  cpuPercent: number;
}

/**
 * Start the long-lived runtime container. Returns the container name on
 * success so the caller can persist it in the deployments row.
 */
export function startRuntimeContainer(opts: RunRuntimeOpts): string {
  const name = runtimeContainerName(opts.projectId);
  // We DO NOT remove the previous container here — caller swaps the route
  // first, then removes the old one. Use a temp name during boot and rename.
  const bootName = `${name}-${Date.now()}`;

  const args = [
    "run", "-d", "--name", bootName,
    "--restart", "unless-stopped",
    "-v", `${opts.workspaceVolume}:/workspace`,
    "-w", "/workspace",
    "-p", `127.0.0.1:${opts.hostPort}:${opts.containerPort}`,
    "-e", `PORT=${opts.containerPort}`,
    "--memory", `${opts.ramMb}m`,
    "--memory-swap", `${opts.ramMb}m`,
    "--cpus", Math.max(opts.cpuPercent / 100, 0.1).toFixed(2),
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges",
    ...opts.envArgs,
    opts.image,
    "sh", "-lc", opts.startCmd,
  ];

  execSync(`docker ${args.map((a) => (/\s/.test(a) ? `'${a.replace(/'/g, "'\\''")}'` : a)).join(" ")}`, {
    stdio: "ignore",
    timeout: 30_000,
  });
  return bootName;
}

/** Atomic rename: makes <bootName> the canonical <projectId> container. */
export function promoteRuntime(bootName: string, projectId: string): void {
  const canonical = runtimeContainerName(projectId);
  // Remove any prior occupant of the canonical name (the previous deploy)
  removeContainer(canonical);
  try {
    execSync(`docker rename ${bootName} ${canonical}`, { stdio: "ignore", timeout: 5000 });
  } catch { /* if rename fails, the boot container still works under its temp name */ }
}
