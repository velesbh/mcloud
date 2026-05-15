"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageLoader } from "@/components/shared/LoadingScreen";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/shared/MinecraftLoader";
import { formatMb } from "@/lib/utils";
import { toast } from "sonner";
import type { Server, Node } from "@/lib/supabase/types";

export default function AdminServersPage() {
  const qc = useQueryClient();
  const [migrateTarget, setMigrateTarget] = useState<Server | null>(null);
  const [targetNode, setTargetNode] = useState("");
  const [migrating, setMigrating] = useState(false);

  const { data: servers = [], isLoading } = useQuery<Server[]>({
    queryKey: ["admin-servers"],
    queryFn: async () => {
      const res = await fetch("/api/servers");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: nodes = [] } = useQuery<Node[]>({
    queryKey: ["nodes"],
    queryFn: () => fetch("/api/nodes").then((r) => r.json()),
  });

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

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <PageHeader title="All Servers" description={`${servers.length} total servers`} />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>RAM</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {servers.map((server) => (
              <TableRow key={server.id}>
                <TableCell className="font-medium text-sm">{server.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground font-mono">
                  {server.clerk_user_id.slice(0, 12)}...
                </TableCell>
                <TableCell className="text-sm">
                  {server.game_version} ({server.loader})
                </TableCell>
                <TableCell className="text-sm">{formatMb(server.ram_mb)}</TableCell>
                <TableCell><StatusBadge status={server.status} /></TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7"
                    onClick={() => setMigrateTarget(server)}
                  >
                    Migrate
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

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
                      <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
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
  );
}
