"use client";
import { motion } from "motion/react";
import { Server, Copy, Check, Play, Square, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { UsageBar } from "@/components/shared/UsageBar";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { LoadingSpinner } from "@/components/shared/MinecraftLoader";
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
      if (data.status) setCurrentStatus(data.status);
    } catch {
      toast.error("Action failed");
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
  const isTransitioning = ["starting", "stopping", "restarting", "creating"].includes(currentStatus);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
    >
      <Card className="p-5 flex flex-col gap-4 hover:border-primary/30 transition-colors cursor-default group">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <Server className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              {isRunning && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-primary border-2 border-background animate-pulse" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <Link
                href={`/${locale}/servers/${server.id}`}
                className="font-semibold text-base text-foreground hover:text-primary transition-colors truncate block"
              >
                {server.name}
              </Link>
              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground flex-wrap">
                <span className="font-medium">{server.edition === "java" ? "Java" : "Bedrock"}</span>
                <span className="text-muted-foreground/60">·</span>
                <span>{server.game_version}</span>
                <span className="text-muted-foreground/60">·</span>
                <span className="capitalize">{server.loader}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <StatusBadge status={currentStatus} />
            {server.regions?.flag_emoji && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                <span className="text-base leading-none">{server.regions.flag_emoji}</span>
                {server.regions.name}
              </span>
            )}
          </div>
        </div>

        {address && (
          <div className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2">
            <code className="text-xs font-mono text-muted-foreground flex-1 truncate">
              {address}
            </code>
            <motion.button
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              onClick={copyAddress}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {copiedAddr ? (
                <Check className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </motion.button>
          </div>
        )}

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

        <div className="flex items-center gap-2 pt-1">
          {!isRunning && !isTransitioning && (
            <motion.div whileTap={{ scale: 0.96 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => runAction("start")}
                disabled={!!actionLoading}
              >
                {actionLoading === "start" ? (
                  <LoadingSpinner size={14} />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                Start
              </Button>
            </motion.div>
          )}

          {isRunning && (
            <>
              <motion.div whileTap={{ scale: 0.96 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => runAction("restart")}
                  disabled={!!actionLoading}
                >
                  {actionLoading === "restart" ? (
                    <LoadingSpinner size={14} />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5" />
                  )}
                  Restart
                </Button>
              </motion.div>
              <motion.div whileTap={{ scale: 0.96 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  onClick={() => runAction("stop")}
                  disabled={!!actionLoading}
                >
                  {actionLoading === "stop" ? (
                    <LoadingSpinner size={14} />
                  ) : (
                    <Square className="w-3.5 h-3.5" />
                  )}
                  Stop
                </Button>
              </motion.div>
            </>
          )}

          {isTransitioning && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoadingSpinner size={14} />
              <span className="capitalize">{currentStatus}...</span>
            </div>
          )}

          <div className="flex-1" />

          <Link href={`/${locale}/servers/${server.id}`}>
            <Button size="sm" variant="ghost" className="text-xs">
              Manage →
            </Button>
          </Link>

          <motion.button
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
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
