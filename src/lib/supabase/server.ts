import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Server-side Supabase client for API routes.
 *
 * Uses the service-role key so it can reach the `mcloud` schema without
 * requiring PostgREST to have it explicitly "exposed".  All callers MUST
 * already gate requests with Clerk's `auth()` / `currentUser()` — the
 * service-role key bypasses RLS, so the Clerk check is the only security
 * boundary here.
 */
export async function createServerSupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: "mcloud" },
    }
  );
}
