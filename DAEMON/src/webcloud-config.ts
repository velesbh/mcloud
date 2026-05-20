import "dotenv/config";
import path from "node:path";

/**
 * WebCloud-specific config. Lives next to the MCloud config so a single daemon
 * process can serve both products. All envs are optional with sensible
 * defaults — WebCloud features stay dormant if not configured.
 */
function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const wcConfig = {
  /** Root for build workspaces and runtime asset dirs. */
  workspaceDir: optional("WEBCLOUD_WORKSPACE_DIR", "/var/lib/webcloud"),
  /** Where a single deployment's source + build output is staged. */
  deploymentDir(deploymentId: string) {
    return path.join(this.workspaceDir, "deployments", deploymentId);
  },
  /**
   * 32-byte hex key for AES-256-GCM env var encryption. Same key as the
   * Next.js API uses to encrypt values on write. If unset, env-var decryption
   * fails fast — the deployment is marked errored rather than silently
   * starting a container with no env.
   */
  envEncryptionKeyHex: process.env.WEBCLOUD_ENV_ENCRYPTION_KEY ?? "",
  /** Subdomain suffix appended to project slugs for default routing. */
  subdomainBase: optional("WEBCLOUD_SUBDOMAIN_BASE", "enzonic.online"),
  /** Default host-port range to seed on first daemon start. */
  portRangeStart: parseInt(optional("WEBCLOUD_PORT_START", "40000"), 10),
  portRangeEnd: parseInt(optional("WEBCLOUD_PORT_END", "49999"), 10),
  /** Maximum number of seconds a build container may run before SIGKILL. */
  buildTimeoutSec: parseInt(optional("WEBCLOUD_BUILD_TIMEOUT_SEC", "1200"), 10),
};
