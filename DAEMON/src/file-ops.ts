import { readdir, stat, mkdir, writeFile, unlink, rename, rm, readFile } from "node:fs/promises";
import path from "node:path";
import { createWriteStream, createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import AdmZip from "adm-zip";
import { config } from "./config.js";
import { log } from "./logger.js";
import { supabase } from "./supabase.js";

const STORAGE_BUCKET = "server-files";

/**
 * Resolves and validates an in-server path. Ensures the result never
 * escapes the server's root directory (`/var/lib/mcloud/servers/{id}`).
 * Returns an absolute filesystem path or throws.
 */
function resolveServerPath(serverId: string, relPath: string): string {
  const root = path.resolve(config.serversDir, serverId);
  // Normalize: strip leading "/", split on "/", then join
  const clean = relPath.replace(/^\/+/, "");
  const abs = path.resolve(root, clean);
  if (!abs.startsWith(root)) {
    throw new Error(`Path escape attempt: ${relPath}`);
  }
  return abs;
}

/** Broadcast a file-operation result back to the client. */
const fileOpChannels = new Map<string, ReturnType<typeof supabase.channel>>();
function getFileOpChannel(serverId: string) {
  const key = `fileops:${serverId}`;
  let ch = fileOpChannels.get(key);
  if (!ch) {
    ch = supabase.channel(key, { config: { broadcast: { self: false, ack: false } } });
    void ch.subscribe();
    fileOpChannels.set(key, ch);
  }
  return ch;
}

async function emit(serverId: string, opId: string, event: string, payload: object) {
  try {
    const ch = getFileOpChannel(serverId);
    await ch.send({
      type: "broadcast",
      event,
      payload: { opId, ...payload, ts: Date.now() },
    });
  } catch (e) {
    log.warn("file-op broadcast failed", { serverId, opId, err: String(e) });
  }
}

/* ───────── operation handlers ───────── */

async function listDir(serverId: string, opId: string, relPath: string) {
  const abs = resolveServerPath(serverId, relPath);
  // Server dir may not exist yet (server never started) — auto-create the root
  // so the file manager works immediately after server creation.
  await mkdir(abs, { recursive: true });
  const entries = await readdir(abs, { withFileTypes: true });
  const items = await Promise.all(
    entries.map(async (e) => {
      const sub = path.join(abs, e.name);
      const s = await stat(sub).catch(() => null);
      return {
        name: e.name,
        path: path.posix.join(relPath || "/", e.name),
        is_directory: e.isDirectory(),
        size_bytes: e.isFile() ? s?.size ?? 0 : 0,
        modified_at: s?.mtime?.toISOString() ?? null,
      };
    })
  );
  // Sort: dirs first, alphabetically
  items.sort((a, b) =>
    a.is_directory === b.is_directory
      ? a.name.localeCompare(b.name)
      : a.is_directory ? -1 : 1
  );
  await emit(serverId, opId, "list-result", { path: relPath, items });
}

async function readText(serverId: string, opId: string, relPath: string) {
  const abs = resolveServerPath(serverId, relPath);
  const s = await stat(abs);
  if (s.size > 5 * 1024 * 1024) {
    await emit(serverId, opId, "read-result", { path: relPath, error: "fileTooLarge" });
    return;
  }
  const content = await readFile(abs, "utf8");
  await emit(serverId, opId, "read-result", { path: relPath, content });
}

async function writeText(serverId: string, opId: string, relPath: string, content: string) {
  const abs = resolveServerPath(serverId, relPath);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, content, "utf8");
  await emit(serverId, opId, "write-result", { path: relPath, ok: true });
}

async function mkDir(serverId: string, opId: string, relPath: string) {
  const abs = resolveServerPath(serverId, relPath);
  await mkdir(abs, { recursive: true });
  await emit(serverId, opId, "mkdir-result", { path: relPath, ok: true });
}

async function deletePath(serverId: string, opId: string, relPath: string) {
  const abs = resolveServerPath(serverId, relPath);
  await rm(abs, { recursive: true, force: true });
  await emit(serverId, opId, "delete-result", { path: relPath, ok: true });
}

async function renamePath(serverId: string, opId: string, oldPath: string, newPath: string) {
  const oldAbs = resolveServerPath(serverId, oldPath);
  const newAbs = resolveServerPath(serverId, newPath);
  await mkdir(path.dirname(newAbs), { recursive: true });
  await rename(oldAbs, newAbs);
  await emit(serverId, opId, "rename-result", { oldPath, newPath, ok: true });
}

/**
 * Import (upload) a file: download it from Supabase Storage at `storageKey`
 * and write it to `targetPath` on the node's filesystem.
 */
async function importFromStorage(
  serverId: string,
  opId: string,
  storageKey: string,
  targetPath: string
) {
  const abs = resolveServerPath(serverId, targetPath);
  await mkdir(path.dirname(abs), { recursive: true });

  await emit(serverId, opId, "progress", { stage: "downloading", targetPath });

  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(storageKey);
  if (error || !data) throw new Error(`storage download: ${error?.message ?? "no data"}`);

  await writeFile(abs, Buffer.from(await data.arrayBuffer()));
  // Delete the inbox file from storage to save space
  void supabase.storage.from(STORAGE_BUCKET).remove([storageKey]);

  await emit(serverId, opId, "import-result", { targetPath, ok: true });
}

/**
 * Download a file straight from a URL into the server's filesystem (wget-style).
 */
async function importFromUrl(
  serverId: string,
  opId: string,
  url: string,
  targetPath: string
) {
  const abs = resolveServerPath(serverId, targetPath);
  await mkdir(path.dirname(abs), { recursive: true });

  await emit(serverId, opId, "progress", { stage: "downloading-url", url });

  const res = await fetch(url, {
    headers: { "User-Agent": "MCloud/1.0" },
    redirect: "follow",
  });
  if (!res.ok || !res.body) throw new Error(`url fetch ${res.status}`);

  // Stream to disk to avoid OOM on big files
  const fileStream = createWriteStream(abs);
  await pipeline(res.body as unknown as NodeJS.ReadableStream, fileStream);

  await emit(serverId, opId, "url-import-result", { targetPath, ok: true });
}

/**
 * Export (download) a file: zip it (if directory) or copy it (if file)
 * to Supabase Storage at `exports/{server_id}/{filename}` and return
 * a signed URL the user can download from.
 */
async function exportToStorage(
  serverId: string,
  opId: string,
  relPath: string
) {
  const abs = resolveServerPath(serverId, relPath);
  const s = await stat(abs);
  const name = path.basename(abs);
  const exportName = s.isDirectory() ? `${name}.zip` : name;
  const storageKey = `${serverId}/exports/${Date.now()}-${exportName}`;

  await emit(serverId, opId, "progress", { stage: "preparing-export", path: relPath });

  let body: Buffer;
  let contentType: string;

  if (s.isDirectory()) {
    const zip = new AdmZip();
    zip.addLocalFolder(abs);
    body = zip.toBuffer();
    contentType = "application/zip";
  } else {
    body = await readFile(abs);
    contentType = "application/octet-stream";
  }

  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(storageKey, body, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`storage upload: ${error.message}`);

  const { data: signed } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(storageKey, 600);
  await emit(serverId, opId, "export-result", {
    path: relPath,
    url: signed?.signedUrl ?? null,
    filename: exportName,
    size: body.length,
  });
}

async function zipPath(serverId: string, opId: string, sourcePath: string, archivePath: string) {
  const srcAbs = resolveServerPath(serverId, sourcePath);
  const dstAbs = resolveServerPath(serverId, archivePath);
  const s = await stat(srcAbs);
  const zip = new AdmZip();
  if (s.isDirectory()) zip.addLocalFolder(srcAbs);
  else zip.addLocalFile(srcAbs);
  await mkdir(path.dirname(dstAbs), { recursive: true });
  zip.writeZip(dstAbs);
  await emit(serverId, opId, "zip-result", { sourcePath, archivePath, ok: true });
}

async function unzipPath(serverId: string, opId: string, archivePath: string, targetDir: string) {
  const archAbs = resolveServerPath(serverId, archivePath);
  const dstAbs = resolveServerPath(serverId, targetDir);
  await mkdir(dstAbs, { recursive: true });
  const zip = new AdmZip(archAbs);
  zip.extractAllTo(dstAbs, true);
  await emit(serverId, opId, "unzip-result", { archivePath, targetDir, ok: true });
}

/* ───────── public entry point ───────── */

interface FileOpRequest {
  op: string;
  opId: string;
  serverId: string;
  [k: string]: unknown;
}

export async function handleFileOp(req: FileOpRequest) {
  const { op, opId, serverId } = req;
  try {
    switch (op) {
      case "list":
        await listDir(serverId, opId, (req.path as string) ?? "/");
        break;
      case "read":
        await readText(serverId, opId, req.path as string);
        break;
      case "write":
        await writeText(serverId, opId, req.path as string, req.content as string);
        break;
      case "mkdir":
        await mkDir(serverId, opId, req.path as string);
        break;
      case "delete":
        await deletePath(serverId, opId, req.path as string);
        break;
      case "rename":
        await renamePath(serverId, opId, req.oldPath as string, req.newPath as string);
        break;
      case "import":
        await importFromStorage(serverId, opId, req.storageKey as string, req.targetPath as string);
        break;
      case "import-url":
        await importFromUrl(serverId, opId, req.url as string, req.targetPath as string);
        break;
      case "export":
        await exportToStorage(serverId, opId, req.path as string);
        break;
      case "zip":
        await zipPath(serverId, opId, req.sourcePath as string, req.archivePath as string);
        break;
      case "unzip":
        await unzipPath(serverId, opId, req.archivePath as string, req.targetDir as string);
        break;
      default:
        await emit(serverId, opId, "error", { error: `unknown op: ${op}` });
    }
  } catch (err) {
    log.error("file-op failed", { op, serverId, opId, err: String(err) });
    await emit(serverId, opId, "error", { op, error: String(err) });
  }
}

// (subscription wiring lives in index.ts on the existing node channel)
