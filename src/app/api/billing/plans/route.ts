import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/clerk/auth";
import { billingPlanSchema } from "@/lib/validations/billing";
import type { Database } from "@/lib/supabase/types";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const showAll = req.nextUrl.searchParams.get("all") === "1";
  const admin = await isAdmin();
  const supabase = createAdminSupabaseClient();

  let query = supabase
    .from("billing_plans")
    .select("*")
    .order("sort_order", { ascending: true });
  if (!(showAll && admin)) query = query.eq("is_visible", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = billingPlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("billing_plans")
    .insert(parsed.data as Database["mcloud"]["Tables"]["billing_plans"]["Insert"])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
