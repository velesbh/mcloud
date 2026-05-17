import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { ADMIN_EMAIL } from "@/lib/constants";
import { FREE_TIER } from "@/lib/constants";

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = payload as {
    type: string;
    data: {
      id: string;
      email_addresses: { email_address: string }[];
      first_name?: string;
      last_name?: string;
      image_url?: string;
    };
  };

  if (event.type === "user.created" || event.type === "user.updated") {
    const user = event.data;
    const email = user.email_addresses[0]?.email_address ?? "";
    const displayName =
      [user.first_name, user.last_name].filter(Boolean).join(" ") || null;
    const isAdmin = email === ADMIN_EMAIL;

    const supabase = createAdminSupabaseClient();

    // Check if a stub profile was auto-created by admin import — if so, preserve
    // its bumped resource limits and only update identity fields.
    const { data: existing } = await supabase
      .from("profiles")
      .select("max_servers, max_ram_mb, max_disk_mb, max_cpu_percent, max_allocations")
      .eq("clerk_user_id", user.id)
      .maybeSingle();

    const { error } = await supabase.from("profiles").upsert({
      clerk_user_id: user.id,
      email,
      display_name: displayName,
      avatar_url: user.image_url ?? null,
      role: isAdmin ? "admin" : "user",
      // Preserve elevated limits from admin import; otherwise apply free-tier defaults
      max_servers: existing ? Math.max(existing.max_servers ?? 0, FREE_TIER.MAX_SERVERS) : FREE_TIER.MAX_SERVERS,
      max_ram_mb:  existing ? Math.max(existing.max_ram_mb  ?? 0, FREE_TIER.RAM_MB)      : FREE_TIER.RAM_MB,
      max_disk_mb: existing ? Math.max(existing.max_disk_mb ?? 0, FREE_TIER.DISK_MB)     : FREE_TIER.DISK_MB,
    }, { onConflict: "clerk_user_id" });

    if (error) {
      console.error("Failed to create profile:", error);
      return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
    }

    if (isAdmin) {
      try {
        const clerkRes = await fetch(
          `https://api.clerk.com/v1/users/${user.id}/metadata`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ public_metadata: { role: "admin" } }),
          }
        );
        if (!clerkRes.ok) {
          console.error("Failed to set admin metadata in Clerk");
        }
      } catch (e) {
        console.error("Clerk metadata error:", e);
      }
    }
  }

  return NextResponse.json({ success: true });
}
