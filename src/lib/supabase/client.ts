"use client";
import { createClient } from "@supabase/supabase-js";
import { useAuth } from "@clerk/nextjs";
import { useMemo } from "react";
import type { Database } from "./types";

export function useSupabaseClient() {
  const { getToken } = useAuth();

  return useMemo(
    () =>
      createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          accessToken: async () => {
            const token = await getToken({ template: "supabase" });
            return token ?? null;
          },
        }
      ),
    [getToken]
  );
}
