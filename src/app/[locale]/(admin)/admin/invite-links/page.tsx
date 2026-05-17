"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Copy, Link } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { LoadingSpinner } from "@/components/shared/MinecraftLoader";
import { PageLoader } from "@/components/shared/LoadingScreen";
import { PageHeader } from "@/components/shared/PageHeader";
import { toast } from "sonner";
import type { InviteLink } from "@/lib/supabase/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== "undefined" ? window.location.origin : "");

export default function InviteLinksPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    max_uses: 1,
    max_servers: 1,
    max_ram_mb: 1024,
    max_disk_mb: 5120,
    max_cpu_percent: 100,
    expires_at: "",
  });

  const { data: invites = [], isLoading } = useQuery<InviteLink[]>({
    queryKey: ["invite-links"],
    queryFn: async () => {
      const res = await fetch("/api/admin/invite-links");
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  function resetForm() {
    setForm({ max_uses: 1, max_servers: 1, max_ram_mb: 1024, max_disk_mb: 5120, max_cpu_percent: 100, expires_at: "" });
  }

  async function createInvite() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      if (!payload.expires_at) delete payload.expires_at;
      const res = await fetch("/api/admin/invite-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ["invite-links"] });
        toast.success("Invite link created");
        setOpen(false);
        resetForm();
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Failed to create invite link");
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteInvite(code: string) {
    const res = await fetch(`/api/admin/invite-links/${code}`, { method: "DELETE" });
    if (res.ok) {
      qc.invalidateQueries({ queryKey: ["invite-links"] });
      toast.success("Invite link deleted");
    } else {
      toast.error("Failed to delete invite link");
    }
    setDeleteTarget(null);
  }

  function copyLink(code: string) {
    const url = `${APP_URL}/invite/${code}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Link copied to clipboard");
    });
  }

  function formatQuota(invite: InviteLink) {
    const ram = invite.max_ram_mb >= 1024
      ? `${(invite.max_ram_mb / 1024).toFixed(invite.max_ram_mb % 1024 === 0 ? 0 : 1)}GB`
      : `${invite.max_ram_mb}MB`;
    const disk = invite.max_disk_mb >= 1024
      ? `${(invite.max_disk_mb / 1024).toFixed(invite.max_disk_mb % 1024 === 0 ? 0 : 1)}GB`
      : `${invite.max_disk_mb}MB`;
    return `${invite.max_servers} server(s) · ${ram} RAM · ${disk} disk · ${invite.max_cpu_percent}% CPU`;
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invite Links"
        description="Generate invite links that pre-configure new user quotas."
        action={
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            New Invite Link
          </Button>
        }
      />

      {invites.length === 0 ? (
        <Card className="py-12 text-center text-muted-foreground">
          No invite links created yet.
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Quota</TableHead>
                <TableHead>Uses</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((invite) => {
                const isExpired = invite.expires_at && new Date(invite.expires_at) < new Date();
                const isMaxed = invite.uses >= invite.max_uses;
                return (
                  <TableRow key={invite.id}>
                    <TableCell className="font-mono text-sm">
                      <div className="flex items-center gap-2">
                        <Link className="w-3.5 h-3.5 text-muted-foreground" />
                        {invite.code}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatQuota(invite)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={isMaxed ? "text-destructive border-destructive/30" : "text-muted-foreground"}
                      >
                        {invite.uses} / {invite.max_uses}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {invite.expires_at ? (
                        <span className={isExpired ? "text-destructive" : ""}>
                          {new Date(invite.expires_at).toLocaleDateString()}
                        </span>
                      ) : (
                        <span>Never</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(invite.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => copyLink(invite.code)}
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                          title="Copy invite link"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(invite.code)}
                          className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                          title="Delete invite link"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* New Invite Link Dialog */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Invite Link</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1">
              <Label>Max uses</Label>
              <Input
                type="number"
                min={1}
                value={form.max_uses}
                onChange={(e) => setForm({ ...form, max_uses: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="space-y-1">
              <Label>Max servers</Label>
              <Input
                type="number"
                min={1}
                value={form.max_servers}
                onChange={(e) => setForm({ ...form, max_servers: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Max RAM (MB)</Label>
                <Input
                  type="number"
                  min={512}
                  step={512}
                  value={form.max_ram_mb}
                  onChange={(e) => setForm({ ...form, max_ram_mb: parseInt(e.target.value) || 1024 })}
                />
              </div>
              <div className="space-y-1">
                <Label>Max Disk (MB)</Label>
                <Input
                  type="number"
                  min={1024}
                  step={1024}
                  value={form.max_disk_mb}
                  onChange={(e) => setForm({ ...form, max_disk_mb: parseInt(e.target.value) || 5120 })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Max CPU %</Label>
              <Input
                type="number"
                min={10}
                max={1000}
                step={10}
                value={form.max_cpu_percent}
                onChange={(e) => setForm({ ...form, max_cpu_percent: parseInt(e.target.value) || 100 })}
              />
            </div>
            <div className="space-y-1">
              <Label>Expires at (optional)</Label>
              <Input
                type="datetime-local"
                value={form.expires_at}
                onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={createInvite} disabled={saving} className="gap-2">
              {saving && <LoadingSpinner size={12} />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete this invite link?"
        description="Anyone with this link will no longer be able to use it."
        confirmLabel="Delete"
        onConfirm={() => deleteTarget ? deleteInvite(deleteTarget) : Promise.resolve()}
      />
    </div>
  );
}
