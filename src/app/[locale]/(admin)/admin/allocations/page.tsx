"use client";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Star } from "lucide-react";
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

// Parse "25565" → {from:25565,to:25565} or "25565-25600" → {from:25565,to:25600}
// Returns null if invalid.
function parsePortInput(raw: string): { from: number; to: number } | null {
  const trimmed = raw.trim();
  const rangeMatch = trimmed.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (rangeMatch) {
    const from = parseInt(rangeMatch[1]);
    const to = parseInt(rangeMatch[2]);
    if (from >= 1 && to <= 65535 && from <= to) return { from, to };
    return null;
  }
  const single = parseInt(trimmed);
  if (!isNaN(single) && single >= 1 && single <= 65535) return { from: single, to: single };
  return null;
}

export default function AllocationsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    node_id: "",
    ip: "",
    ports: "25565",
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
    setForm({ node_id: "", ip: "", ports: "25565", local_ip: DEFAULT_LOCAL_IP });
  }

  const parsedPorts = parsePortInput(form.ports);
  const portCount = parsedPorts ? parsedPorts.to - parsedPorts.from + 1 : 0;
  const isSingle = portCount === 1;

  async function createAllocation() {
    if (!parsedPorts) { toast.error("Invalid port or range"); return; }
    setSaving(true);
    const toastId = isSingle ? undefined : toast.loading(`Creating ${portCount} allocations...`);
    try {
      let res: Response;
      if (isSingle) {
        res = await fetch("/api/allocations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ node_id: form.node_id, ip: form.ip, port: parsedPorts.from, local_ip: form.local_ip }),
        });
      } else {
        res = await fetch("/api/allocations/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ node_id: form.node_id, ip: form.ip, port_from: parsedPorts.from, port_to: parsedPorts.to, local_ip: form.local_ip }),
        });
      }
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ["allocations"] });
        const msg = isSingle ? "Allocation created" : `Created ${portCount} allocations`;
        if (toastId) toast.success(msg, { id: toastId }); else toast.success(msg);
        setOpen(false);
        resetForm();
      } else {
        const err = await res.json();
        const msg = err.error ?? "Failed to create allocation(s)";
        if (toastId) toast.error(msg, { id: toastId }); else toast.error(msg);
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

  async function setDefault(id: string, currentlyDefault: boolean) {
    const res = await fetch(`/api/allocations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_default: !currentlyDefault }),
    });
    if (res.ok) {
      qc.invalidateQueries({ queryKey: ["allocations"] });
      toast.success(currentlyDefault ? "Default cleared" : "Set as default port");
    } else {
      toast.error("Failed to update");
    }
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
                    <TableHead className="w-8 text-center">Default</TableHead>
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
                      <TableCell className="text-center">
                        <button
                          onClick={() => setDefault(alloc.id, !!alloc.is_default)}
                          title={alloc.is_default ? "Default port — click to unset" : "Set as default port"}
                          className={`transition-colors ${alloc.is_default ? "text-amber-400 hover:text-amber-300" : "text-muted-foreground hover:text-amber-400"}`}
                        >
                          <Star className={`w-4 h-4 ${alloc.is_default ? "fill-amber-400" : ""}`} />
                        </button>
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
              <Select value={form.node_id} onValueChange={(v) => setForm({ ...form, node_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select node" /></SelectTrigger>
                <SelectContent>
                  {nodes.map((n) => (
                    <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
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
                <Label>Port(s)</Label>
                <Input
                  value={form.ports}
                  onChange={(e) => setForm({ ...form, ports: e.target.value })}
                  placeholder="25565 or 25565-25600"
                />
              </div>
            </div>

            {form.ports && (
              parsedPorts ? (
                <p className="text-xs text-muted-foreground">
                  {isSingle
                    ? <>Single port <span className="font-mono text-foreground">{parsedPorts.from}</span></>
                    : <>Range <span className="font-mono text-foreground">{parsedPorts.from}–{parsedPorts.to}</span> · will create <span className="font-medium text-foreground">{portCount}</span> allocation{portCount !== 1 ? "s" : ""}</>
                  }
                </p>
              ) : (
                <p className="text-xs text-destructive">Invalid — use a port number (25565) or range (25565-25600)</p>
              )
            )}

            <div className="space-y-1">
              <Label>Local IP (bind address)</Label>
              <Input
                value={form.local_ip}
                onChange={(e) => setForm({ ...form, local_ip: e.target.value })}
                placeholder={DEFAULT_LOCAL_IP}
              />
              <p className="text-xs text-muted-foreground">
                Interface the daemon binds to. Use {DEFAULT_LOCAL_IP} for all interfaces.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
            <Button
              onClick={createAllocation}
              disabled={saving || !form.node_id || !form.ip || !parsedPorts || portCount > 500}
              className="gap-2"
            >
              {saving && <LoadingSpinner size={12} />}
              {isSingle ? "Add" : `Create ${portCount} allocations`}
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
