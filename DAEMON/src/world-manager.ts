import { readdir, stat, readFile, writeFile, rename, rm, mkdir } from "node:fs/promises";
import path from "node:path";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import AdmZip from "adm-zip";
import { config } from "./config.js";
import { log } from "./logger.js";
import { supabase } from "./supabase.js";

const STORAGE_BUCKET = "server-files";

interface WorldInfo {
  name: string;
  size_bytes: number;
  modified_at: string | null;
  active: boolean;
  has_level_dat: boolean;
}

function serverRoot(serverId: string): string {
  return path.resolve(config.serversDir, serverId);
}

async function readServerPropertiesLevelName(serverId: string): Promise<string> {
  try {
    const text = await readFile(path.join(serverRoot(serverId), "server.properties"), "utf8");
    const m = text.match(/^level-name=(.+)$/m);
    return m?.[1]?.trim() || "world";
  } catch {
    return "world";
  }
}

async function setServerPropertiesLevelName(serverId: string, newName: string) {
  const propsPath = path.join(serverRoot(serverId), "server.properties");
  let text: string;
  try { text = await readFile(propsPath, "utf8"); } catch { text = ""; }
  if (/^level-name=/m.test(text)) {
    text = text.replace(/^level-name=.*$/m, `level-name=${newName}`);
  } else {
    text += (text.endsWith("\n") ? "" : "\n") + `level-name=${newName}\n`;
  }
  await writeFile(propsPath, text, "utf8");
}

async function dirSize(dir: string): Promise<number> {
  let total = 0;
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) total += await dirSize(p);
      else {
        const s = await stat(p).catch(() => null);
        if (s) total += s.size;
      }
    }
  } catch {}
  return total;
}

/** List all world folders (containing level.dat) and which one is active. */
export async function listWorlds(serverId: string): Promise<{
  worlds: WorldInfo[];
  active: string;
}> {
  const root = serverRoot(serverId);
  const active = await readServerPropertiesLevelName(serverId);
  await mkdir(root, { recursive: true });
  const entries = await readdir(root, { withFileTypes: true });
  const worlds: WorldInfo[] = [];

  for (const e of entries) {
    if (!e.isDirectory()) continue;
    // Skip system folders
    if (e.name.startsWith(".") || ["logs", "cache", "crash-reports", "config", "mods", "plugins", "libraries", "versions"].includes(e.name)) continue;
    const sub = path.join(root, e.name);
    const levelDat = path.join(sub, "level.dat");
    const hasLevelDat = await stat(levelDat).then(() => true).catch(() => false);
    const s = await stat(sub).catch(() => null);
    worlds.push({
      name: e.name,
      size_bytes: await dirSize(sub),
      modified_at: s?.mtime?.toISOString() ?? null,
      active: e.name === active,
      has_level_dat: hasLevelDat,
    });
  }
  worlds.sort((a, b) => (a.active === b.active ? a.name.localeCompare(b.name) : a.active ? -1 : 1));
  return { worlds, active };
}

/** Set the active world (writes level-name in server.properties). */
export async function setActiveWorld(serverId: string, worldName: string): Promise<void> {
  const worldDir = path.join(serverRoot(serverId), worldName);
  const stats = await stat(worldDir);
  if (!stats.isDirectory()) throw new Error("not a directory");
  await setServerPropertiesLevelName(serverId, worldName);
}

/** Delete a world folder. */
export async function deleteWorld(serverId: string, worldName: string): Promise<void> {
  if (worldName === "world" || worldName === "..") throw new Error("refusing to delete reserved name");
  const worldDir = path.join(serverRoot(serverId), worldName);
  await rm(worldDir, { recursive: true, force: true });
}

/** Rename a world folder, updating active reference if needed. */
export async function renameWorld(serverId: string, oldName: string, newName: string): Promise<void> {
  const safe = newName.replace(/[^\w\-]/g, "_");
  if (!safe) throw new Error("invalid name");
  const root = serverRoot(serverId);
  await rename(path.join(root, oldName), path.join(root, safe));
  const active = await readServerPropertiesLevelName(serverId);
  if (active === oldName) await setServerPropertiesLevelName(serverId, safe);
}

/**
 * Download a .zip from a URL, extract it, and treat it as a new world.
 * If the zip contains a single root folder, use that as the world name;
 * otherwise create one based on the URL filename.
 */
export async function importWorldFromUrl(
  serverId: string,
  url: string,
  desiredName?: string
): Promise<{ worldName: string }> {
  const root = serverRoot(serverId);
  await mkdir(root, { recursive: true });

  // Download to a temp .zip in the server root
  const tmpZip = path.join(root, `.import-${Date.now()}.zip`);
  const res = await fetch(url, { headers: { "User-Agent": "MCloud/1.0" }, redirect: "follow" });
  if (!res.ok || !res.body) throw new Error(`download failed: ${res.status}`);
  await pipeline(res.body as unknown as NodeJS.ReadableStream, createWriteStream(tmpZip));

  // Extract to a staging dir then move to final location
  const staging = path.join(root, `.staging-${Date.now()}`);
  await mkdir(staging, { recursive: true });
  const zip = new AdmZip(tmpZip);
  zip.extractAllTo(staging, true);

  // Detect single-root-folder layout
  const stagedItems = await readdir(staging, { withFileTypes: true });
  const isSingleRoot = stagedItems.length === 1 && stagedItems[0].isDirectory();
  const sourceDir = isSingleRoot ? path.join(staging, stagedItems[0].name) : staging;

  // Resolve target name
  let worldName = desiredName
    ?? (isSingleRoot ? stagedItems[0].name : (url.split("/").pop() ?? "imported-world").replace(/\.zip$/i, ""));
  worldName = worldName.replace(/[^\w\-]/g, "_");
  // Ensure unique
  let dest = path.join(root, worldName);
  let counter = 1;
  while (await stat(dest).then(() => true).catch(() => false)) {
    dest = path.join(root, `${worldName}-${counter++}`);
  }
  await rename(sourceDir, dest);

  // Cleanup
  await rm(staging, { recursive: true, force: true });
  await rm(tmpZip, { force: true });

  return { worldName: path.basename(dest) };
}

/** Zip a world folder and upload it to Storage; return a signed download URL. */
export async function exportWorld(serverId: string, worldName: string): Promise<{ url: string; filename: string; size: number }> {
  const worldDir = path.join(serverRoot(serverId), worldName);
  await stat(worldDir); // throws if missing
  const zip = new AdmZip();
  zip.addLocalFolder(worldDir);
  const buf = zip.toBuffer();
  const key = `${serverId}/world-exports/${Date.now()}-${worldName}.zip`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(key, buf, {
    contentType: "application/zip",
    upsert: true,
  });
  if (error) throw new Error(`storage upload: ${error.message}`);
  const { data: signed } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(key, 600);
  return { url: signed?.signedUrl ?? "", filename: `${worldName}.zip`, size: buf.length };
}

/* ───────── Realtime dispatch ───────── */

interface WorldOpRequest {
  op: string;
  opId: string;
  serverId: string;
  [k: string]: unknown;
}

const replyChannels = new Map<string, ReturnType<typeof supabase.channel>>();
function getReplyChannel(serverId: string) {
  const key = `world:${serverId}`;
  let ch = replyChannels.get(key);
  if (!ch) {
    ch = supabase.channel(key, { config: { broadcast: { self: false, ack: false } } });
    void ch.subscribe();
    replyChannels.set(key, ch);
  }
  return ch;
}

async function reply(serverId: string, opId: string, event: string, payload: object) {
  try {
    const ch = getReplyChannel(serverId);
    await ch.send({ type: "broadcast", event, payload: { opId, ...payload, ts: Date.now() } });
  } catch (e) {
    log.warn("world-op reply failed", { err: String(e) });
  }
}

export async function handleWorldOp(req: WorldOpRequest) {
  const { op, opId, serverId } = req;
  try {
    switch (op) {
      case "list": {
        const data = await listWorlds(serverId);
        await reply(serverId, opId, "list-result", data);
        break;
      }
      case "set-active":
        await setActiveWorld(serverId, req.name as string);
        await reply(serverId, opId, "set-active-result", { ok: true });
        break;
      case "delete":
        await deleteWorld(serverId, req.name as string);
        await reply(serverId, opId, "delete-result", { ok: true });
        break;
      case "rename":
        await renameWorld(serverId, req.oldName as string, req.newName as string);
        await reply(serverId, opId, "rename-result", { ok: true });
        break;
      case "import-url": {
        const data = await importWorldFromUrl(serverId, req.url as string, req.name as string | undefined);
        await reply(serverId, opId, "import-result", data);
        break;
      }
      case "export": {
        const data = await exportWorld(serverId, req.name as string);
        await reply(serverId, opId, "export-result", data);
        break;
      }
      default:
        await reply(serverId, opId, "error", { error: `unknown op: ${op}` });
    }
  } catch (err) {
    log.error("world-op failed", { op, serverId, opId, err: String(err) });
    await reply(serverId, opId, "error", { op, error: String(err) });
  }
}
