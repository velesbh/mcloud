import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import { config } from "./config.js";
/**
 * Service-role Supabase client. Bypasses RLS — the daemon is fully trusted.
 * Realtime is enabled by default.
 *
 * Node.js < 22 lacks native WebSocket — pass the `ws` package as transport.
 */
export const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    realtime: { params: { eventsPerSecond: 20 }, transport: ws },
    db: { schema: "mcloud" },
});
//# sourceMappingURL=supabase.js.map