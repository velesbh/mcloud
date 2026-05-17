"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Network, Trash2, AlertTriangle, Pencil, Globe } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PageLoader } from "@/components/shared/LoadingScreen";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { UsageBar } from "@/components/shared/UsageBar";
import { toast } from "sonner";
import type { Node, Region } from "@/lib/supabase/types";

export default function NodesPage() {
  const qc = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<Node | null>(null);
  const [assignRegion, setAssignRegion] = useState("");
  const [overcommitTarget, setOvercommitTarget] = useState<Node | null>(null);
  const [overcommitValue, setOvercommitValue] = useState(100);
  const [saving, setSaving] = useState(false);

  const { data: nodes = [], isLoading } = useQuery<(Node & { regions: any })[]>({
    queryKey: ["nodes"],
    queryFn: async () => {
      const res = await fetch("/api/nodes");
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data;
    },
  });

  const { data: regions = [] } = useQuery<Region[]>({
    queryKey: ["regions"],
    queryFn: async () => {
      const res = await fetch("/api/regions");
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data;
    },
  });

  async function assignRegionToNode() {
    if (!assignTarget || !assignRegion) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/nodes/${assignTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region_id: assignRegion }),
      });
      const data = await res.json();
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ["nodes"] });
        toast.success("Region assigned");
        setAssignTarget(null);
        setAssignRegion("");
      } else {
        toast.error(data.error || "Failed to assign region");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function saveOvercommit() {
    if (!overcommitTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/nodes/${overcommitTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memory_overcommit_percent: overcommitValue }),
      });
      const data = await res.json();
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ["nodes"] });
        toast.success("Memory overcommit updated");
        setOvercommitTarget(null);
      } else {
        toast.error(data.error || "Failed to update overcommit");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function deleteNode(id: string) {
    try {
      const res = await fetch(`/api/nodes/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ["nodes"] });
        toast.success("Node deleted");
        setDeleteTarget(null);
      } else {
        toast.error(data.error || "Failed to delete node");
      }
    } catch (err) {
      toast.error("Network error");
    }
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Nodes"
        description="Physical and virtual servers hosting Minecraft instances. Auto-registered by daemon."
      />

      {nodes.length === 0 ? (
        <EmptyState
          title="No nodes online"
          description="Waiting for daemon to register nodes..."
          icon={<Network className="w-12 h-12 text-muted-foreground" />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {nodes.map((node, i) => (
            <motion.div
              key={node.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <Card className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{node.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{node.ip}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {(() => {
                      const stale = !node.last_seen_at || Date.now() - new Date(node.last_seen_at).getTime() > 75_000;
                      const effectiveStatus = stale ? "offline" : node.status;
                      const secsAgo = node.last_seen_at
                        ? Math.round((Date.now() - new Date(node.last_seen_at).getTime()) / 1000)
                        : null;
                      return (
                        <div className="flex flex-col items-end gap-0.5">
                          <Badge
                            variant="outline"
                            className={effectiveStatus === "online" ? "text-green-500 border-green-500/30" : "text-amber-500 border-amber-500/30"}
                          >
                            {effectiveStatus}
                          </Badge>
                          {secsAgo !== null && (
                            <span className="text-[10px] text-muted-foreground">
                              {secsAgo < 60 ? `${secsAgo}s ago` : `${Math.floor(secsAgo / 60)}m ago`}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                    <button
                      onClick={() => { setOvercommitTarget(node); setOvercommitValue(node.memory_overcommit_percent ?? 100); }}
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit memory overcommit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { setAssignTarget(node); setAssignRegion(node.region_id ?? ""); }}
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                      title="Assign region"
                    >
                      <Globe className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(node.id)}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Region — warn if unassigned */}
                {node.region_id ? (
                  <p className="text-xs text-muted-foreground">
                    {node.regions?.flag_emoji} {node.regions?.name}
                  </p>
                ) : (
                  <p className="text-xs text-amber-500 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> No region assigned
                  </p>
                )}

                <UsageBar label="RAM" used={(node as any).allocated_ram_mb ?? 0} total={node.total_ram_mb} />
                <UsageBar
                  label="CPU"
                  used={(node as any).allocated_cpu ?? 0}
                  total={node.total_cpu}
                  unit="percent"
                  formatValue={(v) => `${v}%`}
                />
                <p className="text-xs text-muted-foreground">
                  {(node as any).used_allocations ?? 0} / {(node as any).total_allocations ?? 0} ports assigned
                </p>
                <p className="text-xs text-muted-foreground">
                  Memory overcommit: {node.memory_overcommit_percent ?? 100}%
                </p>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Memory Overcommit Dialog */}
      <Dialog open={!!overcommitTarget} onOpenChange={(o) => !o && setOvercommitTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Memory Overcommit — {overcommitTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Memory overcommit %</Label>
              <Input
                type="number"
                value={overcommitValue}
                onChange={(e) => setOvercommitValue(parseInt(e.target.value) || 100)}
                min={100}
                max={500}
                step={10}
              />
              <p className="text-xs text-muted-foreground">
                100 = no overcommit, 150 = allow 50% more RAM than installed
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOvercommitTarget(null)}>Cancel</Button>
            <Button onClick={saveOvercommit} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Region Dialog */}
      <Dialog open={!!assignTarget} onOpenChange={(o) => !o && setAssignTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign Region — {assignTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Region</Label>
            <Select value={assignRegion} onValueChange={setAssignRegion}>
              <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
              <SelectContent>
                {regions.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.flag_emoji} {r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignTarget(null)}>Cancel</Button>
            <Button onClick={assignRegionToNode} disabled={saving || !assignRegion}>
              {saving ? "Saving..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete this node?"
        description="All servers on this node will be unassigned."
        confirmLabel="Delete"
        onConfirm={() => deleteTarget ? deleteNode(deleteTarget) : Promise.resolve()}
      />
    </div>
  );
}
