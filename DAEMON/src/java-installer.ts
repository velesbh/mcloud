import { spawn, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { log } from "./logger.js";
import { broadcastConsole } from "./console-bridge.js";

/**
 * Returns the minimum Java major version required for a given Minecraft version.
 *
 * Java 21 — 1.20.5+
 * Java 17 — 1.17 – 1.20.4
 * Java 8  — ≤ 1.16
 */
export function requiredJavaMajor(gameVersion: string): number {
  const [maj, min] = gameVersion.split(".").map(Number);
  if (maj > 1 || (maj === 1 && min >= 21)) return 21;
  if (maj === 1 && min >= 17) return 17;
  return 8;
}

/**
 * Returns the path to the java binary for a given major version.
 * Checks known paths first, then falls back to `find /usr/lib/jvm`
 * so it works regardless of architecture or package naming.
 */
export function javaBinForMajor(major: number): string {
  const candidates = [
    `/usr/lib/jvm/java-${major}-openjdk-amd64/bin/java`,
    `/usr/lib/jvm/java-${major}-openjdk-arm64/bin/java`,
    `/usr/lib/jvm/java-${major}-openjdk/bin/java`,
    `/usr/lib/jvm/temurin-${major}/bin/java`,
    `/usr/lib/jvm/temurin-${major}-amd64/bin/java`,
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  // Last resort: ask the filesystem directly
  try {
    const found = execSync(
      `find /usr/lib/jvm -name "java" -path "*java-${major}*" -type f 2>/dev/null | head -1`,
      { encoding: "utf8", timeout: 5000 }
    ).trim();
    if (found) return found;
  } catch { /* ignore */ }
  return "java";
}

/** Debian/Ubuntu package name for a given Java major version. */
function javaPackage(major: number): string {
  const known: Record<number, string> = {
    8:  "openjdk-8-jre-headless",
    11: "openjdk-11-jre-headless",
    17: "openjdk-17-jre-headless",
    21: "openjdk-21-jre-headless",
    25: "openjdk-25-jre-headless",
  };
  return known[major] ?? `openjdk-${major}-jre-headless`;
}

/**
 * Run a shell command and stream every output line through `onLine`.
 * Resolves with the exit code.
 */
function runStreamed(
  cmd: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  onLine: (line: string) => void
): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { env });

    function feed(buf: Buffer) {
      const text = buf.toString("utf8");
      for (const raw of text.split("\n")) {
        const line = raw.replace(/\r$/, "").trim();
        if (line) onLine(line);
      }
    }

    proc.stdout.on("data", feed);
    proc.stderr.on("data", feed);

    proc.on("error", (err) => {
      onLine(`[installer-error] ${err.message}`);
      resolve(1);
    });

    proc.on("exit", (code) => resolve(code ?? 1));
  });
}

/**
 * Installs the correct Java JRE for `gameVersion` via apt-get and streams
 * every output line to the given server's console channel.
 *
 * Returns `true` on success, `false` on failure.
 */
export async function installJava(
  gameVersion: string,
  serverId: string,
  overrideMajor?: number
): Promise<boolean> {
  const major = overrideMajor ?? requiredJavaMajor(gameVersion);
  const pkg   = javaPackage(major);

  log.info("auto-installing java", { major, pkg, serverId });

  const emit = async (line: string) => {
    void broadcastConsole(serverId, `[installer] ${line}`, "system");
  };

  await emit(`Java ${major} not found — installing ${pkg} via apt-get...`);

  const env = { ...process.env, DEBIAN_FRONTEND: "noninteractive" };

  // Step 1: apt-get update
  await emit("Running: apt-get update");
  const updateCode = await runStreamed(
    "apt-get", ["update", "-qq"],
    env,
    (l) => void emit(l)
  );
  if (updateCode !== 0) {
    await emit(`apt-get update failed (code ${updateCode}). Is the daemon running as root?`);
    return false;
  }

  // Step 2: apt-get install
  await emit(`Running: apt-get install -y ${pkg}`);
  const installCode = await runStreamed(
    "apt-get", ["install", "-y", pkg],
    env,
    (l) => void emit(l)
  );
  if (installCode !== 0) {
    await emit(`apt-get install failed (code ${installCode}).`);
    return false;
  }

  await emit(`Java ${major} installed successfully.`);
  log.info("java installed", { major, pkg });
  return true;
}
