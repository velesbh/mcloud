import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/clerk/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * GET /api/servers/[id]/ping
 *
 * Live-pings a server through mcstatus.io and returns player count, MOTD,
 * version string, latency, and the player list (when query is enabled on
 * the server). Cached for 10 s in the Next.js Data Cache to stay within
 * mcstatus.io's rate limit (~5 r/s).
 */

interface McStatusJava {
  online: boolean;
  host?: string;
  port?: number;
  version?: { name_clean?: string; protocol?: number };
  players?: { online?: number; max?: number; list?: { name_clean: string; uuid: string }[] };
  motd?: { clean?: string };
  icon?: string | null;
  retrieved_at?: number;
  latency?: number;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = createAdminSupabaseClient();
  const { data: server } = await admin
    .from("servers")
    .select("id, edition, clerk_user_id, allocations!servers_allocation_id_fkey(ip, port)")
    .eq("id", id)
    .single();

  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (server.clerk_user_id !== userId && !(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const alloc = Array.isArray(server.allocations)
    ? (server.allocations[0] as { ip: string; port: number } | undefined)
    : (server.allocations as unknown as { ip: string; port: number } | null);
  if (!alloc) return NextResponse.json({ online: false, reason: "noAllocation" });

  const edition = server.edition === "bedrock" ? "bedrock" : "java";
  const address = `${alloc.ip}:${alloc.port}`;
  const url = `https://api.mcstatus.io/v2/status/${edition}/${address}`;

  try {
    const res = await fetch(url, {
      next: { revalidate: 10 },
      headers: { "User-Agent": "MCloud/1.0 (+admin@enzonic.com)" },
    });
    if (!res.ok) {
      return NextResponse.json({ online: false, reason: "pingFailed", status: res.status });
    }
    const data: McStatusJava = await res.json();
    return NextResponse.json({
      online: data.online,
      address,
      players_online: data.players?.online ?? 0,
      players_max: data.players?.max ?? 0,
      player_list: data.players?.list ?? [],
      motd: data.motd?.clean ?? "",
      version: data.version?.name_clean ?? "",
      latency: data.latency ?? null,
      retrieved_at: data.retrieved_at ?? Date.now(),
    });
  } catch (err) {
    return NextResponse.json({ online: false, reason: "fetchError", error: String(err) });
  }
}
