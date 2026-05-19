import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * GET /api/profiles/[userId]
 * Returns display_name and email for a given Clerk user ID.
 * Accessible to any authenticated user (names/emails shown to server collaborators are not sensitive).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId: callerId } = await auth();
  if (!callerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;

  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("profiles")
    .select("display_name, email")
    .eq("clerk_user_id", userId)
    .single();

  if (!data) return NextResponse.json({ display_name: null, email: null });
  return NextResponse.json(data);
}
