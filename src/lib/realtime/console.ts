import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export function getConsoleChannel(
  supabase: ReturnType<typeof createClient<Database>>,
  serverId: string
) {
  return supabase.channel(`console:${serverId}`);
}

export type ConsoleLogPayload = {
  serverId: string;
  line: string;
  source: "server" | "user" | "system";
};
