"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { use } from "react";
import { Play, Square, RotateCcw, Copy, Check, Server, Cpu, HardDrive, MemoryStick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { UsageBar } from "@/components/shared/UsageBar";
import { LoadingSpinner } from "@/components/shared/MinecraftLoader";
import { PageLoader } from "@/components/shared/LoadingScreen";
import { toast } from "sonner";
import { useState } from "react";

export default function ServerOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const qc = useQueryClient();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: server, isLoading } = useQuery({
    queryKey: ["server", id],
    queryFn: () => fetch(`/api/servers/${id}`).then((r) => r.json()),
    refetchInterval: 5000,
  });

  if (isLoading || !server) return <PageLoader />;

  const address = server.allocations
    ? `${server.allocations.ip}:${server.allocations.port}`
    : null;
  const isRunning = server.status === "running";
  const isTransitioning = ["starting", "stopping", "restarting"].includes(server.status);

  async function runAction(action: "start" | "stop" | "restart") {
    setActionLoading(action);
    try {
      const res = await fetch(`/api/servers/${id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ["server", id] });
        toast.success(`Server ${action}ed`);
      }
    } catch {
      toast.error("Action failed");
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
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{server.name}</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <span>{server.edition === "java" ? "☕ Java" : "📱 Bedrock"}</span>
            <span>·</span>
            <span>{server.game_version}</span>
            <span>·</span>
            <span className="capitalize">{server.loader}</span>
          </div>
        </div>
        <StatusBadge status={server.status} />
      </div>

      {/* Actions */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          {!isRunning && !isTransitioning && (
            <motion.div whileTap={{ scale: 0.96 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
              <Button onClick={() => runAction("start")} disabled={!!actionLoading} className="gap-2">
                {actionLoading === "start" ? <LoadingSpinner size={14} /> : <Play className="w-4 h-4" />}
                Start Server
              </Button>
            </motion.div>
          )}
          {isRunning && (
            <>
              <motion.div whileTap={{ scale: 0.96 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
                <Button variant="outline" onClick={() => runAction("restart")} disabled={!!actionLoading} className="gap-2">
                  {actionLoading === "restart" ? <LoadingSpinner size={14} /> : <RotateCcw className="w-4 h-4" />}
                  Restart
                </Button>
              </motion.div>
              <motion.div whileTap={{ scale: 0.96 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
                <Button variant="outline" onClick={() => runAction("stop")} disabled={!!actionLoading} className="gap-2 text-destructive hover:text-destructive">
                  {actionLoading === "stop" ? <LoadingSpinner size={14} /> : <Square className="w-4 h-4" />}
                  Stop
                </Button>
              </motion.div>
            </>
          )}
          {isTransitioning && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoadingSpinner size={16} />
              <span className="capitalize">{server.status}...</span>
            </div>
          )}

          {address && (
            <div className="ml-auto flex items-center gap-2 bg-muted/50 rounded-md px-3 py-1.5">
              <span className="text-sm font-mono text-muted-foreground">{address}</span>
              <motion.button
                whileTap={{ scale: 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                onClick={copyAddress}
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
              </motion.button>
            </div>
          )}
        </div>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <MemoryStick className="w-4 h-4 text-primary" />
            RAM
          </div>
          <UsageBar
            label=""
            used={isRunning ? Math.floor(server.ram_mb * 0.6) : 0}
            total={server.ram_mb}
          />
          <p className="text-xs text-muted-foreground">
            {server.ram_mb / 1024}GB allocated
          </p>
        </Card>

        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Cpu className="w-4 h-4 text-primary" />
            CPU
          </div>
          <UsageBar
            label=""
            used={isRunning ? Math.floor(server.cpu_percent * 0.3) : 0}
            total={server.cpu_percent}
            unit="percent"
            formatValue={(v) => `${v}%`}
          />
          <p className="text-xs text-muted-foreground">
            {server.cpu_percent}% limit
          </p>
        </Card>

        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <HardDrive className="w-4 h-4 text-primary" />
            Disk
          </div>
          <UsageBar
            label=""
            used={Math.floor(server.disk_mb * 0.1)}
            total={server.disk_mb}
          />
          <p className="text-xs text-muted-foreground">
            {server.disk_mb / 1024}GB allocated
          </p>
        </Card>
      </div>

      {/* Server info */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Server Info</h3>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <dt className="text-muted-foreground">MOTD</dt>
            <dd className="font-medium">{server.motd}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Max Players</dt>
            <dd className="font-medium">{server.max_players}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Region</dt>
            <dd className="font-medium">
              {server.regions ? `${server.regions.flag_emoji} ${server.regions.name}` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Node</dt>
            <dd className="font-medium">{server.nodes?.name ?? "—"}</dd>
          </div>
        </dl>
      </Card>
    </motion.div>
  );
}
