import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/clerk/auth";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = createAdminSupabaseClient();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get server counts per user
  const { data: serverCounts } = await supabase
    .from("servers")
    .select("clerk_user_id");

  const countMap = (serverCounts ?? []).reduce((acc, s) => {
    acc[s.clerk_user_id] = (acc[s.clerk_user_id] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const result = (profiles ?? []).map((p) => ({
    ...p,
    server_count: countMap[p.clerk_user_id] ?? 0,
  }));

  return NextResponse.json(result);
}
