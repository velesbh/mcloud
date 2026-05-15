export const FREE_TIER = {
  MAX_SERVERS: parseInt(process.env.FREE_TIER_MAX_SERVERS ?? "1"),
  RAM_MB: parseInt(process.env.FREE_TIER_RAM_MB ?? "1024"),
  DISK_MB: parseInt(process.env.FREE_TIER_DISK_MB ?? "5120"),
  CPU_PERCENT: parseInt(process.env.FREE_TIER_CPU_PERCENT ?? "100"),
} as const;

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@enzonic.com";

export const MC_JAVA_VERSIONS = [
  "1.21.4",
  "1.21.3",
  "1.21.1",
  "1.20.6",
  "1.20.4",
  "1.20.2",
  "1.19.4",
  "1.18.2",
  "1.17.1",
  "1.16.5",
  "1.12.2",
  "1.8.9",
] as const;

export const MC_BEDROCK_VERSIONS = [
  "1.21.50",
  "1.21.44",
  "1.21.30",
] as const;

export const JAVA_LOADERS = [
  { id: "vanilla", label: "Vanilla", desc: "Pure Minecraft" },
  { id: "paper", label: "Paper", desc: "Fast & stable plugins" },
  { id: "spigot", label: "Spigot", desc: "Classic plugins" },
  { id: "fabric", label: "Fabric", desc: "Lightweight mods" },
  { id: "forge", label: "Forge", desc: "Full mod support" },
  { id: "neoforge", label: "NeoForge", desc: "Modern Forge fork" },
  { id: "quilt", label: "Quilt", desc: "Fabric fork" },
] as const;

export const BEDROCK_LOADERS = [
  { id: "bedrock", label: "Bedrock", desc: "Official Bedrock server" },
] as const;

export const SERVER_STATUS_LABELS: Record<string, string> = {
  creating: "Creating",
  offline: "Offline",
  starting: "Starting",
  running: "Online",
  stopping: "Stopping",
  restarting: "Restarting",
  error: "Error",
  suspended: "Suspended",
};

export const MODRINTH_PROJECT_TYPES = [
  { id: "mod", label: "Mod" },
  { id: "plugin", label: "Plugin" },
  { id: "modpack", label: "Modpack" },
  { id: "datapack", label: "Datapack" },
] as const;
