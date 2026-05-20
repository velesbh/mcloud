"use client";
import { use, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  Activity,
  Users,
  Cpu,
  MemoryStick,
  HardDrive,
  Network,
  Clock,
  AlertTriangle,
  Info,
} from "lucide-react";
import { PageLoader } from "@/components/shared/LoadingScreen";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkline } from "@/components/server/Sparkline";
import { formatMb } from "@/lib/utils";
import { useSupabaseClient } from "@/lib/supabase/client";

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

type MetricRow = {
  id: number;
  server_id: string;
  sampled_at: string;
  ram_used_mb: number;
  cpu_percent: number;
  player_count: number;
  disk_used_mb: number;
};

type LiveMetrics = {
  ram_used_mb: number;
  cpu_percent: number;
  disk_used_mb: number;
};

type PingData = {
  online: boolean;
  players_online?: number;
};

export default function ServerAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [now, setNow] = useState(() => Date.now());
  const [liveMetrics, setLiveMetrics] = useState<LiveMetrics | null>(null);
  const supabase = useSupabaseClient();

  // Tick uptime every 30 s
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Server info
  const { data: server, isLoading } = useQuery<Server>({
    queryKey: ["server", id],
    queryFn: () => fetch(`/api/servers/${id}`).then((r) => r.json()),
  });

  // Historical metrics — refetch every 60 s
  const { data: historicalMetrics = [] } = useQuery<MetricRow[]>({
    queryKey: ["server-metrics", id],
    queryFn: () => fetch(`/api/servers/${id}/metrics`).then((r) => r.json()),
    refetchInterval: 60_000,
    enabled: !!server,
  });

  // Live player count via ping — polled every 30 s
  const { data: pingData } = useQuery<PingData>({
    queryKey: ["server-ping", id],
    queryFn: () => fetch(`/api/servers/${id}/ping`).then((r) => r.json()),
    refetchInterval: 30_000,
    enabled: server?.status === "running",
  });

  // Subscribe to Realtime broadcast for live CPU/RAM every 5 s
  useEffect(() => {
    const channel = supabase
      .channel(`console:${id}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "metrics" }, (msg) => {
        const payload = msg.payload as { ramMb: number; cpuPercent: number; diskUsedMb: number };
        setLiveMetrics({
          ram_used_mb: payload.ramMb,
          cpu_percent: payload.cpuPercent,
          disk_used_mb: payload.diskUsedMb ?? 0,
        });
      })
      .subscribe();

    return () => { void channel.unsubscribe(); };
  }, [id, supabase]);

  const isRunning = server?.status === "running";
  const hasHistory = historicalMetrics.length > 0;

  // Sparkline series — fall back to zeros if no history yet
  const ramSeries = useMemo(
    () => hasHistory ? historicalMetrics.map((r) => r.ram_used_mb) : Array(60).fill(0),
    [historicalMetrics, hasHistory]
  );
  const cpuSeries = useMemo(
    () => hasHistory ? historicalMetrics.map((r) => r.cpu_percent) : Array(60).fill(0),
    [historicalMetrics, hasHistory]
  );
  const playerSeries = useMemo(
    () => hasHistory ? historicalMetrics.map((r) => r.player_count) : Array(60).fill(0),
    [historicalMetrics, hasHistory]
  );
  const diskSeries = useMemo(
    () => hasHistory ? historicalMetrics.map((r) => r.disk_used_mb ?? 0) : Array(60).fill(0),
    [historicalMetrics, hasHistory]
  );

  // Live current values — prefer realtime broadcast, else last historical row
  const lastHistorical = historicalMetrics[historicalMetrics.length - 1];
  const currentRam = liveMetrics?.ram_used_mb ?? lastHistorical?.ram_used_mb ?? 0;
  const currentCpu = liveMetrics?.cpu_percent ?? lastHistorical?.cpu_percent ?? 0;
  const currentPlayers = pingData?.players_online ?? lastHistorical?.player_count ?? 0;
  const currentDisk = liveMetrics?.disk_used_mb ?? lastHistorical?.disk_used_mb ?? 0;

  const uptime = useMemo(() => {
    if (!server?.last_started_at || !isRunning) return null;
    const ms = now - new Date(server.last_started_at).getTime();
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return `${h}h ${m}m`;
  }, [server, now, isRunning]);

  if (isLoading || !server) return <PageLoader />;

  const cards = [
    {
      label: "RAM",
      value: formatMb(currentRam),
      max: formatMb(server.ram_mb),
      icon: MemoryStick,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      series: ramSeries,
      max_y: server.ram_mb,
    },
    {
      label: "CPU",
      value: `${currentCpu}%`,
      max: `${server.cpu_percent}%`,
      icon: Cpu,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      series: cpuSeries,
      max_y: server.cpu_percent,
    },
    {
      label: "Players",
      value: currentPlayers.toString(),
      max: server.max_players.toString(),
      icon: Users,
      color: "text-primary",
      bg: "bg-primary/10",
      series: playerSeries,
      max_y: server.max_players,
    },
    {
      label: "Disk",
      value: formatMb(currentDisk),
      max: formatMb(server.disk_mb),
      icon: HardDrive,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      series: diskSeries,
      max_y: server.disk_mb,
    },
    {
      label: "Network",
      value: "—",
      max: "Last hour",
      icon: Network,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
      series: Array(60).fill(0) as number[],
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

      {!hasHistory && isRunning && (
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>Metrics will appear after the server has been running for 1 minute.</span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
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

        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-amber-500" />
                Disk usage
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Limit: {formatMb(server.disk_mb)}
              </p>
            </div>
            <span className="text-xs text-muted-foreground">Last 60m</span>
          </div>
          <Sparkline values={diskSeries} max={server.disk_mb} height={120} color="hsl(45 93% 47%)" />
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
