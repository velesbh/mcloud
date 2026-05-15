import { z } from "zod";

export const createServerSchema = z.object({
  name: z
    .string()
    .min(3, "Name must be at least 3 characters")
    .max(32, "Name must be at most 32 characters")
    .regex(/^[a-zA-Z0-9 _-]+$/, "Only letters, numbers, spaces, _ and - allowed"),
  edition: z.enum(["java", "bedrock"]),
  game_version: z.string().min(1, "Select a version"),
  loader: z.enum(["vanilla", "paper", "spigot", "fabric", "forge", "neoforge", "quilt", "bedrock"]),
  region_id: z.string().uuid("Select a region").optional(),
  ram_mb: z.number().int().min(512).max(32768),
  disk_mb: z.number().int().min(1024).max(524288),
  cpu_percent: z.number().int().min(10).max(400),
  motd: z.string().max(64).optional(),
  max_players: z.number().int().min(1).max(1000).optional(),
});

export const updateServerSchema = z.object({
  name: z.string().min(3).max(32).optional(),
  motd: z.string().max(64).optional(),
  max_players: z.number().int().min(1).max(1000).optional(),
  ram_mb: z.number().int().min(512).optional(),
  cpu_percent: z.number().int().min(10).max(400).optional(),
  java_flags: z.string().max(500).optional(),
});

export type CreateServerInput = z.infer<typeof createServerSchema>;
export type UpdateServerInput = z.infer<typeof updateServerSchema>;
