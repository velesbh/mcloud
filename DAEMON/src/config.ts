import "dotenv/config";
import os from "os";

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

export const config = {
  nodeId: required("NODE_ID"),
  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  serversDir: optional("SERVERS_DIR", "/var/lib/mcloud/servers"),
  javaBin: optional("JAVA_BIN", "java"),
  bedrockBin: optional("BEDROCK_BIN", ""),
  logLevel: (optional("LOG_LEVEL", "info")) as "debug" | "info" | "warn" | "error",

  // Node registration details — used for upsert on startup
  nodeName: optional("NODE_NAME", os.hostname()),
  nodeFqdn: optional("NODE_FQDN", os.hostname()),
  nodeIp: optional("NODE_IP", detectIp()),
  nodeRegionId: process.env.NODE_REGION_ID ?? null,
  nodeTotalRamMb: parseInt(optional("NODE_TOTAL_RAM_MB", String(Math.floor(os.totalmem() / 1024 / 1024)))),
  nodeTotalCpu: parseInt(optional("NODE_TOTAL_CPU", String(os.cpus().length * 100))),
  nodeTotalDiskMb: parseInt(optional("NODE_TOTAL_DISK_MB", "102400")),
  nodeOverallocationPercent: parseInt(optional("NODE_OVERALLOCATION_PERCENT", "100")),
};

export type Config = typeof config;
