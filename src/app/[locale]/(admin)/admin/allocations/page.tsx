"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Link2 } from "lucide-react";
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
import type { Allocation, Node } from "@/lib/supabase/types";

export default function AllocationsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ node_id: "", ip: "", port: 25565 });

  const { data: allocations = [], isLoading } = useQuery<any[]>({
    queryKey: ["allocations"],
    queryFn: async () => {
      const res = await fetch("/api/allocations");
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data;
    },
  });

  const { data: nodes = [] } = useQuery<Node[]>({
    queryKey: ["nodes"],
    queryFn: async () => {
      const res = await fetch("/api/nodes");
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data;
    },
  });

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
        setForm({ node_id: "", ip: "", port: 25565 });
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Failed");
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
    <div className="space-y-4">
      <PageHeader
        title="Allocations"
        description="IP:port pairs available for server assignment."
        action={
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Allocation
          </Button>
        }
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>IP:Port</TableHead>
              <TableHead>Node</TableHead>
              <TableHead>Server</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {allocations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No allocations configured
                </TableCell>
              </TableRow>
            ) : (
              allocations.map((alloc) => (
                <TableRow key={alloc.id}>
                  <TableCell className="font-mono text-sm">
                    {alloc.ip}:{alloc.port}
                  </TableCell>
                  <TableCell className="text-sm">{alloc.nodes?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm">{alloc.servers?.name ?? "—"}</TableCell>
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
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Allocation</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1">
              <Label>Node</Label>
              <Select onValueChange={(v) => setForm({ ...form, node_id: v })}>
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
                <Label>IP Address</Label>
                <Input value={form.ip} onChange={(e) => setForm({ ...form, ip: e.target.value })} placeholder="192.168.1.1" />
              </div>
              <div className="space-y-1">
                <Label>Port</Label>
                <Input type="number" value={form.port} onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) })} min={1024} max={65535} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={createAllocation} disabled={saving || !form.node_id || !form.ip} className="gap-2">
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
        onConfirm={() => deleteTarget ? deleteAllocation(deleteTarget) : Promise.resolve()}
      />
    </div>
  );
}
