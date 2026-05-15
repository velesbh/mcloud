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

  if (event.type === "user.created") {
    const user = event.data;
    const email = user.email_addresses[0]?.email_address ?? "";
    const displayName =
      [user.first_name, user.last_name].filter(Boolean).join(" ") || null;
    const isAdmin = email === ADMIN_EMAIL;

    const supabase = createAdminSupabaseClient();
    const { error } = await supabase.from("profiles").upsert({
      clerk_user_id: user.id,
      email,
      display_name: displayName,
      avatar_url: user.image_url ?? null,
      role: isAdmin ? "admin" : "user",
      max_servers: FREE_TIER.MAX_SERVERS,
      max_ram_mb: FREE_TIER.RAM_MB,
      max_disk_mb: FREE_TIER.DISK_MB,
    });

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
