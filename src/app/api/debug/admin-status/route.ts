import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/clerk/auth";

export async function GET() {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const adminCheck = await isAdmin();
  const email = user?.emailAddresses[0]?.emailAddress;
  const clerkRole = user?.publicMetadata?.role;

  // Check database profile
  const supabase = createAdminSupabaseClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("clerk_user_id", userId)
    .single();

  return NextResponse.json({
    userId,
    email,
    clerkRole,
    isAdminCheck: adminCheck,
    dbProfile: profile || null,
    dbProfileError: profileError?.message || null,
  });
}
