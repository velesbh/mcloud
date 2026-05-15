"use client";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { ServerCard } from "@/components/server/ServerCard";
import { ServerStatsSummary } from "@/components/server/ServerStatsSummary";
import { ServerFilterBar } from "@/components/server/ServerFilterBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { ServerCardSkeleton, StatTileSkeleton } from "@/components/shared/Skeleton";
import { OnboardingBanner } from "@/components/dashboard/OnboardingBanner";
import { useFreeTierLimits } from "@/hooks/useFreeTierLimits";
import type { Server } from "@/lib/supabase/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type FilterStatus = "all" | "running" | "offline";

export default function DashboardPage() {
  const locale = useLocale();
  const qc = useQueryClient();
  const { atServerLimit, maxServers, maxRamMb, maxDiskMb } = useFreeTierLimits();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<FilterStatus>("all");

  const { data: servers = [], isLoading } = useQuery<Server[]>({
    queryKey: ["servers"],
    queryFn: () => fetch("/api/servers").then((r) => r.json()),
    refetchInterval: 10_000,
  });

  const counts = useMemo(() => {
    const running = servers.filter((s) => s.status === "running").length;
    return {
      all: servers.length,
      running,
      offline: servers.length - running,
    };
  }, [servers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return servers.filter((s) => {
      if (status === "running" && s.status !== "running") return false;
      if (status === "offline" && s.status === "running") return false;
      if (q && !s.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [servers, query, status]);

  const NewServerButton = (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <Link href={atServerLimit ? "#" : `/${locale}/servers/new`}>
            <Button
              disabled={atServerLimit}
              className="gap-2"
              onClick={(e) => atServerLimit && e.preventDefault()}
            >
              <Plus className="w-4 h-4" />
              New Server
            </Button>
          </Link>
        </span>
      </TooltipTrigger>
      {atServerLimit && (
        <TooltipContent>
          You&apos;ve reached your plan limit of {maxServers} server{maxServers === 1 ? "" : "s"}.
          <Link href={`/${locale}/upgrade`} className="text-primary underline ml-1">Upgrade</Link>
        </TooltipContent>
      )}
    </Tooltip>
  );

  if (isLoading) {
    return (
      <div className="space-y-5">
        <PageHeader title="My Servers" description="Manage and monitor your Minecraft servers." />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <StatTileSkeleton key={i} />)}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <ServerCardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  const showOnboarding = servers.length === 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="My Servers"
        description="Manage and monitor your Minecraft servers."
        action={NewServerButton}
      />

      {showOnboarding ? (
        <OnboardingBanner atLimit={atServerLimit} />
      ) : (
        <>
          <ServerStatsSummary
            servers={servers}
            quotas={{ max_servers: maxServers, max_ram_mb: maxRamMb, max_disk_mb: maxDiskMb }}
          />

          <ServerFilterBar
            query={query}
            onQueryChange={setQuery}
            status={status}
            onStatusChange={setStatus}
            counts={counts}
          />

          {filtered.length === 0 ? (
            <EmptyState
              title="No matching servers"
              description={
                query
                  ? `Nothing matches "${query}". Try a different search.`
                  : `No ${status} servers right now.`
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((server, i) => (
                <ServerCard
                  key={server.id}
                  server={server as Parameters<typeof ServerCard>[0]["server"]}
                  index={i}
                  onDeleted={() => qc.invalidateQueries({ queryKey: ["servers"] })}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
