"use client";
import { useQuery } from "@tanstack/react-query";
import { FREE_TIER } from "@/lib/constants";

type Quotas = {
  max_servers: number;
  max_ram_mb: number;
  max_disk_mb: number;
  max_cpu_percent: number;
  plan_key: string | null;
  plan_name: string;
};

const FREE_FALLBACK: Quotas = {
  max_servers: FREE_TIER.MAX_SERVERS,
  max_ram_mb: FREE_TIER.RAM_MB,
  max_disk_mb: FREE_TIER.DISK_MB,
  max_cpu_percent: FREE_TIER.CPU_PERCENT,
  plan_key: null,
  plan_name: "Free",
};

export function useFreeTierLimits() {
  const { data: servers = [] } = useQuery<{ id: string }[]>({
    queryKey: ["servers"],
    queryFn: async () => {
      const res = await fetch("/api/servers");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: quotas = FREE_FALLBACK } = useQuery<Quotas>({
    queryKey: ["quotas"],
    queryFn: async () => {
      const res = await fetch("/api/billing/quotas");
      if (!res.ok) return FREE_FALLBACK;
      return res.json();
    },
    staleTime: 60_000,
  });

  const serverCount = servers.length;
  const atServerLimit = serverCount >= quotas.max_servers;

  return {
    serverCount,
    maxServers: quotas.max_servers,
    maxRamMb: quotas.max_ram_mb,
    maxDiskMb: quotas.max_disk_mb,
    maxCpuPercent: quotas.max_cpu_percent,
    planKey: quotas.plan_key,
    planName: quotas.plan_name,
    atServerLimit,
  };
}
