import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";

const BASE = "https://mcjarfiles.com/api";

interface LoaderEntry {
  type: string;
  variant: string;
  platform?: string; // bedrock needs /linux or /windows after variant
}

// Map our internal loader names → mcjarfiles type/variant[/platform]
const LOADER_MAP: Record<string, LoaderEntry> = {
  vanilla:  { type: "vanilla",  variant: "release" },
  paper:    { type: "servers",  variant: "paper" },
  spigot:   { type: "servers",  variant: "paper" },    // no spigot endpoint — paper fallback
  purpur:   { type: "servers",  variant: "purpur" },
  fabric:   { type: "modded",   variant: "fabric" },
  forge:    { type: "modded",   variant: "forge" },
  neoforge: { type: "modded",   variant: "neoforge" },
  quilt:    { type: "modded",   variant: "fabric" },   // quilt → fabric fallback
  bedrock:  { type: "bedrock",  variant: "latest", platform: "linux" },
};

const FALLBACK_JAVA    = ["1.21.4", "1.21.3", "1.21.1", "1.20.6", "1.20.4", "1.19.4", "1.18.2", "1.16.5", "1.12.2", "1.8.9"];
const FALLBACK_BEDROCK = ["1.21.50", "1.21.44", "1.21.30"];

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const loader = req.nextUrl.searchParams.get("loader") ?? "paper";
  const entry  = LOADER_MAP[loader] ?? LOADER_MAP.paper;
  const { type, variant, platform } = entry;

  // Build URL — bedrock needs an extra /platform segment
  const url = platform
    ? `${BASE}/get-versions/${type}/${variant}/${platform}`
    : `${BASE}/get-versions/${type}/${variant}`;

  const isBedrock = loader === "bedrock";
  const fallback  = isBedrock ? FALLBACK_BEDROCK : FALLBACK_JAVA;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "MCloud/1.0 (admin@enzonic.com)" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`mcjarfiles ${res.status}`);

    const versions = (await res.json()) as string[];

    return NextResponse.json({ versions }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
    });
  } catch (err) {
    console.error("[mc-versions]", loader, err);
    return NextResponse.json({ versions: fallback }, {
      headers: { "Cache-Control": "public, s-maxage=60" },
    });
  }
}
