import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/clerk/auth";
import type { Database } from "@/lib/supabase/types";

export async function GET() {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("regions")
    .select("*")
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  console.log("POST /api/regions - userId:", userId);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await isAdmin();
  console.log("POST /api/regions - isAdmin:", admin);
  if (!admin) return NextResponse.json({ error: "Forbidden - not admin" }, { status: 403 });

  const body = await req.json();
  console.log("POST /api/regions - body:", body);
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("regions")
    .insert(body as Database["mcloud"]["Tables"]["regions"]["Insert"])
    .select()
    .single();

  console.log("POST /api/regions - insert result:", { data, error });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
