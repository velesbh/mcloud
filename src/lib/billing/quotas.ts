import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { FREE_TIER } from "@/lib/constants";
import type { BillingPlan } from "@/lib/supabase/types";

export type ResolvedQuotas = {
  max_servers: number;
  max_ram_mb: number;
  max_disk_mb: number;
  max_cpu_percent: number;
  plan_key: string | null;
  plan_name: string;
};

const FREE_QUOTAS: ResolvedQuotas = {
  max_servers: FREE_TIER.MAX_SERVERS,
  max_ram_mb: FREE_TIER.RAM_MB,
  max_disk_mb: FREE_TIER.DISK_MB,
  max_cpu_percent: FREE_TIER.CPU_PERCENT,
  plan_key: null,
  plan_name: "Free",
};

// Walks every visible billing plan and returns the most generous one the user has via Clerk billing.
// Falls back to the FREE_TIER env values.
export async function getUserQuotas(): Promise<ResolvedQuotas> {
  const { userId, has } = await auth();
  if (!userId || !has) return FREE_QUOTAS;

  const supabase = createAdminSupabaseClient();
  const { data: plans } = await supabase
    .from("billing_plans")
    .select("*")
    .eq("is_visible", true)
    .order("sort_order", { ascending: false });

  if (!plans?.length) return FREE_QUOTAS;

  let best: ResolvedQuotas = FREE_QUOTAS;
  for (const plan of plans as BillingPlan[]) {
    const hasPlan = (() => {
      try {
        return has({ plan: plan.plan_key });
      } catch {
        return false;
      }
    })();
    if (!hasPlan) continue;
    if (plan.max_ram_mb > best.max_ram_mb) {
      best = {
        max_servers: plan.max_servers,
        max_ram_mb: plan.max_ram_mb,
        max_disk_mb: plan.max_disk_mb,
        max_cpu_percent: plan.max_cpu_percent,
        plan_key: plan.plan_key,
        plan_name: plan.name,
      };
    }
  }
  return best;
}
