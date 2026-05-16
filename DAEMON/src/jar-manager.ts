/**
 * jar-manager.ts — downloads Minecraft server JARs on demand.
 *
 * Supported loaders: paper, vanilla, fabric, purpur
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

async function ensureJarsDir() {
  await mkdir(JARS_DIR, { recursive: true });
}

async function jarExists(dest: string): Promise<boolean> {
  try { await access(dest); return true; } catch { return false; }
}

/** Fetch a URL following redirects, return a readable stream. */
async function fetchStream(url: string): Promise<Readable> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  if (!res.body) throw new Error(`No body from ${url}`);
  return Readable.fromWeb(res.body as any);
}

/** Download a URL to disk, atomically. */
async function downloadTo(url: string, dest: string): Promise<void> {
  const tmp = `${dest}.tmp`;
  const stream = await fetchStream(url);
  await pipeline(stream, createWriteStream(tmp));
  await rename(tmp, dest);
}

// ─────────────────────────────────────────────────────────────────────────────
// PaperMC  (paper, folia)
// ─────────────────────────────────────────────────────────────────────────────
async function downloadPaper(version: string, dest: string) {
  const buildsUrl = `https://api.papermc.io/v2/projects/paper/versions/${version}/builds`;
  const res = await fetch(buildsUrl);
  if (!res.ok) throw new Error(`PaperMC API error ${res.status} for version ${version}`);
  const json = await res.json() as { builds: { build: number; channel: string }[] };
  const stable = json.builds.filter((b) => b.channel === "default");
  const latest = (stable.length ? stable : json.builds).at(-1);
  if (!latest) throw new Error(`No Paper build found for ${version}`);

  const build = latest.build;
  const filename = `paper-${version}-${build}.jar`;
  const downloadUrl = `https://api.papermc.io/v2/projects/paper/versions/${version}/builds/${build}/downloads/${filename}`;
  log.info("downloading Paper", { version, build, url: downloadUrl });
  await downloadTo(downloadUrl, dest);
}

// ─────────────────────────────────────────────────────────────────────────────
// Purpur  (paper fork)
// ─────────────────────────────────────────────────────────────────────────────
async function downloadPurpur(version: string, dest: string) {
  const url = `https://api.purpurmc.org/v2/purpur/${version}/latest/download`;
  log.info("downloading Purpur", { version, url });
  await downloadTo(url, dest);
}

// ─────────────────────────────────────────────────────────────────────────────
// Vanilla (Mojang)
// ─────────────────────────────────────────────────────────────────────────────
async function downloadVanilla(version: string, dest: string) {
  const manifestUrl = "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json";
  const manifest = await (await fetch(manifestUrl)).json() as {
    versions: { id: string; url: string }[];
  };
  const entry = manifest.versions.find((v) => v.id === version);
  if (!entry) throw new Error(`Vanilla version ${version} not found in Mojang manifest`);

  const versionMeta = await (await fetch(entry.url)).json() as {
    downloads: { server: { url: string } };
  };
  const url = versionMeta.downloads.server.url;
  log.info("downloading Vanilla", { version, url });
  await downloadTo(url, dest);
}

// ─────────────────────────────────────────────────────────────────────────────
// Fabric
// ─────────────────────────────────────────────────────────────────────────────
async function downloadFabric(version: string, dest: string) {
  // Get latest stable loader
  const loaderRes = await fetch("https://meta.fabricmc.net/v2/versions/loader");
  const loaders = await loaderRes.json() as { version: string; stable: boolean }[];
  const loader = loaders.find((l) => l.stable)?.version ?? loaders[0]?.version;
  if (!loader) throw new Error("No Fabric loader found");

  // Get latest installer
  const installerRes = await fetch("https://meta.fabricmc.net/v2/versions/installer");
  const installers = await installerRes.json() as { version: string; stable: boolean }[];
  const installer = installers.find((i) => i.stable)?.version ?? installers[0]?.version;
  if (!installer) throw new Error("No Fabric installer found");

  const url = `https://meta.fabricmc.net/v2/versions/loader/${version}/${loader}/${installer}/server/jar`;
  log.info("downloading Fabric", { version, loader, installer, url });
  await downloadTo(url, dest);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the path to the JAR for the given loader + version, downloading
 * it first if it doesn't already exist.
 */
export async function ensureJar(loader: string, version: string): Promise<string> {
  await ensureJarsDir();
  const dest = path.join(JARS_DIR, `${loader}-${version}.jar`);

  if (await jarExists(dest)) {
    log.info("jar already cached", { loader, version });
    return dest;
  }

  log.info("jar not cached — downloading", { loader, version });

  switch (loader) {
    case "paper":
    case "spigot":  // fallback spigot → paper
      await downloadPaper(version, dest);
      break;
    case "purpur":
      await downloadPurpur(version, dest);
      break;
    case "fabric":
    case "quilt":   // fallback quilt → fabric
      await downloadFabric(version, dest);
      break;
    case "vanilla":
    case "forge":   // forge requires complex installer — use vanilla for now
    case "neoforge":
      await downloadVanilla(version, dest);
      break;
    default:
      // Unknown loader — try paper as a sensible default
      log.warn("unknown loader, falling back to paper", { loader, version });
      await downloadPaper(version, dest);
  }

  log.info("jar downloaded", { loader, version, dest });
  return dest;
}
