"use client";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { LoadingSpinner } from "@/components/shared/MinecraftLoader";
import { PageLoader } from "@/components/shared/LoadingScreen";
import { PageHeader } from "@/components/shared/PageHeader";
import { toast } from "sonner";
import type { Node } from "@/lib/supabase/types";

const DEFAULT_LOCAL_IP = "0.0.0.0";

export default function AllocationsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    node_id: "",
    ip: "",
    port: 25565,
    local_ip: DEFAULT_LOCAL_IP,
  });

  const { data: allocations = [], isLoading } = useQuery<any[]>({
    queryKey: ["allocations"],
    queryFn: async () => {
      const res = await fetch("/api/allocations");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: nodes = [] } = useQuery<Node[]>({
    queryKey: ["nodes"],
    queryFn: async () => {
      const res = await fetch("/api/nodes");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // Group allocations by node_id
  const grouped = useMemo(() => {
    const map = new Map<string, { nodeName: string; allocs: any[] }>();
    for (const alloc of allocations) {
      const nodeId = alloc.node_id as string;
      if (!map.has(nodeId)) {
        map.set(nodeId, {
          nodeName: alloc.nodes?.name ?? nodeId,
          allocs: [],
        });
      }
      map.get(nodeId)!.allocs.push(alloc);
    }
    return map;
  }, [allocations]);

  function resetForm() {
    setForm({ node_id: "", ip: "", port: 25565, local_ip: DEFAULT_LOCAL_IP });
  }

  async function createAllocation() {
    setSaving(true);
    try {
      const res = await fetch("/api/allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ["allocations"] });
        toast.success("Allocation created");
        setOpen(false);
        resetForm();
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Failed to create allocation");
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteAllocation(id: string) {
    await fetch(`/api/allocations/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["allocations"] });
    toast.success("Allocation deleted");
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Allocations"
        description="IP:port pairs available for server assignment, grouped by node."
        action={
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Allocation
          </Button>
        }
      />

      {grouped.size === 0 ? (
        <Card className="py-12 text-center text-muted-foreground">
          No allocations configured. Add one to get started.
        </Card>
      ) : (
        Array.from(grouped.entries()).map(([nodeId, { nodeName, allocs }]) => (
          <div key={nodeId} className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
              {nodeName}
            </h2>
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Public IP:Port</TableHead>
                    <TableHead>Local IP (bind addr)</TableHead>
                    <TableHead>Server</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocs.map((alloc) => (
                    <TableRow key={alloc.id}>
                      <TableCell className="font-mono text-sm">
                        {alloc.ip}:{alloc.port}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {alloc.local_ip ?? DEFAULT_LOCAL_IP}
                      </TableCell>
                      <TableCell className="text-sm">
                        {alloc.servers?.name ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            alloc.server_id
                              ? "text-primary border-primary/30"
                              : "text-muted-foreground"
                          }
                        >
                          {alloc.server_id ? "Assigned" : "Free"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => setDeleteTarget(alloc.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        ))
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Allocation</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1">
              <Label>Node</Label>
              <Select
                value={form.node_id}
                onValueChange={(v) => setForm({ ...form, node_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select node" />
                </SelectTrigger>
                <SelectContent>
                  {nodes.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Public IP</Label>
                <Input
                  value={form.ip}
                  onChange={(e) => setForm({ ...form, ip: e.target.value })}
                  placeholder="203.0.113.1"
                />
              </div>
              <div className="space-y-1">
                <Label>Port</Label>
                <Input
                  type="number"
                  value={form.port}
                  onChange={(e) =>
                    setForm({ ...form, port: parseInt(e.target.value) || 25565 })
                  }
                  min={1024}
                  max={65535}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Local IP (bind address)</Label>
              <Input
                value={form.local_ip}
                onChange={(e) => setForm({ ...form, local_ip: e.target.value })}
                placeholder={DEFAULT_LOCAL_IP}
              />
              <p className="text-xs text-muted-foreground">
                The interface the daemon binds to. Use {DEFAULT_LOCAL_IP} to bind all interfaces.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={createAllocation}
              disabled={saving || !form.node_id || !form.ip}
              className="gap-2"
            >
              {saving && <LoadingSpinner size={12} />}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete this allocation?"
        confirmLabel="Delete"
        onConfirm={() =>
          deleteTarget ? deleteAllocation(deleteTarget) : Promise.resolve()
        }
      />
    </div>
  );
}
