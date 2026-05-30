import fs from "node:fs/promises";
import { downloadPrefix, isS3Configured } from "./s3.js";
import { wcSupabase } from "./webcloud-supabase.js";
import { wcConfig } from "./webcloud-config.js";
import { log } from "./logger.js";
import { config } from "./config.js";
import { DeploymentLogger } from "./webcloud-logs.js";
import { allocatePort, releasePort } from "./webcloud-port.js";
import { cloneRepo } from "./webcloud-git.js";
import { envDockerArgs } from "./webcloud-env.js";
import { specFor } from "./webcloud-frameworks.js";
import {
  ensureImage,
  runBuildContainer,
  startRuntimeContainer,
  promoteRuntime,
  removeContainer,
  runtimeContainerName,
} from "./webcloud-docker.js";
import { buildRoutingClient } from "./webcloud-routing.js";

/**
 * End-to-end deployment orchestrator.
 *
 * Sequence per deploy:
 *   1. Mark deployment `building`, claim it for this node (node_id, ram_mb,
 *      disk_mb so the stock view accounts for the slot).
 *   2. Allocate a free host port via the `allocate_port` RPC.
 *   3. Clone the repo into the deployment workspace.
 *   4. Run the build container (install + build script).
 *   5. Start the runtime container bound to the allocated host port.
 *   6. Health-check the port (TCP connect with retries).
 *   7. Tell the routing client to point the project's hostname at
 *      `http://<node-fqdn>:<port>`. Old route target is swapped — Pangolin
 *      keeps the cert.
 *   8. Promote the boot container to its canonical name, remove old runtime,
 *      mark deployment `active` and project `running`.
 *
 * On any failure, mark deployment `failed`, release the port, and leave the
 * existing runtime untouched so the project stays online.
 */
export async function runDeployment(deploymentId: string): Promise<void> {
  const logger = new DeploymentLogger(deploymentId);
  const started = Date.now();

  try {
    // 1. Load deployment + project + region in one go
    const { data: dep, error: depErr } = await wcSupabase
      .from("deployments")
      .select("id, project_id, branch, commit_sha")
      .eq("id", deploymentId)
      .single();
    if (depErr || !dep) throw new Error(`deployment ${deploymentId} not found: ${depErr?.message}`);

    const { data: project, error: projErr } = await wcSupabase
      .from("projects")
      .select("*")
      .eq("id", dep.project_id)
      .single();
    if (projErr || !project) throw new Error(`project ${dep.project_id} not found`);

    const { data: region } = project.region_id
      ? await wcSupabase.from("regions").select("*").eq("id", project.region_id).single()
      : { data: null };

    logger.emit(`Deploy ${deploymentId} for ${project.slug} on node ${config.nodeId}`, "system");

    // Claim the slot in the stock view
    await wcSupabase.from("deployments").update({
      status: "building",
      node_id: config.nodeId,
      ram_mb: project.ram_request_mb,
      disk_mb: project.disk_request_mb,
    }).eq("id", deploymentId);

    // 2. Port
    const hostPort = await allocatePort(deploymentId);
    if (!hostPort) throw new Error("no free host ports on this node");
    logger.emit(`Reserved host port ${hostPort}`, "system");

    // 3. Source — either S3 upload or git clone
    const branch = dep.branch ?? project.branch ?? "main";
    let workspaceDir: string;

    if (project.upload_source) {
      // File-upload project: pull files from S3
      if (!isS3Configured()) {
        throw new Error(
          "upload_source=true but S3 is not configured on this daemon " +
          "(set S3_ACCESS_KEY + S3_SECRET_KEY + S3_ENDPOINT + WEBCLOUD_S3_BUCKET)"
        );
      }
      const wcBucket = process.env.WEBCLOUD_S3_BUCKET ?? process.env.S3_BUCKET ?? "webcloud-project-files";
      logger.emit(`Pulling project files from S3 (bucket: ${wcBucket})…`, "system");
      workspaceDir = wcConfig.deploymentDir(deploymentId);
      await fs.mkdir(workspaceDir, { recursive: true });
      const count = await downloadPrefix(`projects/${project.id}/`, workspaceDir, wcBucket);
      if (count === 0) {
        throw new Error("No files found in S3. Upload your project files first.");
      }
      logger.emit(`Pulled ${count} file(s) from S3.`, "system");
    } else {
      // Git-source project: clone the repository
      if (!project.repo_url) throw new Error("project has no repo_url — set one in Settings");
      const { workspaceDir: cloneDir, ok: cloneOk } = await cloneRepo({
        deploymentId,
        repoUrl: project.repo_url,
        branch,
        logger,
      });
      if (!cloneOk) throw new Error("git clone failed");
      workspaceDir = cloneDir;
    }

    // 4. Build
    const spec = specFor(project.framework);
    const envArgs = await envDockerArgs(project.id);
    const installCmd = project.install_cmd?.trim() || spec.default_install_cmd;
    const buildCmd = project.build_cmd?.trim() || spec.default_build_cmd;

    if (!(await ensureImage(spec.build_image, logger))) throw new Error(`pull ${spec.build_image} failed`);
    logger.emit(`==> ${installCmd} && ${buildCmd}`, "system");

    const buildCode = await runBuildContainer({
      deploymentId,
      image: spec.build_image,
      workspaceVolume: workspaceDir,
      envArgs,
      script: `${installCmd} && ${buildCmd}`,
      logger,
    });
    if (buildCode !== 0) throw new Error(`build exited ${buildCode}`);

    // 5. Runtime
    if (spec.runtime_image !== spec.build_image) {
      if (!(await ensureImage(spec.runtime_image, logger))) throw new Error(`pull ${spec.runtime_image} failed`);
    }
    await wcSupabase.from("deployments").update({ status: "deploying" }).eq("id", deploymentId);

    const startCmd = project.start_cmd?.trim() || spec.default_start_cmd;
    const bootName = startRuntimeContainer({
      projectId: project.id,
      image: spec.runtime_image,
      workspaceVolume: workspaceDir,
      hostPort,
      containerPort: spec.default_container_port,
      envArgs,
      startCmd,
      ramMb: project.ram_request_mb,
      cpuPercent: project.cpu_request_pct,
    });
    logger.emit(`Runtime container started: ${bootName}`, "system");

    // 6. Health check — TCP connect with retries (10s)
    const healthy = await waitForPort(hostPort, 10);
    if (!healthy) {
      removeContainer(bootName);
      throw new Error(`runtime did not bind to port ${hostPort}`);
    }
    logger.emit(`Health check passed on :${hostPort}`, "system");

    // 7. Route swap
    const hostname = `${project.slug}.${wcConfig.subdomainBase}`;
    const target = `http://localhost:${hostPort}`;
    const router = region ? buildRoutingClient(region) : null;
    let routeId: string | null = project.routing_resource_id ?? null;
    if (router) {
      if (routeId) {
        await router.swapRoute(routeId, target);
        logger.emit(`Swapped route ${hostname} → ${target}`, "system");
      } else {
        const r = await router.createRoute(hostname, target);
        routeId = r.routeId;
        logger.emit(`Created route ${hostname} → ${target}`, "system");
      }
    } else {
      logger.emit("No routing client configured — skipping route registration", "system");
    }

    // 8. Promote
    promoteRuntime(bootName, project.id);
    const canonical = runtimeContainerName(project.id);

    await wcSupabase.from("deployments").update({
      status: "active",
      host_port: hostPort,
      container_name: canonical,
      routing_resource_id: routeId,
      duration_ms: Date.now() - started,
    }).eq("id", deploymentId);

    await wcSupabase.from("projects").update({
      status: "running",
      node_id: config.nodeId,
      routing_resource_id: routeId,
      idle_since: null,
    }).eq("id", project.id);

    logger.emit(`✓ Deploy complete in ${((Date.now() - started) / 1000).toFixed(1)}s`, "system");
  } catch (err) {
    const message = (err as Error).message;
    log.error("deploy failed", { deploymentId, err: message });
    logger.emit(`✗ Deploy failed: ${message}`, "error");
    await wcSupabase.from("deployments").update({
      status: "failed",
      error_message: message,
      duration_ms: Date.now() - started,
    }).eq("id", deploymentId);
    await releasePort(deploymentId);
  } finally {
    await logger.close();
    // Best-effort: keep the workspace for 1h for debugging, then GC happens
    // out-of-band. (A separate cleanup cron can sweep `wcConfig.workspaceDir`.)
    void fs.access(wcConfig.deploymentDir(deploymentId)).catch(() => undefined);
  }
}

/** TCP connect with retries — runtime container may need a moment to listen. */
async function waitForPort(port: number, maxSeconds: number): Promise<boolean> {
  const net = await import("node:net");
  for (let i = 0; i < maxSeconds * 2; i++) {
    const ok = await new Promise<boolean>((resolve) => {
      const sock = net.default.createConnection({ host: "127.0.0.1", port });
      sock.once("connect", () => { sock.end(); resolve(true); });
      sock.once("error", () => resolve(false));
    });
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

/** Stop the runtime container for a project (called on `stop` command). */
export async function stopProjectRuntime(projectId: string): Promise<void> {
  removeContainer(runtimeContainerName(projectId));
  await wcSupabase.from("projects").update({ status: "stopped" }).eq("id", projectId);
}
