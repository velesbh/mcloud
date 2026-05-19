/**
 * Server access helpers — ownership + collaborator checks.
 */
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/clerk/auth";

/**
 * Returns true if userId can access serverId:
 *  - they own the server, OR
 *  - they are listed as a collaborator, OR
 *  - they are a platform admin.
 */
export async function canAccessServer(serverId: string, userId: string): Promise<boolean> {
  if (await isAdmin()) return true;

  const admin = createAdminSupabaseClient();

  const { data: server } = await admin
    .from("servers")
    .select("clerk_user_id")
    .eq("id", serverId)
    .single();

  if (!server) return false;
  if (server.clerk_user_id === userId) return true;

  // Check collaborators
  const { data: collab } = await admin
    .from("server_collaborators")
    .select("id")
    .eq("server_id", serverId)
    .eq("clerk_user_id", userId)
    .maybeSingle();

  return !!collab;
}
