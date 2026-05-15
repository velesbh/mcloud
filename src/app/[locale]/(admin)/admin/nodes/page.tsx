"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Plus, Network, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { LoadingSpinner } from "@/components/shared/MinecraftLoader";
import { PageLoader } from "@/components/shared/LoadingScreen";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { UsageBar } from "@/components/shared/UsageBar";
import { toast } from "sonner";
import type { Node, Region } from "@/lib/supabase/types";

export default function NodesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    region_id: "",
    fqdn: "",
    ip: "",
    total_ram_mb: 8192,
    total_cpu: 400,
    total_disk_mb: 102400,
  });

  const { data: nodes = [], isLoading } = useQuery<(Node & { regions: any })[]>({
    queryKey: ["nodes"],
    queryFn: () => fetch("/api/nodes").then((r) => r.json()),
  });

  const { data: regions = [] } = useQuery<Region[]>({
    queryKey: ["regions"],
    queryFn: () => fetch("/api/regions").then((r) => r.json()),
  });

  async function createNode() {
    setSaving(true);
    try {
      const res = await fetch("/api/nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ["nodes"] });
        toast.success("Node created");
        setOpen(false);
        setForm({ name: "", region_id: "", fqdn: "", ip: "", total_ram_mb: 8192, total_cpu: 400, total_disk_mb: 102400 });
      } else {
        toast.error("Failed to create node");
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteNode(id: string) {
    await fetch(`/api/nodes/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["nodes"] });
    toast.success("Node deleted");
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Nodes"
        description="Physical and virtual servers hosting Minecraft instances."
        action={
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Node
          </Button>
        }
      />

      {nodes.length === 0 ? (
        <EmptyState
          title="No nodes configured"
          description="Add your first node to start hosting servers."
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
                    <p className="text-xs text-muted-foreground">{node.fqdn}</p>
                    <p className="text-xs text-muted-foreground">
                      {node.regions?.flag_emoji} {node.regions?.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        node.status === "online"
                          ? "text-green-500 border-green-500/30"
                          : "text-zinc-500"
                      }
                    >
                      {node.status}
                    </Badge>
                    <button
                      onClick={() => setDeleteTarget(node.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <UsageBar label="RAM" used={0} total={node.total_ram_mb} />
                <UsageBar
                  label="CPU"
                  used={0}
                  total={node.total_cpu}
                  unit="percent"
                  formatValue={(v) => `${v}%`}
                />
                <p className="text-xs text-muted-foreground">{node.ip}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add node dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Node</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Region</Label>
                <Select onValueChange={(v) => setForm({ ...form, region_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
                  <SelectContent>
                    {regions.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.flag_emoji} {r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>FQDN / Hostname</Label>
                <Input value={form.fqdn} onChange={(e) => setForm({ ...form, fqdn: e.target.value })} placeholder="node1.enzonic.com" />
              </div>
              <div className="space-y-1">
                <Label>IP Address</Label>
                <Input value={form.ip} onChange={(e) => setForm({ ...form, ip: e.target.value })} placeholder="192.168.1.1" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>RAM (MB)</Label>
                <Input type="number" value={form.total_ram_mb} onChange={(e) => setForm({ ...form, total_ram_mb: parseInt(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label>CPU (%)</Label>
                <Input type="number" value={form.total_cpu} onChange={(e) => setForm({ ...form, total_cpu: parseInt(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label>Disk (MB)</Label>
                <Input type="number" value={form.total_disk_mb} onChange={(e) => setForm({ ...form, total_disk_mb: parseInt(e.target.value) })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={createNode} disabled={saving || !form.name || !form.region_id || !form.ip} className="gap-2">
              {saving && <LoadingSpinner size={12} />}
              Add Node
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
