import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { dispatchFileOp } from "@/lib/server/file-ops-bridge";

// Maps a server loader to the Modrinth loader slug used for version queries.
// Returns null for loaders that don't support mods (vanilla, bedrock).
function toModrinthLoader(loader: string): string | null {
  switch (loader.toLowerCase()) {
    case "paper":
    case "spigot":
    case "bukkit":
    case "purpur":
      return "paper";
    case "fabric":
      return "fabric";
    case "forge":
      return "forge";
    case "neoforge":
      return "neoforge";
    case "quilt":
      return "quilt";
    default:
      return null;
  }
}

// Returns the target folder on the server filesystem for a given loader.
function targetFolder(loader: string): string {
  switch (loader.toLowerCase()) {
    case "paper":
    case "spigot":
    case "bukkit":
    case "purpur":
      return "/plugins";
    default:
      return "/mods";
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("mod_installations")
    .select("*")
    .eq("server_id", id)
    .order("installed_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify ownership and fetch node_id for file dispatch
  const supabase = await createServerSupabaseClient();
  const { data: server } = await supabase
    .from("servers")
    .select("id, loader, game_version, node_id")
    .eq("id", id)
    .single();
  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const adminSupabase = createAdminSupabaseClient();

  // Resolve the best Modrinth version for this server's game_version + loader
  // so we can store the correct version_id and download the actual file.
  let resolvedVersionId: string | undefined = body.versionId;
  let downloadUrl: string | undefined;
  let downloadFilename: string | undefined;

  const modrinthLoader = server.loader ? toModrinthLoader(server.loader) : null;

  if (server.node_id && modrinthLoader && server.game_version && body.modrinthProjectId) {
    try {
      const gameVersionsParam = encodeURIComponent(JSON.stringify([server.game_version]));
      const loadersParam = encodeURIComponent(JSON.stringify([modrinthLoader]));
      const modrinthUrl =
        `https://api.modrinth.com/v2/project/${body.modrinthProjectId}/version` +
        `?game_versions=${gameVersionsParam}&loaders=${loadersParam}`;

      const modrinthRes = await fetch(modrinthUrl, {
        headers: {
          "User-Agent": process.env.MODRINTH_USER_AGENT ?? "MCloud/1.0",
        },
      });

      if (modrinthRes.ok) {
        const versions = (await modrinthRes.json()) as Array<{
          id: string;
          files?: Array<{ primary: boolean; url: string; filename: string }>;
        }>;

        if (versions.length > 0) {
          resolvedVersionId = versions[0].id;
          const primaryFile =
            versions[0].files?.find((f) => f.primary) ?? versions[0].files?.[0];
          downloadUrl = primaryFile?.url;
          downloadFilename = primaryFile?.filename;
        }
      }
    } catch (err) {
      console.error("[mods] Failed to resolve Modrinth version:", err);
    }
  }

  const { data, error } = await adminSupabase
    .from("mod_installations")
    .upsert({
      server_id: id,
      modrinth_project_id: body.modrinthProjectId,
      version_id: resolvedVersionId ?? body.versionId,
      name: body.name,
      icon_url: body.iconUrl ?? null,
      type: body.type ?? "mod",
      loader: body.loader ?? null,
      game_version: body.gameVersion ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Dispatch the file download to the daemon if we have everything we need
  if (server.node_id && modrinthLoader && downloadUrl && downloadFilename) {
    const folder = targetFolder(server.loader ?? "");
    const result = await dispatchFileOp(
      server.node_id,
      id,
      "import-url",
      {
        url: downloadUrl,
        targetPath: `${folder}/${downloadFilename}`,
      },
      120_000
    );

    if (!result.ok) {
      console.error(
        `[mods] File dispatch failed for server ${id} (mod ${body.modrinthProjectId}):`,
        result.error
      );
      // DB record was created; file can be re-synced via file manager.
    }
  }

  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { projectId } = await req.json();

  // TODO: also delete the mod file from the server filesystem via dispatchFileOp.
  // The filename is not stored in mod_installations, so we can't easily look it up here.
  // Until the schema stores the filename, users can remove the file manually via the file manager.

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("mod_installations")
    .delete()
    .eq("server_id", id)
    .eq("modrinth_project_id", projectId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
