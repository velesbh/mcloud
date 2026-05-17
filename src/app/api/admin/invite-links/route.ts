import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/clerk/auth";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("invite_links")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const {
    max_uses = 1,
    max_servers = 1,
    max_ram_mb = 1024,
    max_disk_mb = 5120,
    max_cpu_percent = 100,
    expires_at,
  } = body;

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("invite_links")
    .insert({
      created_by: userId,
      max_uses,
      max_servers,
      max_ram_mb,
      max_disk_mb,
      max_cpu_percent,
      expires_at: expires_at ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
