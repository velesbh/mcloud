"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Module-level singleton browser client.
 *
 * A single GoTrueClient per page is the Supabase-recommended pattern.
 * Using useMemo inside a hook was creating one instance **per component**,
 * triggering the "Multiple GoTrueClient instances" warning. We now create
 * the client exactly once at module load time and re-use it everywhere.
 *
 * The `db.schema` override routes queries to the `mcloud` schema by default.
 * Storage and Realtime are unaffected by this setting.
 */
let _client: SupabaseClient<Database> | null = null;

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!_client) {
    _client = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { db: { schema: "mcloud" } }
    );
  }
  return _client;
}

/**
 * Hook alias — same singleton, hook-call syntax preserved so existing
 * `const supabase = useSupabaseClient()` callsites need zero changes.
 */
export function useSupabaseClient(): SupabaseClient<Database> {
  return getSupabaseClient();
}
