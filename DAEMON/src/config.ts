import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export const config = {
  nodeId: required("NODE_ID"),
  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  serversDir: process.env.SERVERS_DIR ?? "/var/lib/mcloud/servers",
  javaBin: process.env.JAVA_BIN ?? "java",
  bedrockBin: process.env.BEDROCK_BIN ?? "",
  logLevel: (process.env.LOG_LEVEL ?? "info") as "debug" | "info" | "warn" | "error",
};

export type Config = typeof config;
