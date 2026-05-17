import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";

const BASE = "https://mcjarfiles.com/api";

// Map our internal loader names → mcjarfiles type/variant
const LOADER_MAP: Record<string, { type: string; variant: string }> = {
  vanilla:  { type: "vanilla",  variant: "release" },
  paper:    { type: "servers",  variant: "paper" },
  spigot:   { type: "servers",  variant: "paper" },   // no spigot in API — paper fallback
  purpur:   { type: "servers",  variant: "purpur" },
  fabric:   { type: "modded",   variant: "fabric" },
  forge:    { type: "modded",   variant: "forge" },
  neoforge: { type: "modded",   variant: "neoforge" },
  quilt:    { type: "modded",   variant: "fabric" },  // quilt → fabric fallback
};

const FALLBACK = ["1.21.4", "1.21.3", "1.21.1", "1.20.6", "1.20.4", "1.19.4", "1.18.2", "1.16.5", "1.12.2", "1.8.9"];

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const loader = req.nextUrl.searchParams.get("loader") ?? "paper";
  const { type, variant } = LOADER_MAP[loader] ?? LOADER_MAP.paper;

  try {
    const res = await fetch(`${BASE}/get-versions/${type}/${variant}`, {
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
    return NextResponse.json({ versions: FALLBACK }, {
      headers: { "Cache-Control": "public, s-maxage=60" },
    });
  }
}
