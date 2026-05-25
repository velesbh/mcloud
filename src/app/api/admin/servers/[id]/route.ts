import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/clerk/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * PATCH /api/admin/servers/[id]
 * Admin-only mutations to a server row. Currently supports the fields below;
 * extend as needed.
 *
 * Body (all optional):
 *   is_premium    boolean — exempt from hibernation sweep
 *   ram_mb        number
 *   disk_mb       number
 *   cpu_percent   number
 *   name          string
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const allowed = ["is_premium", "ram_mb", "disk_mb", "cpu_percent", "name"] as const;
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("servers")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
