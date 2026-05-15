"use client";
import { use, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  Activity,
  Users,
  Cpu,
  MemoryStick,
  Network,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { PageLoader } from "@/components/shared/LoadingScreen";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkline } from "@/components/server/Sparkline";
import { formatMb } from "@/lib/utils";

type Server = {
  id: string;
  name: string;
  status: string;
  ram_mb: number;
  cpu_percent: number;
  disk_mb: number;
  max_players: number;
  last_started_at: string | null;
};

// Deterministic pseudo-random series so analytics looks stable across reloads.
// Replace with real metrics when the agent is wired up.
function seededSeries(seed: string, length: number, scale: number, base = 0.4): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return Array.from({ length }).map((_, i) => {
    h = (h * 1103515245 + 12345) >>> 0;
    const r = ((h >>> 16) & 0x7fff) / 0x7fff;
    return Math.max(0, Math.min(1, base + Math.sin(i / 3) * 0.18 + (r - 0.5) * 0.32)) * scale;
  });
}

export default function ServerAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const { data: server, isLoading } = useQuery<Server>({
    queryKey: ["server", id],
    queryFn: () => fetch(`/api/servers/${id}`).then((r) => r.json()),
  });

  const isRunning = server?.status === "running";

  const ramSeries = useMemo(
    () => (server ? seededSeries(`${id}-ram`, 60, server.ram_mb, isRunning ? 0.55 : 0) : []),
    [id, server, isRunning]
  );
  const cpuSeries = useMemo(
    () => (server ? seededSeries(`${id}-cpu`, 60, server.cpu_percent, isRunning ? 0.45 : 0) : []),
    [id, server, isRunning]
  );
  const playerSeries = useMemo(
    () => (server ? seededSeries(`${id}-players`, 60, server.max_players, isRunning ? 0.4 : 0) : []),
    [id, server, isRunning]
  );
  const networkSeries = useMemo(
    () => (server ? seededSeries(`${id}-net`, 60, 1500, isRunning ? 0.3 : 0) : []),
    [id, server, isRunning]
  );

  const uptime = useMemo(() => {
    if (!server?.last_started_at || !isRunning) return null;
    const ms = now - new Date(server.last_started_at).getTime();
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return `${h}h ${m}m`;
  }, [server, now, isRunning]);

  if (isLoading || !server) return <PageLoader />;

  const last = <T extends number>(arr: T[]) => arr[arr.length - 1] ?? 0;

  const cards = [
    {
      label: "RAM",
      value: formatMb(Math.round(last(ramSeries))),
      max: formatMb(server.ram_mb),
      icon: MemoryStick,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      series: ramSeries,
      max_y: server.ram_mb,
    },
    {
      label: "CPU",
      value: `${Math.round(last(cpuSeries))}%`,
      max: `${server.cpu_percent}%`,
      icon: Cpu,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      series: cpuSeries,
      max_y: server.cpu_percent,
    },
    {
      label: "Players",
      value: Math.round(last(playerSeries)).toString(),
      max: server.max_players.toString(),
      icon: Users,
      color: "text-primary",
      bg: "bg-primary/10",
      series: playerSeries,
      max_y: server.max_players,
    },
    {
      label: "Network",
      value: `${Math.round(last(networkSeries))} kbps`,
      max: "Last hour",
      icon: Network,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
      series: networkSeries,
      max_y: 1500,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-base">Live metrics</h2>
          <p className="text-xs text-muted-foreground">
            Samples taken every minute. Last hour shown.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {isRunning ? (
            <Badge className="gap-1.5 bg-primary/10 text-primary border-primary/20">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Live
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1.5 text-muted-foreground">
              <AlertTriangle className="w-3 h-3" />
              Server offline — no data
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Card className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className="font-semibold text-lg leading-tight mt-1">{c.value}</p>
                  <p className="text-[10px] text-muted-foreground">max {c.max}</p>
                </div>
                <div className={`w-8 h-8 rounded-md flex items-center justify-center ${c.bg} ${c.color}`}>
                  <c.icon className="w-4 h-4" />
                </div>
              </div>
              <Sparkline values={c.series} max={c.max_y} height={36} />
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                RAM utilisation
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Allocated: {formatMb(server.ram_mb)}
              </p>
            </div>
            <span className="text-xs text-muted-foreground">Last 60m</span>
          </div>
          <Sparkline values={ramSeries} max={server.ram_mb} height={120} color="hsl(217 91% 60%)" />
        </Card>

        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Cpu className="w-4 h-4 text-amber-500" />
                CPU utilisation
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Limit: {server.cpu_percent}%
              </p>
            </div>
            <span className="text-xs text-muted-foreground">Last 60m</span>
          </div>
          <Sparkline values={cpuSeries} max={server.cpu_percent} height={120} color="hsl(38 92% 50%)" />
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="font-semibold text-sm mb-3">Status</h3>
        <div className="grid gap-3 sm:grid-cols-3 text-sm">
          <Row icon={Clock} label="Uptime" value={uptime ?? "—"} />
          <Row
            icon={Activity}
            label="Last started"
            value={
              server.last_started_at
                ? new Date(server.last_started_at).toLocaleString()
                : "Never started"
            }
          />
          <Row icon={Users} label="Max players" value={server.max_players.toString()} />
        </div>
      </Card>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium truncate">{value}</p>
      </div>
    </div>
  );
}
