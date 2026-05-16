"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Network, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PageLoader } from "@/components/shared/LoadingScreen";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { UsageBar } from "@/components/shared/UsageBar";
import { toast } from "sonner";
import type { Node } from "@/lib/supabase/types";

export default function NodesPage() {
  const qc = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data: nodes = [], isLoading } = useQuery<(Node & { regions: any })[]>({
    queryKey: ["nodes"],
    queryFn: () => fetch("/api/nodes").then((r) => r.json()),
  });

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
