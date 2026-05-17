import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/clerk/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { dispatchWorldOp } from "@/lib/server/file-ops-bridge";

/**
 * Multipart upload bridge for worlds.
 * 1. Receive .zip from browser
 * 2. Stage to Supabase Storage at server-files/{id}/world-inbox/{name}
 * 3. Tell daemon to extract it as a new world
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = createAdminSupabaseClient();

  const { data: server } = await admin
    .from("servers")
    .select("id, node_id, clerk_user_id")
    .eq("id", id)
    .single();
  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (server.clerk_user_id !== userId && !(await isAdmin()))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!server.node_id)
    return NextResponse.json({ error: "No node assigned" }, { status: 409 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const desiredName = (formData.get("name") as string | null) ?? undefined;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!file.name.toLowerCase().endsWith(".zip"))
    return NextResponse.json({ error: "Only .zip files allowed" }, { status: 400 });

  const safe = file.name.replace(/[^\w.\-]/g, "_");
  const storageKey = `${id}/world-inbox/${Date.now()}-${safe}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from("server-files")
    .upload(storageKey, buf, { contentType: "application/zip", upsert: true });
  if (uploadError)
    return NextResponse.json({ error: `storage: ${uploadError.message}` }, { status: 500 });

  const result = await dispatchWorldOp(server.node_id, id, "import", {
    storageKey,
    name: desiredName,
  }, 180_000);

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json(result.data);
}

export const runtime = "nodejs";
export const maxDuration = 60;
