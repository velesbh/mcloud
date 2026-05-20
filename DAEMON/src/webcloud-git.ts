import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { wcConfig } from "./webcloud-config.js";
import type { DeploymentLogger } from "./webcloud-logs.js";

/**
 * Clone a repo into the deployment's workspace dir.
 *
 * We use a throwaway `alpine/git` container so the daemon host doesn't need
 * git installed and the clone is sandboxed (no `.gitconfig` from the daemon
 * user leaks in). When `installToken` is provided it's injected into the URL
 * as a basic-auth username — works for both GitHub App installation tokens
 * (`x-access-token:<token>@github.com`) and personal access tokens.
 */
export async function cloneRepo(opts: {
  deploymentId: string;
  repoUrl: string;
  branch: string;
  installToken?: string;
  logger: DeploymentLogger;
}): Promise<{ workspaceDir: string; ok: boolean }> {
  const workspaceDir = wcConfig.deploymentDir(opts.deploymentId);
  // Clean any prior attempt first
  await fs.rm(workspaceDir, { recursive: true, force: true });
  await fs.mkdir(workspaceDir, { recursive: true });

  let url = opts.repoUrl;
  if (opts.installToken) {
    url = url.replace(/^https:\/\//, `https://x-access-token:${opts.installToken}@`);
  }

  opts.logger.emit(`Cloning ${opts.repoUrl} @ ${opts.branch}…`, "system");

  const ok = await new Promise<boolean>((resolve) => {
    const proc = spawn("docker", [
      "run", "--rm",
      "-v", `${workspaceDir}:/workspace`,
      "-w", "/workspace",
      "alpine/git",
      "clone", "--depth", "1", "--branch", opts.branch, url, ".",
    ], { stdio: ["ignore", "pipe", "pipe"] });

    proc.stdout.on("data", (b: Buffer) => streamLines(b, (l) => opts.logger.emit(l, "build")));
    proc.stderr.on("data", (b: Buffer) =>
      streamLines(b, (l) => opts.logger.emit(redact(l, opts.installToken), "build")));
    proc.on("exit", (code) => resolve(code === 0));
  });

  return { workspaceDir, ok };
}

function streamLines(buf: Buffer, onLine: (l: string) => void) {
  for (const raw of buf.toString("utf8").split("\n")) {
    const line = raw.replace(/\r$/, "").trim();
    if (line) onLine(line);
  }
}

/** Strip the installation token if git logs it. */
function redact(line: string, token?: string): string {
  if (!token) return line;
  return line.split(token).join("***");
}
