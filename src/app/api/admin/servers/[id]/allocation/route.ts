import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/clerk/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * PATCH /api/admin/servers/[id]/allocation
 * Body: { ip: string; port: number }  OR  { allocation_id: string }
 *
 * Reassigns a server's primary allocation:
 *  1. Releases the current primary allocation (server_id → null)
 *  2. Assigns the new allocation (server_id → serverId)
 *  3. Updates servers.allocation_id
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = (await req.json()) as { ip?: string; port?: number; allocation_id?: string };

  const admin = createAdminSupabaseClient();

  // Fetch current server
  const { data: server } = await admin
    .from("servers")
    .select("id, allocation_id, node_id")
    .eq("id", id)
    .single();

  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  // Resolve the target allocation
  let newAllocId: string;

  if (body.allocation_id) {
    newAllocId = body.allocation_id;
  } else if (body.ip && body.port != null) {
    // Find by IP:port (search across the server's node)
    const { data: found } = await admin
      .from("allocations")
      .select("id")
      .eq("ip", body.ip)
      .eq("port", body.port)
      .maybeSingle();

    if (!found) {
      return NextResponse.json(
        { error: `No allocation found for ${body.ip}:${body.port}` },
        { status: 404 }
      );
    }
    newAllocId = found.id;
  } else {
    return NextResponse.json({ error: "Provide ip+port or allocation_id" }, { status: 400 });
  }

  if (newAllocId === server.allocation_id) {
    return NextResponse.json({ error: "That allocation is already assigned" }, { status: 400 });
  }

  // 1. Free the current primary allocation
  if (server.allocation_id) {
    await admin
      .from("allocations")
      .update({ server_id: null, assigned_at: null })
      .eq("id", server.allocation_id);
  }

  // 2. Claim the new allocation
  await admin
    .from("allocations")
    .update({ server_id: id, assigned_at: new Date().toISOString() })
    .eq("id", newAllocId);

  // 3. Point the server at its new allocation
  const { data: updated, error } = await admin
    .from("servers")
    .update({ allocation_id: newAllocId })
    .eq("id", id)
    .select("id, allocation_id, allocations!allocation_id(ip, port)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(updated);
}
