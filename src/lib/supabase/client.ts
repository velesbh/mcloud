"use client";
import { createClient } from "@supabase/supabase-js";
import { useMemo } from "react";
import type { Database } from "./types";

/**
 * Browser Supabase client. Defaults to the `mcloud` schema — see
 * admin.ts. Storage and Realtime addressing are unaffected.
 */
export function useSupabaseClient() {
  return useMemo(
    () =>
      createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { db: { schema: "public" } }
      ),
    []
  );
}
