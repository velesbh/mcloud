import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/clerk/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * Quota definition: max_allocations in the user's profile = max ports
 * that can be assigned to THIS server (including the primary one).
 * Counting is ALWAYS .eq("server_id", id) so GET and POST always agree.
 */

async function getServerAndCheckAccess(userId: string, id: string) {
  const admin = createAdminSupabaseClient();
  const { data: server } = await admin
    .from("servers")
    .select("id, node_id, clerk_user_id, allocation_id")
    .eq("id", id)
    .single();
  if (!server) return { error: "Not found", status: 404 as const };
  if (server.clerk_user_id !== userId && !(await isAdmin()))
    return { error: "Forbidden", status: 403 as const };
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
  const r = await getServerAndCheckAccess(userId, id);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

  const admin = createAdminSupabaseClient();
  const ownerClerkId = r.server.clerk_user_id;

  // ── This server's allocations (the source of truth for quota) ──────────────
  const { data: here = [] } = await admin
    .from("allocations")
    .select("id, ip, local_ip, port, server_id")
    .eq("server_id", id)
    .order("port", { ascending: true });

  // ── Other allocations on this node (owned by same user) — display only ─────
  const { data: userServers = [] as { id: string }[] } = await admin
    .from("servers")
    .select("id")
    .eq("clerk_user_id", ownerClerkId)
    .eq("node_id", r.server.node_id!)
    .neq("id", id);

  const otherIds = userServers.map((s) => s.id);
  const { data: elsewhere = [] } = otherIds.length > 0
    ? await admin
        .from("allocations")
        .select("id, ip, local_ip, port, server_id")
        .eq("node_id", r.server.node_id!)
        .in("server_id", otherIds)
        .order("port", { ascending: true })
    : { data: [] };

  // ── Free ports on this node ────────────────────────────────────────────────
  const { count: freeCount } = await admin
    .from("allocations")
    .select("id", { count: "exact", head: true })
    .eq("node_id", r.server.node_id!)
    .is("server_id", null);

  // ── Quota ─────────────────────────────────────────────────────────────────
  const { data: profile } = await admin
    .from("profiles")
    .select("max_allocations")
    .eq("clerk_user_id", ownerClerkId)
    .single();
  const max = (profile as { max_allocations?: number | null } | null)?.max_allocations ?? 5;
  const used = here.length;

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
  const r = await getServerAndCheckAccess(userId, id);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

  const body = await req.json();
  if (body.action !== "claim") return NextResponse.json({ error: "Bad action" }, { status: 400 });

  const admin = createAdminSupabaseClient();
  const adminCaller = await isAdmin();

  // Quota check — same count as GET: .eq("server_id", id)
  if (!adminCaller) {
    const { data: profile } = await admin
      .from("profiles")
      .select("max_allocations")
      .eq("clerk_user_id", r.server.clerk_user_id)
      .single();
    const max = (profile as { max_allocations?: number | null } | null)?.max_allocations ?? 5;

    const { count: used } = await admin
      .from("allocations")
      .select("id", { head: true, count: "exact" })
      .eq("server_id", id);

    if ((used ?? 0) >= max) {
      return NextResponse.json(
        { error: "Quota reached", message: `This server has ${used}/${max} ports. Ask your admin to increase your allocation quota.` },
        { status: 403 }
      );
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
    return NextResponse.json(
      { error: "No free ports", message: "This node has no free allocations. Ask your admin to add more." },
      { status: 503 }
    );
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
  const r = await getServerAndCheckAccess(userId, id);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

  const admin = createAdminSupabaseClient();
  const body = await req.json();
  const allocId = body.allocation_id as string | undefined;
  if (!allocId) return NextResponse.json({ error: "Missing allocation_id" }, { status: 400 });
  if (allocId === r.server.allocation_id) {
    return NextResponse.json({ error: "Cannot release the primary port" }, { status: 400 });
  }

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
