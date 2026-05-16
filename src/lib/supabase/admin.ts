import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Admin (service-role) client. All `.from(...)` and `.rpc(...)` calls
 * default to the `mcloud` schema — we co-tenant a Supabase project with
 * other apps that have colliding table names, so everything lives in our
 * own schema. Storage and Realtime are addressed separately.
 */
export function createAdminSupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: "mcloud" },
    }
  );
}
