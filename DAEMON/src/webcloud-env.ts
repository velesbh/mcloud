import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { wcSupabase } from "./webcloud-supabase.js";
import { wcConfig } from "./webcloud-config.js";
import { log } from "./logger.js";

/**
 * Env vars are stored encrypted in `webcloud.env_vars.value_encrypted` as
 * `<iv-hex>:<tag-hex>:<ciphertext-hex>`. Same scheme as the Next.js API
 * uses on write.
 */
function decryptValue(payload: string): string | null {
  if (!wcConfig.envEncryptionKeyHex) {
    log.error("WEBCLOUD_ENV_ENCRYPTION_KEY missing — cannot decrypt env vars");
    return null;
  }
  const [ivHex, tagHex, ctHex] = payload.split(":");
  if (!ivHex || !tagHex || !ctHex) return null;
  try {
    const key = Buffer.from(wcConfig.envEncryptionKeyHex, "hex");
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const ct = Buffer.from(ctHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString("utf8");
  } catch (err) {
    log.error("env decrypt failed", { err: (err as Error).message });
    return null;
  }
}

/**
 * Load + decrypt all env vars for a project and write them to `.env` inside
 * the deployment's workspace dir, ready to be bind-mounted into the build /
 * runtime container. Returns the .env path (or empty string if no vars).
 */
export async function writeEnvFile(projectId: string, deploymentId: string): Promise<string> {
  const { data, error } = await wcSupabase
    .from("env_vars")
    .select("key, value_encrypted")
    .eq("project_id", projectId);
  if (error) {
    log.error("env_vars fetch failed", { error: error.message });
    return "";
  }
  if (!data?.length) return "";

  const lines: string[] = [];
  for (const row of data) {
    const v = decryptValue(row.value_encrypted as string);
    if (v === null) continue;
    // Quote values containing whitespace or special chars
    const escaped = v.replace(/\n/g, "\\n").replace(/"/g, '\\"');
    lines.push(`${row.key}="${escaped}"`);
  }

  const dir = wcConfig.deploymentDir(deploymentId);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, ".env");
  await fs.writeFile(filePath, lines.join("\n") + "\n", { mode: 0o600 });
  return filePath;
}

/**
 * Build the `--env KEY=VALUE` arg list for `docker run`. Same content as the
 * `.env` file, but inlined so build containers can see vars without mounting
 * the file (some build tools expect process.env, not dotenv).
 */
export async function envDockerArgs(projectId: string): Promise<string[]> {
  const { data } = await wcSupabase
    .from("env_vars")
    .select("key, value_encrypted")
    .eq("project_id", projectId);
  const args: string[] = [];
  for (const row of data ?? []) {
    const v = decryptValue(row.value_encrypted as string);
    if (v === null) continue;
    args.push("-e", `${row.key}=${v}`);
  }
  return args;
}
