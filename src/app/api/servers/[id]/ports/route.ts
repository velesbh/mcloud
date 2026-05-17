import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/clerk/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * GET /api/servers/[id]/ports
 *   → returns the user's allocations on this server's node + their port quota
 *
 * POST /api/servers/[id]/ports { action: "claim" }
 *   → assigns a free allocation on this node to this server
 *     (within the user's max_allocations quota)
 *
 * DELETE /api/servers/[id]/ports { allocation_id }
 *   → releases an extra allocation back to the pool
 *     (cannot release the server's primary allocation)
 */

async function ensureOwner(userId: string, id: string) {
  const admin = createAdminSupabaseClient();
  const { data: server } = await admin
    .from("servers")
    .select("id, node_id, clerk_user_id, allocation_id")
    .eq("id", id)
    .single();
  if (!server) return { error: "Not found", status: 404 as const };
  if (server.clerk_user_id !== userId && !(await isAdmin())) return { error: "Forbidden", status: 403 as const };
  if (!server.node_id) return { error: "No node assigned", status: 409 as const };
  return { server };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const r = await ensureOwner(userId, id);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const admin = createAdminSupabaseClient();

  // Use the server owner's clerk ID (not the requester's — admins can view others' servers)
  const ownerClerkId = r.server.clerk_user_id;

  // All servers owned by the same user on the same node
  const { data: userServers } = await admin
    .from("servers")
    .select("id")
    .eq("clerk_user_id", ownerClerkId)
    .eq("node_id", r.server.node_id!);
  const userServerIds = (userServers ?? []).map((s) => s.id);

  const { data: claimed } = await admin
    .from("allocations")
    .select("id, ip, local_ip, port, server_id")
    .eq("node_id", r.server.node_id!)
    .in("server_id", userServerIds.length > 0 ? userServerIds : ["00000000-0000-0000-0000-000000000000"]);

  // This server's specific allocations
  const here = (claimed ?? []).filter((a) => a.server_id === id);
  const elsewhere = (claimed ?? []).filter((a) => a.server_id !== id);

  // Free allocations available on this node
  const { count: freeCount } = await admin
    .from("allocations")
    .select("id", { count: "exact", head: true })
    .eq("node_id", r.server.node_id!)
    .is("server_id", null);

  // Owner's quota
  const { data: profile } = await admin
    .from("profiles")
    .select("max_allocations")
    .eq("clerk_user_id", ownerClerkId)
    .single();
  const max = (profile as { max_allocations?: number } | null)?.max_allocations ?? 1;
  const used = (claimed ?? []).length;

  return NextResponse.json({
    here,
    elsewhere,
    free_on_node: freeCount ?? 0,
    quota: { max, used },
    primary_allocation_id: r.server.allocation_id,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const r = await ensureOwner(userId, id);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const admin = createAdminSupabaseClient();

  const body = await req.json();
  if (body.action !== "claim") return NextResponse.json({ error: "Bad action" }, { status: 400 });

  const adminCaller = await isAdmin();

  // Check quota (admins always bypass)
  if (!adminCaller) {
    const ownerClerkId = r.server.clerk_user_id;
    const { data: profile } = await admin
      .from("profiles")
      .select("max_allocations")
      .eq("clerk_user_id", ownerClerkId)
      .single();
    const max = (profile as { max_allocations?: number } | null)?.max_allocations ?? 1;
    const { count: used } = await admin
      .from("allocations")
      .select("id", { head: true, count: "exact" })
      .eq("server_id", id);
    if ((used ?? 0) >= max) {
      return NextResponse.json({ error: "Quota reached", message: `You have ${used}/${max} ports. Upgrade your plan for more.` }, { status: 403 });
    }
  }

  // Grab the lowest free port on this node
  const { data: free } = await admin
    .from("allocations")
    .select("id, ip, local_ip, port")
    .eq("node_id", r.server.node_id!)
    .is("server_id", null)
    .order("port", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!free) {
    return NextResponse.json({ error: "No free ports", message: "This node has no free allocations. Ask your admin to add more." }, { status: 503 });
  }

  await admin
    .from("allocations")
    .update({ server_id: id, assigned_at: new Date().toISOString() })
    .eq("id", free.id);

  return NextResponse.json({ ok: true, claimed: free });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const r = await ensureOwner(userId, id);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const admin = createAdminSupabaseClient();

  const body = await req.json();
  const allocId = body.allocation_id as string | undefined;
  if (!allocId) return NextResponse.json({ error: "Missing allocation_id" }, { status: 400 });
  if (allocId === r.server.allocation_id) {
    return NextResponse.json({ error: "Cannot release the primary port" }, { status: 400 });
  }

  // Only allow releasing allocations that belong to this user's server
  const { data: alloc } = await admin
    .from("allocations")
    .select("id, server_id")
    .eq("id", allocId)
    .single();
  if (!alloc || alloc.server_id !== id) {
    return NextResponse.json({ error: "Allocation not on this server" }, { status: 403 });
  }

  await admin.from("allocations").update({ server_id: null, assigned_at: null }).eq("id", allocId);
  return NextResponse.json({ ok: true });
}
