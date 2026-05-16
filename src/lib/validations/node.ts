import { z } from "zod";

export const createNodeSchema = z.object({
  name: z.string().min(2).max(64),
  region_id: z.string().uuid().nullable().optional(),
  fqdn: z.string().optional(),          // optional — defaults to IP if not set
  ip: z.string().regex(/^(\d{1,3}\.){3}\d{1,3}$/, "Enter a valid IP address"),
  total_ram_mb: z.number().int().min(512),
  total_cpu: z.number().int().min(100),
  total_disk_mb: z.number().int().min(1024),
  memory_overcommit_percent: z.number().int().min(0).max(300).optional(),
  overallocation_percent: z.number().int().min(50).max(400).optional(),
  is_public: z.boolean().optional(),
  status: z.string().optional(),
  last_seen_at: z.string().optional(),
  running_count: z.number().int().optional(),
}).transform((d) => ({ ...d, fqdn: d.fqdn || d.ip }));

export type CreateNodeInput = z.infer<typeof createNodeSchema>;
