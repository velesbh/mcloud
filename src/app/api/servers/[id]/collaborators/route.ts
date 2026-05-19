import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/clerk/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// ─── GET: list collaborators ──────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = createAdminSupabaseClient();

  // Ensure caller owns or is collaborator
  const { data: server } = await admin
    .from("servers")
    .select("clerk_user_id")
    .eq("id", id)
    .single();

  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const adminCaller = await isAdmin();
  if (!adminCaller && server.clerk_user_id !== userId) {
    const { data: c } = await admin
      .from("server_collaborators")
      .select("id").eq("server_id", id).eq("clerk_user_id", userId).maybeSingle();
    if (!c) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await admin
    .from("server_collaborators")
    .select("*")
    .eq("server_id", id)
    .order("added_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// ─── POST: add collaborator by email ─────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { email } = (await req.json()) as { email?: string };
  if (!email?.trim()) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const admin = createAdminSupabaseClient();

  // Only the owner can add collaborators
  const { data: server } = await admin
    .from("servers")
    .select("clerk_user_id")
    .eq("id", id)
    .single();

  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const adminCaller2 = await isAdmin();
  if (!adminCaller2 && server.clerk_user_id !== userId) {
    return NextResponse.json({ error: "Only the server owner can add collaborators" }, { status: 403 });
  }

  // Look up the user in Clerk by email
  const clerkRes = await fetch(
    `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email.trim())}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!clerkRes.ok) {
    return NextResponse.json({ error: "Failed to look up user" }, { status: 500 });
  }

  const clerkUsers = (await clerkRes.json()) as { id: string; email_addresses: { email_address: string }[] }[];
  const found = clerkUsers.find((u) =>
    u.email_addresses.some((e) => e.email_address.toLowerCase() === email.trim().toLowerCase())
  );

  if (!found) {
    return NextResponse.json(
      { error: "No MCloud account found for that email. They need to sign up first." },
      { status: 404 }
    );
  }

  if (found.id === userId) {
    return NextResponse.json({ error: "You can't add yourself as a collaborator" }, { status: 400 });
  }

  if (found.id === server.clerk_user_id) {
    return NextResponse.json({ error: "That user is already the server owner" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("server_collaborators")
    .insert({ server_id: id, clerk_user_id: found.id, email: email.trim().toLowerCase() })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "That user is already a collaborator" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

// ─── DELETE: remove collaborator ─────────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { collaboratorId } = (await req.json()) as { collaboratorId: string };

  const admin = createAdminSupabaseClient();

  const { data: server } = await admin
    .from("servers")
    .select("clerk_user_id")
    .eq("id", id)
    .single();

  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Owner can remove anyone; collaborators can remove themselves
  const { data: collab } = await admin
    .from("server_collaborators")
    .select("clerk_user_id")
    .eq("id", collaboratorId)
    .eq("server_id", id)
    .single();

  if (!collab) return NextResponse.json({ error: "Collaborator not found" }, { status: 404 });

  const isOwner = server.clerk_user_id === userId;
  const isSelf = collab.clerk_user_id === userId;
  if (!isOwner && !isSelf) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await admin.from("server_collaborators").delete().eq("id", collaboratorId);
  return NextResponse.json({ success: true });
}
