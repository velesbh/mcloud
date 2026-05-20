import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import { config } from "./config.js";

/**
 * Second Supabase client pointed at the `webcloud` schema.
 *
 * Same physical Supabase project, same service-role key — just a different
 * `db.schema` so PostgREST routes queries to webcloud.* tables. Realtime
 * channels are shared across schemas (channel names are arbitrary strings)
 * so we still get the postgres_changes / broadcast features.
 */
export const wcSupabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  realtime: { params: { eventsPerSecond: 20 }, transport: ws as any },
  db: { schema: "webcloud" },
});
