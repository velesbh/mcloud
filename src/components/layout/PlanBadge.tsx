"use client";
import Link from "next/link";
import { Sparkles, Zap } from "lucide-react";
import { useLocale } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

type Quotas = {
  max_servers: number;
  max_ram_mb: number;
  max_disk_mb: number;
  max_cpu_percent: number;
  plan_key: string | null;
  plan_name: string;
};

export function PlanBadge() {
  const locale = useLocale();
  const { data: quotas } = useQuery<Quotas>({
    queryKey: ["quotas"],
    queryFn: async () => {
      const res = await fetch("/api/billing/quotas");
      return res.json();
    },
    staleTime: 60_000,
  });

  if (!quotas) return null;

  const isFree = !quotas.plan_key;
  const Icon = isFree ? Zap : Sparkles;

  return (
    <Link
      href={`/${locale}/upgrade`}
      className={cn(
        "hidden sm:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-medium border transition-colors",
        isFree
          ? "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
          : "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
      )}
    >
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 20 }}
      >
        <Icon className="w-3.5 h-3.5" />
      </motion.span>
      <span>{quotas.plan_name}</span>
      {isFree && (
        <span className="ml-1 text-primary hidden md:inline">· Upgrade</span>
      )}
    </Link>
  );
}
