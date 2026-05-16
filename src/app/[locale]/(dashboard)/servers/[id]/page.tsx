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
import { LoadingSpinner } from "@/components/shared/MinecraftLoader";
import { PageLoader } from "@/components/shared/LoadingScreen";
import { PixelPanel, PixelButton } from "@/components/pixel/PixelPanel";
import { ServerBlock, HeartIcon, GamepadIcon } from "@/components/pixel/Block";
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
      className="space-y-4 animate-fade-in"
    >
      {/* ── Main hero card ── */}
      <PixelPanel variant="stone" className="p-0 overflow-hidden">
        {/* Top row: server identity + actions */}
        <div className="flex items-center gap-4 flex-wrap p-4">
          <ServerBlock size={44} />
          <div className="flex-1 min-w-0">
            <h1 className="font-minecraft text-[14px] text-foreground truncate">{server.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={currentStatus} />
              <span className="text-[10px] text-muted-foreground font-minecraft">
                {server.edition === "java" ? "Java" : "Bedrock"} {server.game_version} · {server.loader}
              </span>
            </div>
          </div>
          {/* Action buttons inline */}
          <div className="flex items-center gap-2 flex-wrap">
            {!isRunning && !isTransitioning && (
              <PixelButton variant="green" size="md" onClick={() => runAction("start")} disabled={!!actionLoading}>
                {actionLoading === "start" ? <LoadingSpinner size={12} /> : <Play className="w-3 h-3" />}
                Start
              </PixelButton>
            )}
            {isRunning && (
              <>
                <PixelButton size="sm" onClick={() => runAction("restart")} disabled={!!actionLoading}>
                  {actionLoading === "restart" ? <LoadingSpinner size={10} /> : <RotateCcw className="w-3 h-3" />}
                  Restart
                </PixelButton>
                <PixelButton variant="red" size="sm" onClick={() => runAction("stop")} disabled={!!actionLoading}>
                  {actionLoading === "stop" ? <LoadingSpinner size={10} /> : <Square className="w-3 h-3" />}
                  Stop
                </PixelButton>
              </>
            )}
            {isTransitioning && (
              <div className="flex items-center gap-2">
                <LoadingSpinner size={14} />
                <span className="text-[10px] text-muted-foreground capitalize font-minecraft">{currentStatus}</span>
                <PixelButton variant="amber" size="sm" onClick={() => runAction("kill")} disabled={!!actionLoading}>
                  <Zap className="w-3 h-3" />
                  Force
                </PixelButton>
              </div>
            )}
          </div>
        </div>

        {/* IP address bar */}
        {address ? (
          <div
            className="flex items-center justify-between gap-3 px-4 py-2"
            style={{ borderTop: "2px solid hsl(var(--border))", background: "rgba(0,0,0,0.2)" }}
          >
            <div className="flex items-center gap-2">
              <Wifi className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground font-minecraft uppercase">Connect at</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono text-foreground font-bold">{address}</code>
              <button onClick={copyAddress} className="text-muted-foreground hover:text-primary transition-colors">
                {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        ) : (
          <div
            className="px-4 py-2 text-[10px] text-muted-foreground font-minecraft"
            style={{ borderTop: "2px solid hsl(var(--border))", background: "rgba(0,0,0,0.2)" }}
          >
            No IP assigned — contact admin
          </div>
        )}
      </PixelPanel>

      {/* ── Status overlay (transition animations) ── */}
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

      {/* ── Stats row ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Players */}
        <PixelPanel variant="ore" className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] font-minecraft uppercase text-muted-foreground">Players</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-minecraft text-3xl text-primary">{ping?.players_online ?? 0}</span>
            <span className="text-muted-foreground text-sm">/ {ping?.players_max ?? server.max_players}</span>
          </div>
          {(ping?.player_list?.length ?? 0) > 0 && (
            <div className="mt-2 space-y-1 max-h-16 overflow-y-auto">
              {ping!.player_list!.slice(0, 6).map((p) => (
                <div key={p.uuid} className="flex items-center gap-1.5 text-xs">
                  <img src={`https://api.mineatar.io/face/${p.uuid}?scale=16`} alt="" width={12} height={12} className="pixelated" style={{ imageRendering: "pixelated" }} />
                  <span className="font-mono text-foreground/80 text-[10px]">{p.name_clean}</span>
                </div>
              ))}
            </div>
          )}
        </PixelPanel>

        {/* Ping */}
        <PixelPanel variant="stone" className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Wifi className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-minecraft uppercase text-muted-foreground">Ping</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-minecraft text-3xl text-foreground">
              {ping?.latency != null ? Math.round(ping.latency) : "—"}
            </span>
            {ping?.latency != null && <span className="text-muted-foreground text-sm">ms</span>}
          </div>
          {ping?.version && <p className="text-[10px] text-muted-foreground font-mono mt-1">{ping.version}</p>}
        </PixelPanel>

        {/* Uptime */}
        <PixelPanel variant="stone" className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-minecraft uppercase text-muted-foreground">Uptime</span>
          </div>
          <div className="font-minecraft text-3xl text-foreground">{uptimeText ?? "—"}</div>
          <p className="text-[10px] text-muted-foreground mt-1 font-minecraft">
            {isRunning ? "Online" : "Offline"}
          </p>
        </PixelPanel>

        {/* Quick info */}
        <PixelPanel variant="stone" className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-minecraft uppercase text-muted-foreground">Info</span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground font-minecraft text-[9px] uppercase">Region</span>
              <span className="font-mono">{server.regions?.flag_emoji ?? ""} {server.regions?.name ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground font-minecraft text-[9px] uppercase">Max players</span>
              <span className="font-mono">{server.max_players}</span>
            </div>
            {server.motd && (
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground font-minecraft text-[9px] uppercase shrink-0">MOTD</span>
                <span className="font-mono truncate text-right">{server.motd}</span>
              </div>
            )}
          </div>
        </PixelPanel>
      </div>

      {/* ── Resource bars ── */}
      <PixelPanel variant="stone" title="Resources" icon={<Activity className="w-3 h-3" />} className="p-4 space-y-4">
        <ResourceBar
          label="RAM"
          icon={<HeartIcon size={12} />}
          used={isRunning ? (ramUsed ?? 0) : 0}
          total={server.ram_mb}
          format={(v) => `${v} MB`}
          live={isRunning && ramUsed != null}
        />
        <ResourceBar
          label="CPU"
          icon={<Activity className="w-3 h-3" />}
          used={isRunning ? (cpuUsed ?? 0) : 0}
          total={server.cpu_percent}
          format={(v) => `${v}%`}
          live={isRunning && cpuUsed != null}
        />
        <ResourceBar
          label="Disk"
          icon={<GamepadIcon size={12} />}
          used={0}
          total={server.disk_mb}
          format={(v) => `${(v / 1024).toFixed(1)} GB`}
          live={false}
          showAllocated
        />
      </PixelPanel>
    </motion.div>
  );
}

function ResourceBar({
  label, icon, used, total, format, live, showAllocated,
}: {
  label: string;
  icon: React.ReactNode;
  used: number;
  total: number;
  format: (v: number) => string;
  live: boolean;
  showAllocated?: boolean;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const color = pct > 85 ? "#dc2626" : pct > 65 ? "#f59e0b" : "#5a9a2e";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-[10px] font-minecraft uppercase text-muted-foreground">{label}</span>
          {live && (
            <span
              className="inline-block w-1.5 h-1.5"
              style={{ background: "#5a9a2e", boxShadow: "0 0 4px #5a9a2e" }}
            />
          )}
        </div>
        <span className="font-mono text-xs text-foreground">
          {live && used > 0 ? `${format(used)} / ${format(total)}` : showAllocated ? `${format(total)} allocated` : format(total)}
        </span>
      </div>
      <div
        className="h-3 relative overflow-hidden"
        style={{ background: "#1a1a1a", border: "2px solid #3a3a3a" }}
      >
        <div
          className="absolute inset-y-0 left-0 transition-all duration-1000"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}
