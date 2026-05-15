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
    .from("server_files")
    .select("*")
    .eq("server_id", id)
    .order("is_directory", { ascending: false })
    .order("name", { ascending: true });

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
  const body = await req.json();

  // Verify ownership
  const supabase = await createServerSupabaseClient();
  const { data: server } = await supabase
    .from("servers")
    .select("id")
    .eq("id", id)
    .single();
  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const adminSupabase = createAdminSupabaseClient();

  if (body.type === "folder") {
    const { error } = await adminSupabase.from("server_files").upsert({
      server_id: id,
      path: body.path,
      name: body.name,
      is_directory: true,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true }, { status: 201 });
  }

  // File: register metadata (client uploads directly to Storage)
  const { error } = await adminSupabase.from("server_files").upsert({
    server_id: id,
    path: body.path,
    name: body.name,
    is_directory: false,
    size_bytes: body.size ?? 0,
    mime_type: body.mimeType ?? null,
    storage_path: body.storagePath ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true }, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { path } = await req.json();

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("server_files")
    .delete()
    .eq("server_id", id)
    .eq("path", path);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
