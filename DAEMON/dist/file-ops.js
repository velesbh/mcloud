import { readdir, stat, mkdir, writeFile, rename, rm, readFile, symlink } from "node:fs/promises";
import path from "node:path";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import AdmZip from "adm-zip";
import { config } from "./config.js";
import { log } from "./logger.js";
import { supabase } from "./supabase.js";
import { isS3Configured, s3Upload, s3Delete, s3SignedDownloadUrl } from "./s3.js";
const STORAGE_BUCKET = "server-files";
/**
 * Resolves and validates an in-server path. Ensures the result never
 * escapes the server's root directory (`/var/lib/mcloud/servers/{id}`).
 * Returns an absolute filesystem path or throws.
 */
function resolveServerPath(serverId, relPath) {
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
const fileOpChannels = new Map();
function getFileOpChannel(serverId) {
    const key = `fileops:${serverId}`;
    let ch = fileOpChannels.get(key);
    if (!ch) {
        ch = supabase.channel(key, { config: { broadcast: { self: false, ack: false } } });
        void ch.subscribe();
        fileOpChannels.set(key, ch);
    }
    return ch;
}
async function emit(serverId, opId, event, payload) {
    try {
        const ch = getFileOpChannel(serverId);
        await ch.send({
            type: "broadcast",
            event,
            payload: { opId, ...payload, ts: Date.now() },
        });
    }
    catch (e) {
        log.warn("file-op broadcast failed", { serverId, opId, err: String(e) });
    }
}
/* ───────── operation handlers ───────── */
async function listDir(serverId, opId, relPath) {
    const abs = resolveServerPath(serverId, relPath);
    // Server dir may not exist yet (server never started) — auto-create the root
    // so the file manager works immediately after server creation.
    await mkdir(abs, { recursive: true });
    const entries = await readdir(abs, { withFileTypes: true });
    const items = await Promise.all(entries.map(async (e) => {
        const sub = path.join(abs, e.name);
        const s = await stat(sub).catch(() => null);
        return {
            name: e.name,
            path: path.posix.join(relPath || "/", e.name),
            is_directory: e.isDirectory(),
            size_bytes: e.isFile() ? s?.size ?? 0 : 0,
            modified_at: s?.mtime?.toISOString() ?? null,
        };
    }));
    // Sort: dirs first, alphabetically
    items.sort((a, b) => a.is_directory === b.is_directory
        ? a.name.localeCompare(b.name)
        : a.is_directory ? -1 : 1);
    await emit(serverId, opId, "list-result", { path: relPath, items });
}
async function readText(serverId, opId, relPath) {
    const abs = resolveServerPath(serverId, relPath);
    const s = await stat(abs);
    if (s.size > 5 * 1024 * 1024) {
        await emit(serverId, opId, "read-result", { path: relPath, error: "fileTooLarge" });
        return;
    }
    const content = await readFile(abs, "utf8");
    await emit(serverId, opId, "read-result", { path: relPath, content });
}
/**
 * Read a file (or zip a directory) and return its bytes as base64 so the
 * main app can stream it directly to the browser — no storage involved.
 * Limited to 50 MB to avoid Realtime message overflow.
 */
async function readBase64(serverId, opId, relPath) {
    const abs = resolveServerPath(serverId, relPath);
    const s = await stat(abs);
    const name = path.basename(abs);
    let buf;
    let filename;
    if (s.isDirectory()) {
        const zip = new AdmZip();
        zip.addLocalFolder(abs);
        buf = zip.toBuffer();
        filename = `${name}.zip`;
    }
    else {
        if (s.size > 50 * 1024 * 1024) {
            await emit(serverId, opId, "read-result", { path: relPath, error: "fileTooLarge" });
            return;
        }
        buf = await readFile(abs);
        filename = name;
    }
    await emit(serverId, opId, "read-result", {
        path: relPath,
        content: buf.toString("base64"),
        filename,
        size: buf.length,
    });
}
async function writeText(serverId, opId, relPath, content) {
    const abs = resolveServerPath(serverId, relPath);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, content, "utf8");
    await emit(serverId, opId, "write-result", { path: relPath, ok: true });
}
async function mkDir(serverId, opId, relPath) {
    const abs = resolveServerPath(serverId, relPath);
    await mkdir(abs, { recursive: true });
    await emit(serverId, opId, "mkdir-result", { path: relPath, ok: true });
}
async function deletePath(serverId, opId, relPath) {
    const abs = resolveServerPath(serverId, relPath);
    await rm(abs, { recursive: true, force: true });
    await emit(serverId, opId, "delete-result", { path: relPath, ok: true });
}
async function renamePath(serverId, opId, oldPath, newPath) {
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
async function importFromStorage(serverId, opId, storageKey, targetPath) {
    const abs = resolveServerPath(serverId, targetPath);
    await mkdir(path.dirname(abs), { recursive: true });
    await emit(serverId, opId, "progress", { stage: "downloading", targetPath });
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(storageKey);
    if (error || !data)
        throw new Error(`storage download: ${error?.message ?? "no data"}`);
    await writeFile(abs, Buffer.from(await data.arrayBuffer()));
    // Delete the inbox file from storage to save space
    void supabase.storage.from(STORAGE_BUCKET).remove([storageKey]);
    await emit(serverId, opId, "import-result", { targetPath, ok: true });
}
/**
 * Download a file straight from a URL into the server's filesystem (wget-style).
 */
async function importFromUrl(serverId, opId, url, targetPath) {
    const abs = resolveServerPath(serverId, targetPath);
    await mkdir(path.dirname(abs), { recursive: true });
    await emit(serverId, opId, "progress", { stage: "downloading-url", url });
    const res = await fetch(url, {
        headers: { "User-Agent": "MCloud/1.0" },
        redirect: "follow",
    });
    if (!res.ok || !res.body)
        throw new Error(`url fetch ${res.status}`);
    // Stream to disk to avoid OOM on big files
    const fileStream = createWriteStream(abs);
    await pipeline(res.body, fileStream);
    await emit(serverId, opId, "url-import-result", { targetPath, ok: true });
}
/**
 * Export (download) a file: zip it (if directory) or copy it (if file),
 * stage it to S3 (if configured) or Supabase Storage (fallback), then
 * return a short-lived presigned URL the client can download from.
 * The staging object is deleted after the URL is generated.
 *
 * s3Config — credentials injected by the main app so the daemon can use
 * the app's S3 bucket without needing its own S3 env vars.
 */
async function exportToStorage(serverId, opId, relPath, s3Config) {
    const abs = resolveServerPath(serverId, relPath);
    const s = await stat(abs);
    const name = path.basename(abs);
    const exportName = s.isDirectory() ? `${name}.zip` : name;
    const storageKey = `${serverId}/exports/${Date.now()}-${exportName}`;
    await emit(serverId, opId, "progress", { stage: "preparing-export", path: relPath });
    let body;
    let contentType;
    if (s.isDirectory()) {
        const zip = new AdmZip();
        zip.addLocalFolder(abs);
        body = zip.toBuffer();
        contentType = "application/zip";
    }
    else {
        body = await readFile(abs);
        contentType = "application/octet-stream";
    }
    let downloadUrl = null;
    // Use injected S3 config from main app, or fall back to daemon's own env vars
    const useS3 = s3Config?.accessKey && s3Config?.secretKey
        ? true
        : isS3Configured();
    if (useS3) {
        // ── S3 path ──
        let upload;
        let signedUrl;
        let del;
        const bucket = s3Config?.bucket ?? process.env.S3_BUCKET ?? "mcloud-files";
        if (s3Config?.accessKey && s3Config?.secretKey) {
            // Build a one-shot client from injected credentials
            const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = await import("@aws-sdk/client-s3");
            const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
            const rawRegion = s3Config.region ?? "";
            const client = new S3Client({
                region: /^[a-zA-Z0-9-]+$/.test(rawRegion) ? rawRegion : "auto",
                ...(s3Config.endpoint ? { endpoint: s3Config.endpoint } : {}),
                credentials: { accessKeyId: s3Config.accessKey, secretAccessKey: s3Config.secretKey },
                forcePathStyle: s3Config.forcePathStyle ?? false,
            });
            upload = async (key, buf, ct) => {
                await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buf, ContentType: ct }));
            };
            signedUrl = (key, exp) => getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: exp });
            del = async (key) => {
                try {
                    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
                }
                catch { }
            };
        }
        else {
            // Use daemon's own env-var-based S3 client
            upload = (key, buf, ct) => s3Upload(key, buf, ct);
            signedUrl = (key, exp) => s3SignedDownloadUrl(key, exp);
            del = (key) => s3Delete(key);
        }
        await upload(storageKey, body, contentType);
        downloadUrl = await signedUrl(storageKey, 600);
        setTimeout(() => { void del(storageKey); }, 30_000);
    }
    else {
        // ── Supabase Storage fallback ──
        // Auto-create bucket on first use (idempotent — ignore "already exists")
        const { error: bucketErr } = await supabase.storage.createBucket(STORAGE_BUCKET, {
            public: false,
            fileSizeLimit: 256 * 1024 * 1024,
        });
        if (bucketErr && !bucketErr.message.toLowerCase().includes("already exist")) {
            throw new Error(`bucket create: ${bucketErr.message}`);
        }
        const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(storageKey, body, {
            contentType,
            upsert: true,
        });
        if (error)
            throw new Error(`storage upload: ${error.message}`);
        const { data: signed } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(storageKey, 600);
        downloadUrl = signed?.signedUrl ?? null;
        // Best-effort cleanup after 60 s
        setTimeout(() => {
            void supabase.storage.from(STORAGE_BUCKET).remove([storageKey]);
        }, 60_000);
    }
    await emit(serverId, opId, "export-result", {
        path: relPath,
        url: downloadUrl,
        filename: exportName,
        size: body.length,
    });
}
/**
 * Import from an absolute directory path on the node's filesystem by symlinking
 * the source directory as the server's root. No files are copied — the daemon
 * reads and writes directly to srcAbsPath through the symlink.
 */
async function importFromDir(serverId, opId, srcAbsPath, _targetPath) {
    const srcStat = await stat(srcAbsPath);
    if (!srcStat.isDirectory()) {
        throw new Error(`${srcAbsPath} is not a directory`);
    }
    const serverRoot = path.resolve(config.serversDir, serverId);
    // Remove any pre-created empty directory so we can place the symlink
    await rm(serverRoot, { recursive: true, force: true });
    // Symlink {serversDir}/{serverId} → srcAbsPath
    await symlink(srcAbsPath, serverRoot);
    await emit(serverId, opId, "import-result", { targetPath: "/", ok: true });
}
async function zipPath(serverId, opId, sourcePath, archivePath) {
    const srcAbs = resolveServerPath(serverId, sourcePath);
    const dstAbs = resolveServerPath(serverId, archivePath);
    const s = await stat(srcAbs);
    const zip = new AdmZip();
    if (s.isDirectory())
        zip.addLocalFolder(srcAbs);
    else
        zip.addLocalFile(srcAbs);
    await mkdir(path.dirname(dstAbs), { recursive: true });
    zip.writeZip(dstAbs);
    await emit(serverId, opId, "zip-result", { sourcePath, archivePath, ok: true });
}
async function unzipPath(serverId, opId, archivePath, targetDir) {
    const archAbs = resolveServerPath(serverId, archivePath);
    const dstAbs = resolveServerPath(serverId, targetDir);
    await mkdir(dstAbs, { recursive: true });
    const zip = new AdmZip(archAbs);
    zip.extractAllTo(dstAbs, true);
    await emit(serverId, opId, "unzip-result", { archivePath, targetDir, ok: true });
}
export async function handleFileOp(req) {
    const { op, opId, serverId } = req;
    try {
        switch (op) {
            case "list":
                await listDir(serverId, opId, req.path ?? "/");
                break;
            case "read":
                await readText(serverId, opId, req.path);
                break;
            case "read-base64":
                await readBase64(serverId, opId, req.path);
                break;
            case "write":
                await writeText(serverId, opId, req.path, req.content);
                break;
            case "mkdir":
                await mkDir(serverId, opId, req.path);
                break;
            case "delete":
                await deletePath(serverId, opId, req.path);
                break;
            case "rename":
                await renamePath(serverId, opId, req.oldPath, req.newPath);
                break;
            case "import":
                await importFromStorage(serverId, opId, req.storageKey, req.targetPath);
                break;
            case "import-url":
                await importFromUrl(serverId, opId, req.url, req.targetPath);
                break;
            case "import-dir":
                await importFromDir(serverId, opId, req.srcAbsPath, req.targetPath);
                break;
            case "export":
                await exportToStorage(serverId, opId, req.path, req.s3Config);
                break;
            case "zip":
                await zipPath(serverId, opId, req.sourcePath, req.archivePath);
                break;
            case "unzip":
                await unzipPath(serverId, opId, req.archivePath, req.targetDir);
                break;
            default:
                await emit(serverId, opId, "error", { error: `unknown op: ${op}` });
        }
    }
    catch (err) {
        log.error("file-op failed", { op, serverId, opId, err: String(err) });
        await emit(serverId, opId, "error", { op, error: String(err) });
    }
}
// (subscription wiring lives in index.ts on the existing node channel)
//# sourceMappingURL=file-ops.js.map