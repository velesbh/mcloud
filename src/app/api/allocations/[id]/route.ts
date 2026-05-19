import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/clerk/auth";
import type { Database } from "@/lib/supabase/types";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const rawBody = await req.json() as Database["mcloud"]["Tables"]["allocations"]["Update"];
  const supabase = createAdminSupabaseClient();

  // If setting as default, first unset any existing default on the same node
  if (rawBody.is_default === true) {
    const { data: current } = await supabase
      .from("allocations").select("node_id").eq("id", id).single();
    if (current?.node_id) {
      await supabase
        .from("allocations")
        .update({ is_default: false })
        .eq("node_id", current.node_id)
        .neq("id", id);
    }
  }

  const { data, error } = await supabase
    .from("allocations")
    .update(rawBody)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("allocations").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
