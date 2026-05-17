"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Square, RotateCcw, Zap, ArrowRightLeft, WifiOff, Upload, Network } from "lucide-react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { PageLoader } from "@/components/shared/LoadingScreen";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/shared/MinecraftLoader";
import { formatMb } from "@/lib/utils";
import { toast } from "sonner";
import type { Server, Node } from "@/lib/supabase/types";

type AdminAction = "start" | "stop" | "restart" | "kill";

function NodeOfflineBanner({ count }: { count: number }) {
  if (!count) return null;
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span><strong>{count} node{count > 1 ? "s" : ""}</strong> offline — servers on those nodes are shown in grey. Use Kill to forcibly reset their status.</span>
    </div>
  );
}

export default function AdminServersPage() {
  const qc = useQueryClient();
  const locale = useLocale();
  const [migrateTarget, setMigrateTarget] = useState<Server | null>(null);
  const [targetNode, setTargetNode] = useState("");
  const [migrating, setMigrating] = useState(false);
  const [allocTarget, setAllocTarget] = useState<Server | null>(null);
  const [allocating, setAllocating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // `${serverId}:${action}`

  const { data: servers = [], isLoading } = useQuery<(Server & { allocations: any; nodes: any })[]>({
    queryKey: ["admin-servers"],
    queryFn: async () => {
      const res = await fetch("/api/servers");
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 10_000,
  });

  const { data: nodes = [] } = useQuery<(Node & { last_seen_at: string | null })[]>({
    queryKey: ["nodes"],
    queryFn: () => fetch("/api/nodes").then((r) => r.json()),
    refetchInterval: 15_000,
  });

  // Build map of node effective status (consider last heartbeat)
  const nodeStatus = new Map(
    nodes.map((n) => {
      const stale = !n.last_seen_at || Date.now() - new Date(n.last_seen_at).getTime() > 75_000;
      return [n.id, stale ? "offline" : n.status];
    })
  );

  const offlineNodeCount = [...nodeStatus.values()].filter((s) => s === "offline").length;

  async function runAction(serverId: string, action: AdminAction) {
    setActionLoading(`${serverId}:${action}`);
    try {
      const res = await fetch(`/api/admin/servers/${serverId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ["admin-servers"] });
        const labels: Record<AdminAction, string> = { start: "started", stop: "stopped", restart: "restarting", kill: "killed" };
        toast.success(`Server ${labels[action]}`);
      } else {
        toast.error(data.message ?? data.error ?? "Action failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setActionLoading(null);
    }
  }

  async function migrateServer() {
    if (!migrateTarget || !targetNode) return;
    setMigrating(true);
    try {
      await fetch(`/api/servers/${migrateTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ node_id: targetNode }),
      });
      qc.invalidateQueries({ queryKey: ["admin-servers"] });
      toast.success(`${migrateTarget.name} migrated`);
      setMigrateTarget(null);
      setTargetNode("");
    } finally {
      setMigrating(false);
    }
  }

  async function forceAllocate() {
    if (!allocTarget) return;
    setAllocating(true);
    try {
      const res = await fetch(`/api/servers/${allocTarget.id}/ports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim" }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Claimed ${data.claimed.ip}:${data.claimed.port} for ${allocTarget.name}`);
        qc.invalidateQueries({ queryKey: ["admin-servers"] });
        setAllocTarget(null);
      } else {
        toast.error(data.message ?? data.error ?? "Failed to allocate port");
      }
    } finally {
      setAllocating(false);
    }
  }

  if (isLoading) return <PageLoader />;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <PageHeader
          title="All Servers"
          description={`${servers.length} total servers`}
          action={
            <Link href={`/${locale}/admin/servers/import`}>
              <Button className="gap-2" size="sm">
                <Upload className="w-4 h-4" />
                Import Server
              </Button>
            </Link>
          }
        />

        <NodeOfflineBanner count={offlineNodeCount} />

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>RAM</TableHead>
                <TableHead>Node</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {servers.map((server) => {
                const nStatus = server.node_id ? nodeStatus.get(server.node_id) : null;
                const nodeOffline = nStatus === "offline";
                const isRunning = server.status === "running";
                const isOff = server.status === "offline" || server.status === "error";
                const isTransitioning = ["starting", "stopping", "restarting"].includes(server.status);
                const loading = (a: AdminAction) => actionLoading === `${server.id}:${a}`;

                return (
                  <TableRow key={server.id} className={nodeOffline ? "opacity-60" : ""}>
                    <TableCell className="font-medium text-sm">{server.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {server.clerk_user_id.slice(0, 12)}…
                    </TableCell>
                    <TableCell className="text-sm">
                      {server.game_version} <span className="text-muted-foreground">({server.loader})</span>
                    </TableCell>
                    <TableCell className="text-sm">{formatMb(server.ram_mb)}</TableCell>
                    <TableCell className="text-sm">
                      {(server as any).nodes?.name ?? (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                      {nodeOffline && (
                        <Badge variant="outline" className="ml-1.5 text-[10px] border-amber-500/40 text-amber-500">
                          offline
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell><StatusBadge status={server.status} /></TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1 pr-2">
                        {/* Start */}
                        {isOff && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-green-500 hover:text-green-400"
                                disabled={!!actionLoading || nodeOffline}
                                onClick={() => runAction(server.id, "start")}
                              >
                                {loading("start") ? <LoadingSpinner size={12} /> : <Play className="w-3.5 h-3.5" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Start</TooltipContent>
                          </Tooltip>
                        )}

                        {/* Restart */}
                        {isRunning && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                disabled={!!actionLoading || nodeOffline}
                                onClick={() => runAction(server.id, "restart")}
                              >
                                {loading("restart") ? <LoadingSpinner size={12} /> : <RotateCcw className="w-3.5 h-3.5" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Restart</TooltipContent>
                          </Tooltip>
                        )}

                        {/* Stop */}
                        {(isRunning || isTransitioning) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                disabled={!!actionLoading || nodeOffline}
                                onClick={() => runAction(server.id, "stop")}
                              >
                                {loading("stop") ? <LoadingSpinner size={12} /> : <Square className="w-3.5 h-3.5" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Stop (graceful)</TooltipContent>
                          </Tooltip>
                        )}

                        {/* Kill — always available (resets stuck states) */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-orange-500 hover:text-orange-400"
                              disabled={!!actionLoading}
                              onClick={() => runAction(server.id, "kill")}
                            >
                              {loading("kill") ? <LoadingSpinner size={12} /> : <Zap className="w-3.5 h-3.5" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Kill (SIGKILL — force stop)</TooltipContent>
                        </Tooltip>

                        {/* Migrate */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => setMigrateTarget(server)}
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Migrate to another node</TooltipContent>
                        </Tooltip>

                        {/* Force Allocate Port */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-blue-400 hover:text-blue-300"
                              onClick={() => setAllocTarget(server)}
                            >
                              <Network className="w-3.5 h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Force claim a free port</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>

        {/* Force Allocate Dialog */}
        <Dialog open={!!allocTarget} onOpenChange={(o) => !o && setAllocTarget(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Force Claim Port — {allocTarget?.name}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground py-2">
              This will assign the next free allocation on{" "}
              <span className="font-medium text-foreground">
                {nodes.find((n) => n.id === allocTarget?.node_id)?.name ?? "this node"}
              </span>{" "}
              to the server, bypassing the user&apos;s port quota.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAllocTarget(null)}>Cancel</Button>
              <Button onClick={forceAllocate} disabled={allocating} className="gap-2">
                {allocating && <LoadingSpinner size={12} />}
                Claim Port
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Migrate Dialog */}
        <Dialog open={!!migrateTarget} onOpenChange={(o) => !o && setMigrateTarget(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Migrate: {migrateTarget?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label>Target Node</Label>
                <Select onValueChange={setTargetNode}>
                  <SelectTrigger><SelectValue placeholder="Select node" /></SelectTrigger>
                  <SelectContent>
                    {nodes
                      .filter((n) => n.id !== migrateTarget?.node_id)
                      .map((n) => (
                        <SelectItem key={n.id} value={n.id}>
                          {n.name}
                          {nodeStatus.get(n.id) === "offline" && " (offline)"}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMigrateTarget(null)}>Cancel</Button>
              <Button onClick={migrateServer} disabled={migrating || !targetNode} className="gap-2">
                {migrating && <LoadingSpinner size={12} />}
                Migrate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
