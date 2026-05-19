import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/clerk/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * POST /api/admin/servers/[id]/ports
 * Body: { ip: string; port: number } OR { allocation_id: string } OR { action: "claim" }
 *
 * Admin-only. Assigns an allocation to a server as an additional port,
 * bypassing the user's quota. Does NOT change the primary allocation.
 *  - action:"claim" → grabs the next free allocation on the server's node
 *  - ip+port        → finds and claims that specific allocation
 *  - allocation_id  → claims that specific allocation
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = (await req.json()) as {
    action?: string;
    ip?: string;
    port?: number;
    allocation_id?: string;
  };

  const admin = createAdminSupabaseClient();

  const { data: server } = await admin
    .from("servers")
    .select("id, node_id, allocation_id")
    .eq("id", id)
    .single();

  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });
  if (!server.node_id) return NextResponse.json({ error: "Server has no node assigned" }, { status: 409 });

  let targetAllocId: string;
  let targetAlloc: { id: string; ip: string; local_ip: string; port: number } | null = null;

  if (body.action === "claim") {
    // Grab the next free port on this node
    const { data: free } = await admin
      .from("allocations")
      .select("id, ip, local_ip, port")
      .eq("node_id", server.node_id)
      .filter("server_id", "is", null)
      .order("port", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!free) {
      return NextResponse.json(
        { error: "No free ports on this node. Add more allocations first." },
        { status: 503 }
      );
    }
    targetAllocId = free.id;
    targetAlloc = free;
  } else if (body.allocation_id) {
    const { data: found } = await admin
      .from("allocations")
      .select("id, ip, local_ip, port, server_id")
      .eq("id", body.allocation_id)
      .maybeSingle();

    if (!found) return NextResponse.json({ error: "Allocation not found" }, { status: 404 });
    if (found.server_id && found.server_id !== id) {
      return NextResponse.json({ error: "That allocation is already assigned to another server" }, { status: 409 });
    }
    targetAllocId = found.id;
    targetAlloc = found;
  } else if (body.ip && body.port != null) {
    const { data: found } = await admin
      .from("allocations")
      .select("id, ip, local_ip, port, server_id")
      .eq("ip", body.ip)
      .eq("port", body.port)
      .maybeSingle();

    if (!found) {
      return NextResponse.json(
        { error: `No allocation exists for ${body.ip}:${body.port}. Create it in the Allocations page first.` },
        { status: 404 }
      );
    }
    if (found.server_id && found.server_id !== id) {
      return NextResponse.json({ error: "That allocation is already assigned to another server" }, { status: 409 });
    }
    targetAllocId = found.id;
    targetAlloc = found;
  } else {
    return NextResponse.json(
      { error: 'Provide action:"claim", ip+port, or allocation_id' },
      { status: 400 }
    );
  }

  // Assign to this server
  const { error } = await admin
    .from("allocations")
    .update({ server_id: id, assigned_at: new Date().toISOString() })
    .eq("id", targetAllocId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, claimed: targetAlloc });
}
