"use client";
import { createClient } from "@supabase/supabase-js";
import { useMemo } from "react";
import type { Database } from "./types";

export function useSupabaseClient() {
  return useMemo(
    () =>
      createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );
}
