import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/clerk/auth";
import type { Database } from "@/lib/supabase/types";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { node_id, ip, port_from, port_to, local_ip } = await req.json();

  if (!node_id || !ip || typeof port_from !== "number" || typeof port_to !== "number") {
    return NextResponse.json({ error: "node_id, ip, port_from, port_to are required" }, { status: 400 });
  }

  if (port_from > port_to) {
    return NextResponse.json({ error: "port_from must be <= port_to" }, { status: 400 });
  }

  if (port_to - port_from > 500) {
    return NextResponse.json({ error: "Range too large (max 500 ports at once)" }, { status: 400 });
  }

  const rows: Database["mcloud"]["Tables"]["allocations"]["Insert"][] = [];
  for (let p = port_from; p <= port_to; p++) {
    rows.push({
      node_id,
      ip,
      port: p,
      local_ip: local_ip || "0.0.0.0",
    });
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("allocations")
    .insert(rows)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ created: data?.length ?? 0 }, { status: 201 });
}
