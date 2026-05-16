import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Anon Supabase client for server-side reads under RLS. Defaults to
 * the `mcloud` schema — see admin.ts for the rationale.
 */
export async function createServerSupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: "mcloud" } }
  );
}
