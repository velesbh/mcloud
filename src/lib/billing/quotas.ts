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

// "Infinite" — large enough that any user-facing slider/validator will allow
// whatever value the user types, but still a regular JS integer (Infinity
// would break JSON.stringify / number columns).
export const UNLIMITED = 1_000_000_000;

export const UNLIMITED_QUOTAS: ResolvedQuotas = {
  max_servers: UNLIMITED,
  max_ram_mb: UNLIMITED,
  max_disk_mb: UNLIMITED,
  max_cpu_percent: UNLIMITED,
  plan_key: "unlimited",
  plan_name: "Unlimited",
};

// Walks every visible billing plan and returns the most generous one the user
// has via Clerk billing. Falls back to FREE_TIER env values.
//
// Admins and users with a non-free profile.plan_tier get UNLIMITED resources
// — they bypass per-plan caps entirely. (Per explicit product requirement:
// "admin have infinite resources as well as premium".)
export async function getUserQuotas(): Promise<ResolvedQuotas> {
  const { userId, has } = await auth();
  if (!userId || !has) return FREE_QUOTAS;

  const supabase = createAdminSupabaseClient();

  // Profile-level overrides first.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, plan_tier")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  if (profile?.role === "admin") {
    return { ...UNLIMITED_QUOTAS, plan_name: "Admin (Unlimited)" };
  }
  if (profile?.plan_tier && profile.plan_tier !== "free") {
    return { ...UNLIMITED_QUOTAS, plan_key: profile.plan_tier, plan_name: "Premium (Unlimited)" };
  }

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
    // Anyone on a paid Clerk plan also gets unlimited per the product rule above.
    return { ...UNLIMITED_QUOTAS, plan_key: plan.plan_key, plan_name: `${plan.name} (Unlimited)` };
  }
  return best;
}
