import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; backupId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, backupId } = await params;
  const { action } = await req.json();

  const supabase = await createServerSupabaseClient();
  const { data: server } = await supabase
    .from("servers")
    .select("id")
    .eq("id", id)
    .single();
  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "restore") {
    const adminSupabase = createAdminSupabaseClient();
    await adminSupabase
      .from("server_backups")
      .update({ status: "restoring" })
      .eq("id", backupId);

    // Simulate restore
    await adminSupabase
      .from("server_backups")
      .update({ status: "available" })
      .eq("id", backupId);

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; backupId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, backupId } = await params;
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("server_backups")
    .delete()
    .eq("id", backupId)
    .eq("server_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
