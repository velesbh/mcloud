import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

/**
 * Service-role Supabase client. Bypasses RLS — the daemon is fully trusted.
 * Realtime is enabled by default.
 */
export const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { eventsPerSecond: 20 } },
});
