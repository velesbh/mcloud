"use client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Check, Sparkles, Zap } from "lucide-react";
import { PricingTable, useAuth } from "@clerk/nextjs";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageLoader } from "@/components/shared/LoadingScreen";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatMb } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { BillingPlan } from "@/lib/supabase/types";

export default function UpgradePage() {
  const { has } = useAuth();
  const { data: plans = [], isLoading } = useQuery<BillingPlan[]>({
    queryKey: ["billing-plans"],
    queryFn: async () => {
      const res = await fetch("/api/billing/plans");
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (isLoading) return <PageLoader />;

  const visiblePlans = plans.filter((p) => p.is_visible);
  const allowedPlanKeys = visiblePlans.map((p) => p.plan_key);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Upgrade your plan"
        description="Get more RAM, disk, and CPU for your servers."
      />

      {visiblePlans.length === 0 ? (
        <EmptyState
          title="No upgrade plans available"
          description="Plans haven't been configured yet. Check back soon."
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visiblePlans.map((plan, i) => {
              const features = Array.isArray(plan.features) ? (plan.features as string[]) : [];
              const isCurrent = (() => {
                try {
                  return has?.({ plan: plan.plan_key }) ?? false;
                } catch {
                  return false;
                }
              })();
              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <Card
                    className={cn(
                      "p-6 h-full flex flex-col gap-4 transition-colors",
                      plan.is_highlighted
                        ? "border-primary/60 ring-1 ring-primary/30"
                        : "border-border"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{plan.name}</h3>
                          {plan.is_highlighted && (
                            <Badge className="gap-1 text-[10px] h-5">
                              <Sparkles className="w-3 h-3" />
                              Recommended
                            </Badge>
                          )}
                        </div>
                        {plan.description && (
                          <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                        )}
                      </div>
                    </div>

                    {plan.monthly_price_usd != null && (
                      <div>
                        <span className="text-3xl font-bold">${plan.monthly_price_usd}</span>
                        <span className="text-muted-foreground text-sm">/mo</span>
                      </div>
                    )}

                    <div className="border-t border-border pt-3 space-y-2 text-sm">
                      <QuotaRow label="RAM" value={formatMb(plan.max_ram_mb)} />
                      <QuotaRow label="Disk" value={formatMb(plan.max_disk_mb)} />
                      <QuotaRow label="CPU" value={`${plan.max_cpu_percent}%`} />
                      <QuotaRow label="Servers" value={plan.max_servers.toString()} />
                    </div>

                    {features.length > 0 && (
                      <ul className="space-y-1.5 text-sm flex-1">
                        {features.map((f) => (
                          <li key={f} className="flex items-start gap-2">
                            <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {isCurrent ? (
                      <div className="text-xs text-primary flex items-center gap-1.5 pt-2 border-t border-border">
                        <Check className="w-3 h-3" />
                        Your current plan
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5 pt-2 border-t border-border">
                        <Zap className="w-3 h-3" />
                        Subscribe via the checkout below
                      </div>
                    )}
                  </Card>
                </motion.div>
              );
            })}
          </div>

          <div className="border-t border-border pt-8">
            <h2 className="text-lg font-semibold mb-1">Subscribe</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Only the plans configured by the MCloud team will apply quotas to your account.
              Configured plan keys: {allowedPlanKeys.map((k) => (
                <code key={k} className="mx-0.5 px-1 py-0.5 rounded bg-muted text-xs">{k}</code>
              ))}
            </p>
            <PricingTable newSubscriptionRedirectUrl="../dashboard" />
          </div>
        </>
      )}
    </div>
  );
}

function QuotaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
