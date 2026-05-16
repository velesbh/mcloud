import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

/**
 * Service-role Supabase client. Bypasses RLS — the daemon is fully trusted.
 * Realtime is enabled by default.
 */
export const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { eventsPerSecond: 20 } },
  // MCloud objects live in their own schema (other apps share this Supabase
  // project). All .from() and .rpc() calls auto-resolve to mcloud.*.
  db: { schema: "mcloud" },
});
