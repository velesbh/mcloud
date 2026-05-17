import { NextResponse } from "next/server";

const MANIFEST_URL = "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json";

// Versions older than this are unlikely to be hosted — prune to keep list manageable
const MIN_JAVA_MINOR = 8;

export const revalidate = 3600; // CDN re-fetch once per hour

export async function GET() {
  try {
    const res = await fetch(MANIFEST_URL, {
      next: { revalidate: 3600 },
      headers: { "User-Agent": "MCloud/1.0 (admin@enzonic.com)" },
    });
    if (!res.ok) throw new Error(`Mojang manifest ${res.status}`);

    const manifest = (await res.json()) as {
      versions: { id: string; type: string; releaseTime: string }[];
    };

    const releases = manifest.versions
      .filter((v) => v.type === "release")
      .map((v) => v.id)
      .filter((id) => {
        // Keep 1.X.Y and 1.X where X >= MIN_JAVA_MINOR
        const parts = id.split(".");
        if (parts[0] !== "1") return false;
        const minor = parseInt(parts[1] ?? "0");
        return minor >= MIN_JAVA_MINOR;
      });
      // Already sorted newest-first by Mojang manifest

    return NextResponse.json({ versions: releases });
  } catch (err) {
    console.error("[mc-versions]", err);
    // Fallback to a minimal hardcoded list so the UI never breaks
    return NextResponse.json({
      versions: ["1.21.4", "1.21.3", "1.21.1", "1.20.6", "1.20.4", "1.19.4", "1.18.2", "1.16.5", "1.12.2", "1.8.9"],
    });
  }
}
