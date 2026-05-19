import { createWriteStream } from "node:fs";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import AdmZip from "adm-zip";
import { config } from "./config.js";
import { log } from "./logger.js";
import { supabase } from "./supabase.js";
import { broadcastConsole } from "./console-bridge.js";
async function downloadTo(url, dest) {
    const res = await fetch(url, {
        headers: { "User-Agent": "MCloud-Daemon/1.0" },
        redirect: "follow",
    });
    if (!res.ok || !res.body)
        throw new Error(`fetch ${res.status} ${url}`);
    await mkdir(path.dirname(dest), { recursive: true });
    await pipeline(res.body, createWriteStream(dest));
}
/**
 * Download a Modrinth .mrpack, extract its files (mods + config overrides)
 * into the server's directory, then mark the server as installed.
 *
 * Modrinth modpack format:
 *   modrinth.index.json      — manifest listing files[] with download URLs
 *   overrides/...            — files copied as-is over the server root
 *   server-overrides/...     — server-only overrides
 */
export async function installModpack(serverId, modpackUrl) {
    const serverDir = path.resolve(config.serversDir, serverId);
    await mkdir(serverDir, { recursive: true });
    await broadcastConsole(serverId, `[modpack] Downloading ${modpackUrl.split("/").pop()}...`, "system");
    log.info("modpack download", { serverId, modpackUrl });
    // Download the .mrpack to a temp file
    const mrpackPath = path.join(serverDir, `.modpack-${Date.now()}.mrpack`);
    await downloadTo(modpackUrl, mrpackPath);
    // Extract — .mrpack is a zip
    const zip = new AdmZip(mrpackPath);
    const entries = zip.getEntries();
    const indexEntry = entries.find((e) => e.entryName === "modrinth.index.json");
    if (!indexEntry)
        throw new Error("modpack missing modrinth.index.json");
    const index = JSON.parse(indexEntry.getData().toString("utf8"));
    await broadcastConsole(serverId, `[modpack] ${index.name} — ${index.files.length} files`, "system");
    // 1. Apply overrides (drop them into the server root)
    for (const entry of entries) {
        const name = entry.entryName;
        if (entry.isDirectory)
            continue;
        let target = null;
        if (name.startsWith("overrides/")) {
            target = path.join(serverDir, name.slice("overrides/".length));
        }
        else if (name.startsWith("server-overrides/")) {
            target = path.join(serverDir, name.slice("server-overrides/".length));
        }
        if (target) {
            await mkdir(path.dirname(target), { recursive: true });
            await writeFile(target, entry.getData());
        }
    }
    await broadcastConsole(serverId, `[modpack] Overrides extracted`, "system");
    // 2. Download mods listed in files[] (filter: server-side only)
    const serverFiles = index.files.filter((f) => !f.env?.server || f.env.server !== "unsupported");
    let done = 0;
    for (const file of serverFiles) {
        const dest = path.join(serverDir, file.path);
        const url = file.downloads[0];
        if (!url)
            continue;
        try {
            await downloadTo(url, dest);
            done++;
            if (done % 5 === 0 || done === serverFiles.length) {
                await broadcastConsole(serverId, `[modpack] Downloaded ${done}/${serverFiles.length} mods`, "system");
            }
        }
        catch (err) {
            log.warn("modpack file download failed", { serverId, file: file.path, err: String(err) });
            await broadcastConsole(serverId, `[modpack] WARN: skipped ${file.path}`, "system");
        }
    }
    // 3. Cleanup the .mrpack
    await unlink(mrpackPath).catch(() => { });
    await broadcastConsole(serverId, `[modpack] Install complete — starting server`, "system");
    // 4. Mark installed in DB
    await supabase.from("servers").update({ modpack_installed: true }).eq("id", serverId);
}
//# sourceMappingURL=modpack-installer.js.map