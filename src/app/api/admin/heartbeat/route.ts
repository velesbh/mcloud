import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * Called by Vercel Cron every minute.
 * Marks nodes offline if their daemon hasn't sent a heartbeat in the last 75 s.
 * Also resets servers on dead nodes to "offline" so users aren't stuck on "starting".
 */
export async function GET(req: NextRequest) {
  // Vercel Cron passes this header; skip the check in dev
  const auth = req.headers.get("authorization");
  if (process.env.NODE_ENV === "production" && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminSupabaseClient();
  const cutoff = new Date(Date.now() - 75_000).toISOString(); // 75 s ago

  // Find nodes that were online but haven't heartbeated recently
  const { data: staleNodes } = await admin
    .from("nodes")
    .select("id, name")
    .eq("status", "online")
    .or(`last_seen_at.is.null,last_seen_at.lt.${cutoff}`);

  if (!staleNodes?.length) {
    return NextResponse.json({ ok: true, marked: 0 });
  }

  const staleIds = staleNodes.map((n) => n.id);

  // Mark nodes offline
  await admin
    .from("nodes")
    .update({ status: "offline" })
    .in("id", staleIds);

  // Reset transitioning servers on those nodes to "offline"
  // (avoids servers stuck in "starting" / "stopping" forever)
  await admin
    .from("servers")
    .update({ status: "offline" })
    .in("node_id", staleIds)
    .in("status", ["starting", "stopping", "restarting", "running"]);

  console.log(`[heartbeat] Marked offline: ${staleNodes.map((n) => n.name).join(", ")}`);
  return NextResponse.json({ ok: true, marked: staleIds.length, nodes: staleNodes.map((n) => n.name) });
}
