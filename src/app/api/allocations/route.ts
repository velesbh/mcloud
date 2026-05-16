import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/clerk/auth";
import type { Database } from "@/lib/supabase/types";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = createAdminSupabaseClient();
  // Don't embed servers — two FK paths exist (allocations.server_id and servers.allocation_id)
  // and PostgREST refuses to pick one. Instead fetch server names in a separate query below.
  const { data, error } = await supabase
    .from("allocations")
    .select("id, node_id, ip, local_ip, port, server_id, assigned_at, created_at, nodes!node_id(name)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[allocations GET]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];

  // Fetch server names separately to avoid the ambiguous FK embed error
  const serverIds = [...new Set(rows.map((r) => r.server_id).filter(Boolean))] as string[];
  const serverNameMap = new Map<string, string>();
  if (serverIds.length > 0) {
    const { data: servers } = await supabase
      .from("servers")
      .select("id, name")
      .in("id", serverIds);
    for (const s of servers ?? []) serverNameMap.set(s.id, s.name);
  }

  const enriched = rows.map((r) => ({
    ...r,
    servers: r.server_id ? { name: serverNameMap.get(r.server_id) ?? null } : null,
  }));

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { node_id, ip, port, local_ip } = await req.json();
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("allocations")
    .insert({
      node_id,
      ip,
      port,
      local_ip: local_ip || "0.0.0.0",
    } as Database["mcloud"]["Tables"]["allocations"]["Insert"])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
