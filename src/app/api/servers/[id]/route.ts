import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { updateServerSchema } from "@/lib/validations/server";
import type { Database } from "@/lib/supabase/types";
import { isAdmin } from "@/lib/clerk/auth";
import { dispatchFileOp } from "@/lib/server/file-ops-bridge";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = createAdminSupabaseClient();

  const { data, error } = await admin
    .from("servers")
    .select("*, allocations!servers_allocation_id_fkey(ip, port), regions(name, flag_emoji, slug), nodes(name, fqdn)")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("[GET /api/servers/[id]] supabase error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Explicit access check — never rely solely on RLS
  const adminAccess = await isAdmin();
  if (!adminAccess && data.clerk_user_id !== userId) {
    // Check if caller is a collaborator
    const { data: collab } = await admin
      .from("server_collaborators")
      .select("id")
      .eq("server_id", id)
      .eq("clerk_user_id", userId)
      .maybeSingle();
    if (!collab) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = updateServerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Extract env_vars fields before sending to DB
  const { startup_jar, java_version, ...dbFields } = parsed.data;

  // Merge startup_jar / java_version into env_vars if provided
  let updatePayload: Database["mcloud"]["Tables"]["servers"]["Update"] = dbFields;
  if (startup_jar !== undefined || java_version !== undefined) {
    const adminClient = createAdminSupabaseClient();
    const { data: current } = await adminClient
      .from("servers").select("env_vars").eq("id", id).single();
    const existing = (current?.env_vars as Record<string, unknown>) ?? {};
    updatePayload = {
      ...dbFields,
      env_vars: {
        ...existing,
        ...(startup_jar !== undefined ? { startup_jar } : {}),
        ...(java_version !== undefined ? { java_version } : {}),
      },
    };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("servers")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = createAdminSupabaseClient();

  // Fetch server details needed for cleanup before deleting the row
  const { data: server } = await admin
    .from("servers")
    .select("id, clerk_user_id, node_id, allocation_id, status")
    .eq("id", id)
    .single();

  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Ownership check (admins may also delete)
  const adminUser = await isAdmin();
  if (server.clerk_user_id !== userId && !adminUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 1. Tell the daemon to wipe the server directory (best-effort — don't block deletion)
  if (server.node_id) {
    // dispatch "delete" with path "/" → resolves to {serversDir}/{serverId} and rm -rf's it
    void dispatchFileOp(server.node_id, id, "delete", { path: "/" }, 30_000).catch(() => {
      // Non-fatal — DB cleanup proceeds regardless
    });
  }

  // 2. Free the allocation so it can be reused
  if (server.allocation_id) {
    await admin
      .from("allocations")
      .update({ server_id: null })
      .eq("id", server.allocation_id);
  }

  // 3. Delete the DB row (cascades to mod_installations, server_backups,
  //    console_events, server_metrics, server_files)
  const { error } = await admin.from("servers").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
