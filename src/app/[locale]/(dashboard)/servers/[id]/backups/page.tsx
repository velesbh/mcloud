"use client";
import { use, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Plus, Archive, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { LoadingSpinner } from "@/components/shared/MinecraftLoader";
import { PageLoader } from "@/components/shared/LoadingScreen";
import { PageHeader } from "@/components/shared/PageHeader";
import { formatBytes, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import type { ServerBackup } from "@/lib/supabase/types";

export default function BackupsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [backupName, setBackupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

  const { data: backups = [], isLoading } = useQuery<ServerBackup[]>({
    queryKey: ["backups", id],
    queryFn: () => fetch(`/api/servers/${id}/backups`).then((r) => r.json()),
  });

  async function createBackup() {
    if (!backupName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/servers/${id}/backups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: backupName }),
      });
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ["backups", id] });
        toast.success("Backup created");
        setCreateOpen(false);
        setBackupName("");
      }
    } finally {
      setCreating(false);
    }
  }

  async function restoreBackup(backupId: string) {
    setRestoring(backupId);
    try {
      await fetch(`/api/servers/${id}/backups/${backupId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      });
      toast.success("Backup restored");
    } finally {
      setRestoring(null);
    }
  }

  async function deleteBackup(backupId: string) {
    await fetch(`/api/servers/${id}/backups/${backupId}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["backups", id] });
    toast.success("Backup deleted");
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Backups"
        description="Protect your server with regular backups."
        action={
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Create Backup
          </Button>
        }
      />

      {backups.length === 0 ? (
        <EmptyState
          title="No backups yet"
          description="Create a backup to protect your world."
          icon={<Archive className="w-12 h-12 text-muted-foreground" />}
          action={
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Create your first backup
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {backups.map((backup, i) => (
            <motion.div
              key={backup.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="p-4 flex items-center gap-4">
                <Archive className="w-8 h-8 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{backup.name}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>{formatBytes(backup.size_bytes)}</span>
                    <span>·</span>
                    <span>{formatDate(backup.created_at)}</span>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    backup.status === "available"
                      ? "text-green-500 border-green-500/30"
                      : "text-yellow-500 border-yellow-500/30"
                  }
                >
                  {backup.status}
                </Badge>
                <div className="flex items-center gap-2">
                  <motion.div whileTap={{ scale: 0.96 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => restoreBackup(backup.id)}
                      disabled={restoring === backup.id}
                    >
                      {restoring === backup.id ? (
                        <LoadingSpinner size={12} />
                      ) : (
                        <RotateCcw className="w-3.5 h-3.5" />
                      )}
                      Restore
                    </Button>
                  </motion.div>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    onClick={() => setDeleteTarget(backup.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </motion.button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create backup dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Backup</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Backup Name</Label>
              <Input
                value={backupName}
                onChange={(e) => setBackupName(e.target.value)}
                placeholder="Before big update"
                onKeyDown={(e) => e.key === "Enter" && createBackup()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createBackup} disabled={creating || !backupName.trim()} className="gap-2">
              {creating && <LoadingSpinner size={12} />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete this backup?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => deleteTarget ? deleteBackup(deleteTarget) : Promise.resolve()}
      />
    </div>
  );
}
