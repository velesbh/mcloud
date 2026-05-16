import { z } from "zod";

export const createNodeSchema = z.object({
  name: z.string().min(2).max(64),
  region_id: z.string().uuid("Select a region"),
  fqdn: z.string().min(3),
  ip: z.ipv4("Enter a valid IP address"),
  total_ram_mb: z.number().int().min(512),
  total_cpu: z.number().int().min(100),
  total_disk_mb: z.number().int().min(1024),
  memory_overcommit_percent: z.number().int().min(0).max(300).optional(),
  overallocation_percent: z.number().int().min(50).max(400).optional(),
  is_public: z.boolean().optional(),
});

export type CreateNodeInput = z.infer<typeof createNodeSchema>;
