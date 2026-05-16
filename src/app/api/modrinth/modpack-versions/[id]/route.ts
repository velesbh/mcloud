import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/modrinth/modpack-versions/{projectId}
 *
 * Returns the latest versions of a modpack with usable .mrpack download URLs
 * plus inferred game_version + loader. Used by the server creation wizard.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = `https://api.modrinth.com/v2/project/${encodeURIComponent(id)}/version`;
  try {
    const res = await fetch(url, {
      next: { revalidate: 600 },
      headers: { "User-Agent": "MCloud/1.0 (admin@enzonic.com)" },
    });
    if (!res.ok) return NextResponse.json({ error: "fetchFailed" }, { status: 500 });
    const versions = (await res.json()) as Array<{
      id: string;
      name: string;
      version_number: string;
      game_versions: string[];
      loaders: string[];
      date_published: string;
      files: Array<{ url: string; filename: string; primary: boolean }>;
    }>;

    const result = versions.slice(0, 12).map((v) => {
      const file = v.files.find((f) => f.primary && f.filename.endsWith(".mrpack"))
                ?? v.files.find((f) => f.filename.endsWith(".mrpack"))
                ?? v.files[0];
      return {
        id: v.id,
        name: v.name,
        version_number: v.version_number,
        game_version: v.game_versions[0] ?? null,
        loader: v.loaders[0] ?? null,
        published: v.date_published,
        download_url: file?.url ?? null,
        filename: file?.filename ?? null,
      };
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "fetchFailed" }, { status: 500 });
  }
}
