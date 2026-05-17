"use client";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Check, Sparkles, Zap, ArrowRight, Crown, Lock } from "lucide-react";
import { useAuth, useClerk } from "@clerk/nextjs";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageLoader } from "@/components/shared/LoadingScreen";
import { PixelPanel, PixelButton } from "@/components/pixel/PixelPanel";
import { EmptyState } from "@/components/shared/EmptyState";
import { DiamondBlock, GoldBlock, RedstoneBlock, StarIcon } from "@/components/pixel/Block";
import { LoadingSpinner } from "@/components/shared/MinecraftLoader";
import { formatMb } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { BillingPlan } from "@/lib/supabase/types";

function PlanIcon({ name, size = 32 }: { name: string; size?: number }) {
  const lower = name.toLowerCase();
  if (lower.includes("enterprise") || lower.includes("ultimate")) return <Crown className="w-8 h-8 text-amber-400" />;
  if (lower.includes("pro") || lower.includes("premium")) return <DiamondBlock size={size} />;
  if (lower.includes("plus") || lower.includes("basic") || lower.includes("starter")) return <GoldBlock size={size} />;
  if (lower.includes("free") || lower.includes("hobby")) return <RedstoneBlock size={size} />;
  return <StarIcon size={size} />;
}

export default function UpgradePage() {
  const { has } = useAuth();
  const clerk = useClerk();
  const searchParams = useSearchParams();
  const secretPlanKey = searchParams.get("plan"); // secret checkout link ?plan=PLAN_KEY
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);

  // Fetch public plans list
  const { data: plans = [], isLoading } = useQuery<BillingPlan[]>({
    queryKey: ["billing-plans"],
    queryFn: async () => {
      const res = await fetch("/api/billing/plans");
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // Fetch secret plan (if ?plan= present) — may be invisible in the normal list
  const { data: secretPlan, isLoading: secretLoading } = useQuery<BillingPlan | null>({
    queryKey: ["billing-plan-secret", secretPlanKey],
    queryFn: async () => {
      if (!secretPlanKey) return null;
      const res = await fetch(`/api/billing/plans?key=${encodeURIComponent(secretPlanKey)}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!secretPlanKey,
  });

  const loading = isLoading || (!!secretPlanKey && secretLoading);

  if (loading) return <PageLoader />;

  // In secret-link mode: show only that plan (even if is_visible = false)
  const visiblePlans = secretPlan
    ? [secretPlan]
    : plans.filter((p) => p.is_visible);

  const isSecretMode = !!secretPlan;

  async function subscribe(plan: BillingPlan) {
    setPendingPlan(plan.plan_key);
    try {
      if (!plan.clerk_plan_id) {
        toast.error(
          "This plan isn't configured for checkout yet. Ask your admin to set the Clerk Plan ID in the Billing Plans page."
        );
        setPendingPlan(null);
        return;
      }

      const c = clerk as unknown as {
        __internal_openCheckout?: (props: {
          planId: string;
          planPeriod?: "month" | "annual";
          onSubscriptionComplete?: () => void;
        }) => void;
      };

      if (typeof c.__internal_openCheckout === "function") {
        c.__internal_openCheckout({
          planId: plan.clerk_plan_id,
          planPeriod: "month",
          onSubscriptionComplete: () => {
            toast.success(`Subscribed to ${plan.name}!`);
            setPendingPlan(null);
            window.location.reload();
          },
        });
        // Clear loading state if user dismisses the drawer without completing
        setTimeout(() => setPendingPlan(null), 30_000);
      } else {
        // Fallback: open Clerk's billing section in user profile
        clerk.openUserProfile({ __experimental_startPath: "/billing" } as never);
        setPendingPlan(null);
      }
    } catch (err) {
      const msg = String(err);
      if (msg.includes("not Publicly available") || msg.includes("publicly available")) {
        toast.error(
          "This plan is set to Private in Clerk. Go to your Clerk Dashboard → Billing → Plans → make the plan Public. " +
          "The plan won't appear in checkout until it's Public in Clerk (hiding it from users is done via MCloud's is_visible setting instead).",
          { duration: 10_000 }
        );
      } else {
        toast.error(`Checkout failed: ${msg}`);
      }
      setPendingPlan(null);
    }
  }

  function manage() {
    clerk.openUserProfile({ __experimental_startPath: "/billing" } as never);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isSecretMode ? "Exclusive plan" : "Upgrade your plan"}
        description={
          isSecretMode
            ? "You've been given access to a special plan. Review it below and subscribe when ready."
            : "More RAM, more servers, more ports. Configured by your MCloud admin."
        }
      />

      {/* Secret-link banner */}
      {isSecretMode && (
        <PixelPanel variant="ore" className="p-3 flex items-center gap-3">
          <Lock className="w-4 h-4 text-primary shrink-0" />
          <p className="text-xs text-muted-foreground">
            This plan is available via private link only and won&apos;t appear in the public upgrade list.
          </p>
        </PixelPanel>
      )}

      {visiblePlans.length === 0 ? (
        <EmptyState
          title="No plans available"
          description="Your admin hasn't configured any billing plans yet."
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visiblePlans.map((plan, i) => {
              const features = Array.isArray(plan.features) ? (plan.features as string[]) : [];
              const isCurrent = (() => {
                try { return has?.({ plan: plan.plan_key }) ?? false; } catch { return false; }
              })();
              const isPending = pendingPlan === plan.plan_key;

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.25 }}
                >
                  <PixelPanel
                    variant={plan.is_highlighted || isSecretMode ? "ore" : "stone"}
                    className={cn(
                      "p-5 h-full flex flex-col gap-4 transition-all",
                      (plan.is_highlighted || isSecretMode) && "ring-2 ring-primary/40"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <PlanIcon name={plan.name} size={32} />
                        <div className="min-w-0">
                          <h3 className="font-minecraft text-[12px] uppercase truncate">{plan.name}</h3>
                          {(plan.is_highlighted || isSecretMode) && (
                            <span className="text-[9px] font-minecraft uppercase text-primary flex items-center gap-1 mt-0.5">
                              <Sparkles className="w-2.5 h-2.5" />
                              {isSecretMode ? "Exclusive" : "Recommended"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {plan.description && (
                      <p className="text-xs text-muted-foreground -mt-2">{plan.description}</p>
                    )}

                    {plan.monthly_price_usd != null && (
                      <div className="flex items-baseline gap-1">
                        <span className="font-minecraft text-2xl text-foreground">
                          ${plan.monthly_price_usd}
                        </span>
                        <span className="text-muted-foreground text-xs font-minecraft uppercase">/month</span>
                      </div>
                    )}

                    <div
                      className="border-2 border-border/60 p-3 space-y-1.5"
                      style={{ background: "rgba(0,0,0,0.25)" }}
                    >
                      <QuotaRow label="RAM" value={formatMb(plan.max_ram_mb)} />
                      <QuotaRow label="Disk" value={formatMb(plan.max_disk_mb)} />
                      <QuotaRow label="CPU" value={`${plan.max_cpu_percent}%`} />
                      <QuotaRow label="Servers" value={`${plan.max_servers}`} />
                    </div>

                    {features.length > 0 && (
                      <ul className="space-y-1.5 text-xs flex-1">
                        {features.map((f) => (
                          <li key={f} className="flex items-start gap-2">
                            <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                            <span className="text-foreground/85">{f}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="pt-3 border-t-2 border-border/40">
                      {isCurrent ? (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-primary flex items-center gap-1.5 font-minecraft uppercase">
                            <Check className="w-3 h-3" />
                            Current Plan
                          </span>
                          <PixelButton size="sm" variant="ghost" onClick={manage}>
                            Manage
                          </PixelButton>
                        </div>
                      ) : (
                        <PixelButton
                          variant={plan.is_highlighted || isSecretMode ? "green" : "default"}
                          onClick={() => subscribe(plan)}
                          disabled={isPending}
                          className="w-full justify-center"
                        >
                          {isPending ? <LoadingSpinner size={12} /> : <Zap className="w-3.5 h-3.5" />}
                          {isPending ? "Opening checkout..." : "Subscribe"}
                          {!isPending && <ArrowRight className="w-3 h-3" />}
                        </PixelButton>
                      )}
                    </div>
                  </PixelPanel>
                </motion.div>
              );
            })}
          </div>

          <PixelPanel variant="dark" className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="font-minecraft text-[11px] uppercase">Already subscribed?</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Cancel, switch plans, or update your payment method.
                </p>
              </div>
              <PixelButton onClick={manage}>Manage Billing</PixelButton>
            </div>
          </PixelPanel>

          <p className="text-[10px] text-center text-muted-foreground font-minecraft uppercase">
            Plans configured by your admin · Powered by Clerk Billing
          </p>
        </>
      )}
    </div>
  );
}

function QuotaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-muted-foreground font-minecraft uppercase text-[10px]">{label}</span>
      <span className="font-mono text-foreground">{value}</span>
    </div>
  );
}
