"use client";
import { motion } from "motion/react";
import { Copy, Check, Play, Square, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { UsageBar } from "@/components/shared/UsageBar";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { LoadingSpinner } from "@/components/shared/MinecraftLoader";
import { ServerBlock, CompassIcon } from "@/components/pixel/Block";
import type { Server as ServerType } from "@/lib/supabase/types";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { toast } from "sonner";
import Link from "next/link";

interface ServerCardProps {
  server: ServerType & {
    allocations?: { ip: string; port: number } | null;
    regions?: { name: string; flag_emoji: string | null } | null;
  };
  index?: number;
  onDeleted?: () => void;
}

export function ServerCard({ server, index = 0, onDeleted }: ServerCardProps) {
  const locale = useLocale();
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(server.status);

  const address = server.allocations
    ? `${server.allocations.ip}:${server.allocations.port}`
    : null;

  async function runAction(action: "start" | "stop" | "restart") {
    setActionLoading(action);
    try {
      const res = await fetch(`/api/servers/${server.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.error === "hibernated") {
        toast.error("This server is hibernating. Wake it up first.");
        router.refresh();
        return;
      }
      if (data.status) setCurrentStatus(data.status);
    } catch {
      toast.error("Action failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function wakeUp() {
    setActionLoading("wake");
    try {
      const res = await fetch(`/api/servers/${server.id}/reallocate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? data.error ?? "Failed to wake server");
        return;
      }
      toast.success("Server woken up — ready to start");
      setCurrentStatus("offline");
      router.refresh();
    } catch {
      toast.error("Failed to wake server");
    } finally {
      setActionLoading(null);
    }
  }

  async function deleteServer() {
    const res = await fetch(`/api/servers/${server.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Server deleted");
      onDeleted?.();
    } else {
      toast.error("Failed to delete server");
    }
  }

  function copyAddress() {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 2000);
  }

  const isRunning = currentStatus === "running";
  const isHibernated = currentStatus === "hibernated";
  const isTransitioning = ["starting", "stopping", "restarting", "creating"].includes(currentStatus);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
    >
      <Card
        className="p-5 flex flex-col gap-4 transition-colors group"
        style={{
          borderRadius: 0,
          border: "2px solid hsl(var(--border))",
          boxShadow:
            "inset 2px 2px 0 rgba(255,255,255,0.03), 3px 3px 0 rgba(0,0,0,0.25)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="relative shrink-0">
              <ServerBlock size={42} />
              {isRunning && (
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-primary"
                  style={{
                    boxShadow: "0 0 0 2px hsl(var(--card)), 0 0 6px rgba(90,154,46,0.7)",
                    animation: "mc-blink 2s infinite",
                  }}
                />
              )}
              {isHibernated && (
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-slate-500"
                  style={{ boxShadow: "0 0 0 2px hsl(var(--card))" }}
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <Link
                href={`/${locale}/servers/${server.id}`}
                className="font-minecraft text-[11px] text-foreground hover:text-primary transition-colors truncate block"
              >
                {server.name}
              </Link>
              <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground flex-wrap">
                <span className="uppercase tracking-wide">
                  {server.edition === "java" ? "Java" : "Bedrock"}
                </span>
                <span>·</span>
                <span>{server.game_version}</span>
                <span>·</span>
                <span className="capitalize">{server.loader}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <StatusBadge status={currentStatus} />
            {server.regions?.name && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1.5 whitespace-nowrap">
                <CompassIcon size={12} />
                {server.regions.name}
              </span>
            )}
          </div>
        </div>

        {address && !isHibernated && (
          <div
            className="flex items-center gap-2 px-3 py-2 border"
            style={{ background: "hsl(var(--muted)/0.5)", borderColor: "hsl(var(--border))", borderRadius: 0 }}
          >
            <code className="text-xs font-mono text-muted-foreground flex-1 truncate">
              {address}
            </code>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={copyAddress}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {copiedAddr ? (
                <Check className="w-3.5 h-3.5 text-primary" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </motion.button>
          </div>
        )}

        {isHibernated && (
          <div
            className="px-3 py-2 border text-xs flex items-center gap-2"
            style={{
              background: "rgba(122,85,56,0.15)",
              borderColor: "#7a5538",
              borderRadius: 0,
              color: "#9a7055",
            }}
          >
            <span>Hibernating · files saved · reallocate to play</span>
          </div>
        )}

        {!isHibernated && (
          <div className="space-y-2.5">
            <UsageBar
              label="RAM"
              used={isRunning ? Math.floor(server.ram_mb * 0.6) : 0}
              total={server.ram_mb}
            />
            <UsageBar
              label="Disk"
              used={Math.floor(server.disk_mb * 0.1)}
              total={server.disk_mb}
            />
          </div>
        )}

        <div className="flex items-center gap-2 pt-1 flex-wrap">
          {isHibernated && (
            <Button
              size="sm"
              className="gap-1.5 font-minecraft text-[9px] pixel-border-green"
              onClick={wakeUp}
              disabled={!!actionLoading}
              style={{ background: "#5a9a2e", color: "#fff", borderRadius: 0 }}
            >
              {actionLoading === "wake" ? <LoadingSpinner size={12} /> : <Play className="w-3 h-3" />}
              Wake up
            </Button>
          )}

          {!isRunning && !isTransitioning && !isHibernated && (
            <Button
              size="sm"
              className="gap-1.5 font-minecraft text-[9px] pixel-border-green"
              onClick={() => runAction("start")}
              disabled={!!actionLoading}
              style={{ background: "#5a9a2e", color: "#fff", borderRadius: 0 }}
            >
              {actionLoading === "start" ? <LoadingSpinner size={12} /> : <Play className="w-3 h-3" />}
              Start
            </Button>
          )}

          {isRunning && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 font-minecraft text-[9px]"
                onClick={() => runAction("restart")}
                disabled={!!actionLoading}
                style={{ borderRadius: 0 }}
              >
                {actionLoading === "restart" ? <LoadingSpinner size={12} /> : <RotateCcw className="w-3 h-3" />}
                Restart
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 font-minecraft text-[9px] text-destructive hover:text-destructive"
                onClick={() => runAction("stop")}
                disabled={!!actionLoading}
                style={{ borderRadius: 0 }}
              >
                {actionLoading === "stop" ? <LoadingSpinner size={12} /> : <Square className="w-3 h-3" />}
                Stop
              </Button>
            </>
          )}

          {isTransitioning && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoadingSpinner size={14} />
              <span className="capitalize font-minecraft text-[9px]">{currentStatus}...</span>
            </div>
          )}

          <div className="flex-1" />

          <Link href={`/${locale}/servers/${server.id}`}>
            <Button
              size="sm"
              variant="ghost"
              className="text-[10px] font-minecraft"
              style={{ borderRadius: 0 }}
            >
              Manage →
            </Button>
          </Link>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setDeleteOpen(true)}
            className="text-muted-foreground hover:text-destructive transition-colors p-1"
          >
            <Trash2 className="w-4 h-4" />
          </motion.button>
        </div>
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this server?"
        description="This action cannot be undone. All data will be permanently deleted."
        confirmLabel="Delete Server"
        onConfirm={deleteServer}
      />
    </motion.div>
  );
}
