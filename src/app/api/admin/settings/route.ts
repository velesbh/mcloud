import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/clerk/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/settings
 * Returns all admin settings as a flat { key: value } object.
 * Requires admin auth.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.from("admin_settings").select("key, value");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result: Record<string, unknown> = {};
  for (const row of data ?? []) {
    result[row.key] = row.value;
  }
  return NextResponse.json(result);
}

/**
 * PATCH /api/admin/settings
 * Updates one or more settings.
 * Body: { key: string; value: unknown }[]
 * Requires admin auth.
 */
export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: "Body must be an array of { key, value } objects" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  for (const item of body as { key: string; value: unknown }[]) {
    const { error } = await admin
      .from("admin_settings")
      .upsert({ key: item.key, value: item.value as import("@/lib/supabase/types").Json, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
