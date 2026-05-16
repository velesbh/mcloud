import "dotenv/config";
import os from "os";
import fs from "fs";
import path from "path";
import crypto from "crypto";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

// Detect primary non-loopback IP
function detectIp(): string {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const addr of iface ?? []) {
      if (addr.family === "IPv4" && !addr.internal) return addr.address;
    }
  }
  return "127.0.0.1";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve the node UUID:
 *  1. Use NODE_ID env var if it's already a valid UUID.
 *  2. Otherwise load from the state file (persists across restarts).
 *  3. Generate a fresh UUID v4 and write it to the state file.
 *
 * The state file lives at $STATE_DIR/node-id (default /var/lib/mcloud/node-id).
 */
function resolveNodeId(): string {
  const envId = process.env.NODE_ID;
  if (envId && UUID_RE.test(envId)) return envId;

  const stateDir = process.env.STATE_DIR ?? "/var/lib/mcloud";
  const stateFile = path.join(stateDir, "node-id");

  // Try to read existing persisted UUID
  try {
    const existing = fs.readFileSync(stateFile, "utf8").trim();
    if (UUID_RE.test(existing)) return existing;
  } catch {
    // file doesn't exist yet — generate one below
  }

  // Generate + persist
  const newId = crypto.randomUUID();
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(stateFile, newId, "utf8");
  } catch (err) {
    // Non-fatal: can't write state dir (e.g. dev mode), just use the generated id
    console.warn(`[WARN] Could not persist node-id to ${stateFile}: ${(err as Error).message}`);
  }

  return newId;
}

export const config = {
  nodeId: resolveNodeId(),
  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  serversDir: optional("SERVERS_DIR", "/var/lib/mcloud/servers"),
  javaBin: optional("JAVA_BIN", "java"),
  bedrockBin: optional("BEDROCK_BIN", ""),
  logLevel: (optional("LOG_LEVEL", "info")) as "debug" | "info" | "warn" | "error",

  // Node registration details — used for upsert on startup
  nodeName: optional("NODE_NAME", os.hostname()),
  nodeIp: optional("NODE_IP", detectIp()),
  get nodeFqdn() { return optional("NODE_FQDN", this.nodeIp); },
  nodeRegionId: process.env.NODE_REGION_ID ?? null,
  nodeTotalRamMb: parseInt(optional("NODE_TOTAL_RAM_MB", String(Math.floor(os.totalmem() / 1024 / 1024)))),
  nodeTotalCpu: parseInt(optional("NODE_TOTAL_CPU", String(os.cpus().length * 100))),
  nodeTotalDiskMb: parseInt(optional("NODE_TOTAL_DISK_MB", "102400")),
  nodeOverallocationPercent: parseInt(optional("NODE_OVERALLOCATION_PERCENT", "100")),
};

export type Config = typeof config;
