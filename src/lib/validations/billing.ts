import { z } from "zod";

export const billingPlanSchema = z.object({
  plan_key: z
    .string()
    .min(1, "Required")
    .max(64)
    .regex(/^[a-zA-Z0-9_:-]+$/, "Letters, numbers, _, -, : only"),
  clerk_plan_id: z.string().max(255).optional().nullable(),
  name: z.string().min(1).max(64),
  description: z.string().max(500).optional().nullable(),
  monthly_price_usd: z.number().min(0).max(100000).optional().nullable(),
  max_servers: z.number().int().min(1).max(1000),
  max_ram_mb: z.number().int().min(256).max(524288),
  max_disk_mb: z.number().int().min(512).max(10485760),
  max_cpu_percent: z.number().int().min(10).max(6400),
  features: z.array(z.string().max(120)).optional(),
  sort_order: z.number().int().min(0).max(10000).optional(),
  is_visible: z.boolean().optional(),
  is_highlighted: z.boolean().optional(),
});

export type BillingPlanInput = z.infer<typeof billingPlanSchema>;
