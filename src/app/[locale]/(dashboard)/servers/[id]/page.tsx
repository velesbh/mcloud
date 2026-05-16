"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { use, useEffect, useState } from "react";
import {
  Play, Square, RotateCcw, Copy, Check, Zap, Users, Activity,
  Wifi, Clock, MapPin,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StatusOverlay } from "@/components/server/StatusOverlay";
import { UsageBar } from "@/components/shared/UsageBar";
import { LoadingSpinner } from "@/components/shared/MinecraftLoader";
import { PageLoader } from "@/components/shared/LoadingScreen";
import { PixelPanel, PixelButton } from "@/components/pixel/PixelPanel";
import { ServerBlock, HeartIcon, GamepadIcon, CompassIcon } from "@/components/pixel/Block";
import { useSupabaseClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface PingData {
  online: boolean;
  address?: string;
  players_online?: number;
  players_max?: number;
  player_list?: { name_clean: string; uuid: string }[];
  motd?: string;
  version?: string;
  latency?: number | null;
  reason?: string;
}

export default function ServerOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const qc = useQueryClient();
  const supabase = useSupabaseClient();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [liveRamMb, setLiveRamMb] = useState<number | null>(null);
  const [liveCpuPct, setLiveCpuPct] = useState<number | null>(null);
  const [installing, setInstalling] = useState(false);

  const { data: server, isLoading } = useQuery({
    queryKey: ["server", id],
    queryFn: () => fetch(`/api/servers/${id}`).then((r) => r.json()),
    refetchInterval: 10_000,
  });

  // Live ping via mcstatus.io — refreshes every 15s
  const { data: ping } = useQuery<PingData>({
    queryKey: ["server-ping", id],
    queryFn: () => fetch(`/api/servers/${id}/ping`).then((r) => r.json()),
    refetchInterval: 15_000,
    enabled: !!server && (liveStatus ?? server?.status) === "running",
  });

  useEffect(() => {
    const ch = supabase
      .channel(`console:${id}`)
      .on("broadcast", { event: "status" }, (msg) => {
        setLiveStatus(msg.payload?.status ?? null);
        qc.invalidateQueries({ queryKey: ["server", id] });
      })
      .on("broadcast", { event: "metrics" }, (msg) => {
        setLiveRamMb(msg.payload?.ramMb ?? null);
        setLiveCpuPct(msg.payload?.cpuPercent ?? null);
      })
      .on("broadcast", { event: "line" }, (msg) => {
        // Detect modpack installer activity from console output
        const line = String(msg.payload?.line ?? "");
        if (line.startsWith("[modpack]") && !line.includes("complete")) {
          setInstalling(true);
        } else if (line.includes("[modpack] Install complete") || line.includes("Done (")) {
          setInstalling(false);
        }
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [id, supabase, qc]);

  useEffect(() => {
    const status = liveStatus ?? server?.status;
    if (status !== "running") {
      setLiveRamMb(null);
      setLiveCpuPct(null);
    }
  }, [liveStatus, server?.status]);

  if (isLoading || !server) return <PageLoader />;

  const currentStatus: string = liveStatus ?? server.status;
  const address = server.allocations
    ? `${server.allocations.ip}:${server.allocations.port}`
    : null;
  const isRunning = currentStatus === "running";
  const isTransitioning = ["starting", "stopping", "restarting"].includes(currentStatus);
  const ramUsed = isRunning ? (liveRamMb ?? null) : 0;
  const cpuUsed = isRunning ? (liveCpuPct ?? null) : 0;

  // Uptime — derive from last_active_at when running
  const uptimeText = (() => {
    if (!isRunning || !server.last_active_at) return null;
    const ms = Date.now() - new Date(server.last_active_at).getTime();
    if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
    if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
    if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
    return `${Math.floor(ms / 86_400_000)}d ${Math.floor((ms % 86_400_000) / 3_600_000)}h`;
  })();

  async function runAction(action: "start" | "stop" | "restart" | "kill") {
    setActionLoading(action);
    setLiveStatus(
      action === "start" ? "starting" :
      action === "stop" ? "stopping" :
      action === "restart" ? "restarting" : "offline"
    );
    try {
      const res = await fetch(`/api/servers/${id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? data.error ?? "Action failed");
        setLiveStatus(null);
      } else {
        qc.invalidateQueries({ queryKey: ["server", id] });
      }
    } catch {
      toast.error("Action failed");
      setLiveStatus(null);
    } finally {
      setActionLoading(null);
    }
  }

  function copyAddress() {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Header — pixel block + name + status */}
      <PixelPanel variant="stone" className="p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <ServerBlock size={48} />
          <div className="flex-1 min-w-0">
            <h1 className="font-minecraft text-[13px] text-foreground truncate">{server.name}</h1>
            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground font-minecraft uppercase tracking-wide">
              <span>{server.edition === "java" ? "Java" : "Bedrock"}</span>
              <span>·</span>
              <span>{server.game_version}</span>
              <span>·</span>
              <span>{server.loader}</span>
            </div>
          </div>
          <StatusBadge status={currentStatus} />
        </div>
      </PixelPanel>

      {/* Action bar — Minecraft hotbar style */}
      <PixelPanel variant="dark" className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          {!isRunning && !isTransitioning && (
            <PixelButton variant="green" size="md" onClick={() => runAction("start")} disabled={!!actionLoading}>
              {actionLoading === "start" ? <LoadingSpinner size={12} /> : <Play className="w-3 h-3" />}
              Start
            </PixelButton>
          )}
          {isRunning && (
            <>
              <PixelButton onClick={() => runAction("restart")} disabled={!!actionLoading}>
                {actionLoading === "restart" ? <LoadingSpinner size={12} /> : <RotateCcw className="w-3 h-3" />}
                Restart
              </PixelButton>
              <PixelButton variant="red" onClick={() => runAction("stop")} disabled={!!actionLoading}>
                {actionLoading === "stop" ? <LoadingSpinner size={12} /> : <Square className="w-3 h-3" />}
                Stop
              </PixelButton>
            </>
          )}
          {isTransitioning && (
            <div className="flex items-center gap-2 px-3 py-1.5">
              <LoadingSpinner size={14} />
              <span className="text-[10px] text-muted-foreground capitalize font-minecraft">{currentStatus}...</span>
              <PixelButton variant="amber" size="sm" onClick={() => runAction("kill")} disabled={!!actionLoading}>
                <Zap className="w-3 h-3" />
                Force
              </PixelButton>
            </div>
          )}

          <div className="flex-1" />

          {address ? (
            <div
              className="flex items-center gap-2 px-3 py-1.5"
              style={{ background: "rgba(0,0,0,0.3)", border: "2px solid #3a3a3a" }}
            >
              <code className="text-xs font-mono text-foreground">{address}</code>
              <button onClick={copyAddress} className="text-muted-foreground hover:text-primary transition-colors">
                {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground font-minecraft">No IP assigned</span>
          )}
        </div>
      </PixelPanel>

      {/* Pixel-art animation overlay during transitions */}
      {(installing || isTransitioning) && (
        <PixelPanel variant="dark" className="p-2">
          <StatusOverlay
            status={
              installing ? "installing" :
              (currentStatus as "starting" | "stopping" | "restarting")
            }
          />
        </PixelPanel>
      )}

      {/* Live status row: players + ping + uptime */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Players */}
        <PixelPanel variant="ore" title="Players" icon={<Users className="w-3 h-3" />} className="p-4">
          <div className="flex items-baseline gap-2">
            <span className="font-minecraft text-2xl text-primary">
              {ping?.players_online ?? 0}
            </span>
            <span className="text-muted-foreground text-sm">/ {ping?.players_max ?? server.max_players}</span>
          </div>
          {(ping?.player_list?.length ?? 0) > 0 ? (
            <div className="mt-2 space-y-1 max-h-20 overflow-y-auto">
              {ping!.player_list!.slice(0, 8).map((p) => (
                <div key={p.uuid} className="flex items-center gap-2 text-xs">
                  <img
                    src={`https://api.mineatar.io/face/${p.uuid}?scale=16`}
                    alt=""
                    width={16}
                    height={16}
                    className="pixelated"
                    style={{ imageRendering: "pixelated" }}
                  />
                  <span className="font-mono text-foreground/80">{p.name_clean}</span>
                </div>
              ))}
            </div>
          ) : isRunning ? (
            <p className="text-[10px] text-muted-foreground mt-2 font-minecraft">
              {ping?.online ? "Empty server" : "Waiting for ping..."}
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground mt-2 font-minecraft">Server offline</p>
          )}
        </PixelPanel>

        {/* Latency / ping */}
        <PixelPanel variant="stone" title="Connection" icon={<Wifi className="w-3 h-3" />} className="p-4">
          <div className="flex items-baseline gap-2">
            <span className="font-minecraft text-2xl text-foreground">
              {ping?.latency != null ? Math.round(ping.latency) : "—"}
            </span>
            <span className="text-muted-foreground text-sm">ms</span>
          </div>
          {ping?.motd && (
            <p className="text-[10px] text-muted-foreground mt-2 truncate" title={ping.motd}>
              <span className="text-foreground/60">MOTD:</span> {ping.motd}
            </p>
          )}
          {ping?.version && (
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{ping.version}</p>
          )}
        </PixelPanel>

        {/* Uptime */}
        <PixelPanel variant="stone" title="Uptime" icon={<Clock className="w-3 h-3" />} className="p-4">
          <div className="font-minecraft text-2xl text-foreground">
            {uptimeText ?? "—"}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 font-minecraft">
            {isRunning ? "Currently online" : "Server offline"}
          </p>
        </PixelPanel>
      </div>

      {/* Resource bars */}
      <div className="grid gap-4 md:grid-cols-3">
        <PixelPanel variant="stone" title="RAM" icon={<HeartIcon size={12} />} className="p-4 space-y-2">
          <UsageBar label="" used={ramUsed ?? 0} total={server.ram_mb} />
          <p className="text-[10px] text-muted-foreground font-minecraft">
            {ramUsed && ramUsed > 0
              ? `${ramUsed} / ${server.ram_mb} MB`
              : `${server.ram_mb} MB allocated`}
          </p>
        </PixelPanel>

        <PixelPanel variant="stone" title="CPU" icon={<Activity className="w-3 h-3" />} className="p-4 space-y-2">
          <UsageBar label="" used={cpuUsed ?? 0} total={100} unit="percent" formatValue={(v) => `${v}%`} />
          <p className="text-[10px] text-muted-foreground font-minecraft">
            {cpuUsed != null && isRunning ? `${cpuUsed}% usage` : `${server.cpu_percent}% limit`}
          </p>
        </PixelPanel>

        <PixelPanel variant="stone" title="Disk" icon={<GamepadIcon size={12} />} className="p-4 space-y-2">
          <UsageBar label="" used={Math.floor(server.disk_mb * 0.1)} total={server.disk_mb} />
          <p className="text-[10px] text-muted-foreground font-minecraft">
            {(server.disk_mb / 1024).toFixed(1)} GB allocated
          </p>
        </PixelPanel>
      </div>

      {/* Server Info — wooden plank style */}
      <PixelPanel variant="wood" title="Server Details" icon={<MapPin className="w-3 h-3" />} className="p-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-[10px] text-muted-foreground font-minecraft uppercase">MOTD</dt>
            <dd className="font-mono text-xs text-foreground/90 mt-0.5">{server.motd}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground font-minecraft uppercase">Max Players</dt>
            <dd className="font-mono text-xs text-foreground/90 mt-0.5">{server.max_players}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground font-minecraft uppercase">Region</dt>
            <dd className="text-xs text-foreground/90 mt-0.5 flex items-center gap-1">
              <CompassIcon size={12} />
              {server.regions?.name ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground font-minecraft uppercase">Node</dt>
            <dd className="font-mono text-xs text-foreground/90 mt-0.5">{server.nodes?.name ?? "—"}</dd>
          </div>
        </dl>
      </PixelPanel>
    </motion.div>
  );
}
