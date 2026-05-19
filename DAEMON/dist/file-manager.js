import { readdir, readFile, writeFile, mkdir, unlink, rename, stat } from "node:fs/promises";
import path from "node:path";
import mime from "mime-types";
import { config } from "./config.js";
import { log } from "./logger.js";
import { supabase } from "./supabase.js";
function serverRoot(serverId) {
    return path.join(config.serversDir, serverId);
}
/** Resolve a path inside the server dir and refuse anything that escapes it. */
function safePath(serverId, rel) {
    const root = serverRoot(serverId);
    const abs = path.resolve(root, "." + path.posix.normalize("/" + rel));
    if (abs !== root && !abs.startsWith(root + path.sep)) {
        throw new Error("path escapes server root");
    }
    return abs;
}
async function handleList(serverId, rel) {
    const dir = safePath(serverId, rel);
    const entries = await readdir(dir, { withFileTypes: true });
    const out = [];
    for (const e of entries) {
        const abs = path.join(dir, e.name);
        const s = await stat(abs);
        out.push({
            name: e.name,
            path: path.posix.join(rel, e.name),
            isDirectory: e.isDirectory(),
            size: s.size,
            modifiedMs: s.mtimeMs,
            mime: e.isDirectory() ? null : (mime.lookup(e.name) || "application/octet-stream"),
        });
    }
    // Folders first, then alphabetical
    out.sort((a, b) => a.isDirectory !== b.isDirectory
        ? a.isDirectory ? -1 : 1
        : a.name.localeCompare(b.name));
    return out;
}
async function handleRead(serverId, rel) {
    const abs = safePath(serverId, rel);
    const s = await stat(abs);
    if (s.size > 2 * 1024 * 1024) {
        throw new Error("file too large to read inline (>2MB)");
    }
    const buf = await readFile(abs);
    return { content: buf.toString("utf8"), size: s.size };
}
async function handleWrite(serverId, rel, content) {
    const abs = safePath(serverId, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, content, "utf8");
}
async function handleMkdir(serverId, rel) {
    const abs = safePath(serverId, rel);
    await mkdir(abs, { recursive: true });
}
async function handleDelete(serverId, rel) {
    const abs = safePath(serverId, rel);
    await unlink(abs);
}
async function handleRename(serverId, from, to) {
    const a = safePath(serverId, from);
    const b = safePath(serverId, to);
    await mkdir(path.dirname(b), { recursive: true });
    await rename(a, b);
}
async function dispatch(serverId, req) {
    switch (req.op) {
        case "list": return await handleList(serverId, req.path);
        case "read": return await handleRead(serverId, req.path);
        case "write":
            await handleWrite(serverId, req.path, req.content);
            return { ok: true };
        case "mkdir":
            await handleMkdir(serverId, req.path);
            return { ok: true };
        case "delete":
            await handleDelete(serverId, req.path);
            return { ok: true };
        case "rename":
            await handleRename(serverId, req.from, req.to);
            return { ok: true };
    }
}
const subscribed = new Set();
/** Subscribe to file-manager requests for one server. Idempotent. */
export function subscribeFileManager(serverId) {
    if (subscribed.has(serverId))
        return;
    subscribed.add(serverId);
    const channel = supabase.channel(`fm:${serverId}`, {
        config: { broadcast: { self: false, ack: false } },
    });
    channel.on("broadcast", { event: "req" }, async (msg) => {
        const payload = msg.payload;
        if (!payload?.reqId || !payload.request)
            return;
        try {
            const data = await dispatch(serverId, payload.request);
            await channel.send({
                type: "broadcast",
                event: "res",
                payload: { reqId: payload.reqId, ok: true, data },
            });
        }
        catch (e) {
            await channel.send({
                type: "broadcast",
                event: "res",
                payload: { reqId: payload.reqId, ok: false, error: String(e) },
            });
        }
    });
    void channel.subscribe((status) => {
        log.debug("fm channel status", { serverId, status });
    });
}
//# sourceMappingURL=file-manager.js.map