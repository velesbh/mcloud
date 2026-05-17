import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await params;
  const supabase = createAdminSupabaseClient();

  // Find the invite link
  const { data: invite, error: fetchError } = await supabase
    .from("invite_links")
    .select("*")
    .eq("code", code)
    .single();

  if (fetchError || !invite) {
    return NextResponse.redirect(new URL("/en/dashboard?invite=invalid", _req.url));
  }

  // Check if expired
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.redirect(new URL("/en/dashboard?invite=expired", _req.url));
  }

  // Check if maxed out
  if (invite.uses >= invite.max_uses) {
    return NextResponse.redirect(new URL("/en/dashboard?invite=maxed", _req.url));
  }

  // Apply quota to user's profile
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      max_servers: invite.max_servers,
      max_ram_mb: invite.max_ram_mb,
      max_disk_mb: invite.max_disk_mb,
      max_cpu_percent: invite.max_cpu_percent,
    })
    .eq("clerk_user_id", userId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Increment uses
  await supabase
    .from("invite_links")
    .update({ uses: invite.uses + 1 })
    .eq("code", code);

  return NextResponse.redirect(new URL("/en/dashboard?invite=redeemed", _req.url));
}
