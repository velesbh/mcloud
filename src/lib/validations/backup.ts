import { z } from "zod";

export const createBackupSchema = z.object({
  name: z
    .string()
    .min(1, "Backup name is required")
    .max(64, "Name must be at most 64 characters"),
});

export type CreateBackupInput = z.infer<typeof createBackupSchema>;
