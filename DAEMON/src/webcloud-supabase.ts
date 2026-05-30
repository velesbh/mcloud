import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import { config } from "./config.js";

/**
 * Second Supabase client for WebCloud tables.
 *
 * Migration 007 creates auto-updatable views in the `public` schema that
 * proxy all webcloud tables. PostgREST serves `public` by default, so we
 * must NOT set db.schema here — doing so caused "invalid schema: webcloud"
 * errors for every DB call.
 */
export const wcSupabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  realtime: { params: { eventsPerSecond: 20 }, transport: ws as any },
});
