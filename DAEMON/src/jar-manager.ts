/**
 * jar-manager.ts — downloads Minecraft server JARs via mcjarfiles.com.
 * Jars are cached at <SERVERS_DIR>/_jars/<loader>-<version>.jar so they
 * are only downloaded once per node.
 */
import { mkdir, access, rename } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { config } from "./config.js";
import { log } from "./logger.js";

const JARS_DIR = path.join(config.serversDir, "_jars");
const BASE = "https://mcjarfiles.com/api";

// Map internal loader names → mcjarfiles type/variant
const LOADER_MAP: Record<string, { type: string; variant: string }> = {
  vanilla:  { type: "vanilla",  variant: "release" },
  paper:    { type: "servers",  variant: "paper" },
  spigot:   { type: "servers",  variant: "paper" },
  purpur:   { type: "servers",  variant: "purpur" },
  fabric:   { type: "modded",   variant: "fabric" },
  forge:    { type: "modded",   variant: "forge" },
  neoforge: { type: "modded",   variant: "neoforge" },
  quilt:    { type: "modded",   variant: "fabric" },
};

async function ensureJarsDir() {
  await mkdir(JARS_DIR, { recursive: true });
}

async function jarExists(dest: string): Promise<boolean> {
  try { await access(dest); return true; } catch { return false; }
}

async function downloadTo(url: string, dest: string): Promise<void> {
  const res = await fetch(url, {
    headers: { "User-Agent": "MCloud/1.0 (admin@enzonic.com)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  if (!res.body) throw new Error(`No body from ${url}`);
  const tmp = `${dest}.tmp`;
  await pipeline(Readable.fromWeb(res.body as any), createWriteStream(tmp));
  await rename(tmp, dest);
}

/**
 * Returns the path to the JAR for the given loader + version, downloading
 * it first if it doesn't already exist in the cache.
 */
export async function ensureJar(loader: string, version: string): Promise<string> {
  await ensureJarsDir();
  const dest = path.join(JARS_DIR, `${loader}-${version}.jar`);

  if (await jarExists(dest)) {
    log.info("jar already cached", { loader, version });
    return dest;
  }

  const { type, variant } = LOADER_MAP[loader] ?? { type: "servers", variant: "paper" };
  const url = `${BASE}/get-jar/${type}/${variant}/${version}`;

  log.info("downloading jar via mcjarfiles", { loader, version, url });
  await downloadTo(url, dest);
  log.info("jar downloaded", { loader, version, dest });
  return dest;
}
