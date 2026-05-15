import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

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

  // Verify ownership
  const supabase = await createServerSupabaseClient();
  const { data: server } = await supabase
    .from("servers")
    .select("id, loader, game_version")
    .eq("id", id)
    .single();
  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const adminSupabase = createAdminSupabaseClient();

  const { data, error } = await adminSupabase
    .from("mod_installations")
    .upsert({
      server_id: id,
      modrinth_project_id: body.modrinthProjectId,
      version_id: body.versionId,
      name: body.name,
      icon_url: body.iconUrl ?? null,
      type: body.type ?? "mod",
      loader: body.loader ?? null,
      game_version: body.gameVersion ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("mod_installations")
    .delete()
    .eq("server_id", id)
    .eq("modrinth_project_id", projectId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
