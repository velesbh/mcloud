"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings2 } from "lucide-react";
import { PageLoader } from "@/components/shared/LoadingScreen";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import type { Profile } from "@/lib/supabase/types";

type UserRow = Profile & { server_count: number };

/** Preset billing plans — apply all quotas at once */
const PLANS: Record<string, {
  label: string;
  color: string;
  max_servers: number;
  max_ram_mb: number;
  max_disk_mb: number;
  max_cpu_percent: number;
  max_allocations: number;
}> = {
  free: {
    label: "Free",
    color: "text-muted-foreground",
    max_servers: 1,
    max_ram_mb: 1024,
    max_disk_mb: 5120,
    max_cpu_percent: 100,
    max_allocations: 1,
  },
  basic: {
    label: "Basic",
    color: "text-blue-500",
    max_servers: 3,
    max_ram_mb: 4096,
    max_disk_mb: 20480,
    max_cpu_percent: 200,
    max_allocations: 3,
  },
  pro: {
    label: "Pro",
    color: "text-primary",
    max_servers: 10,
    max_ram_mb: 16384,
    max_disk_mb: 102400,
    max_cpu_percent: 400,
    max_allocations: 10,
  },
  enterprise: {
    label: "Enterprise",
    color: "text-amber-500",
    max_servers: 50,
    max_ram_mb: 65536,
    max_disk_mb: 524288,
    max_cpu_percent: 1600,
    max_allocations: 50,
  },
};

interface QuotaForm {
  plan_tier: string;
  max_servers: number;
  max_ram_mb: number;
  max_disk_mb: number;
  max_cpu_percent: number;
  max_allocations: number;
  role: string;
}

function QuotaDialog({
  user,
  onClose,
}: {
  user: UserRow;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<QuotaForm>({
    plan_tier: user.plan_tier ?? "free",
    max_servers: (user as any).max_servers ?? 1,
    max_ram_mb: (user as any).max_ram_mb ?? 1024,
    max_disk_mb: (user as any).max_disk_mb ?? 5120,
    max_cpu_percent: (user as any).max_cpu_percent ?? 100,
    max_allocations: (user as any).max_allocations ?? 1,
    role: user.role,
  });

  function applyPlan(planKey: string) {
    const plan = PLANS[planKey];
    if (!plan) return;
    setForm((f) => ({
      ...f,
      plan_tier: planKey,
      max_servers: plan.max_servers,
      max_ram_mb: plan.max_ram_mb,
      max_disk_mb: plan.max_disk_mb,
      max_cpu_percent: plan.max_cpu_percent,
      max_allocations: plan.max_allocations,
    }));
  }

  function num(key: keyof QuotaForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: parseInt(e.target.value) || 0 }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/quotas`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ["admin-users"] });
        toast.success(`${user.email} updated`);
        onClose();
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Failed to update");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Quotas — {user.email}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Plan preset picker */}
          <div className="space-y-1.5">
            <Label>Billing Plan (preset)</Label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(PLANS).map(([key, p]) => (
                <button
                  key={key}
                  onClick={() => applyPlan(key)}
                  className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                    form.plan_tier === key
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border hover:border-foreground/30"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Selecting a plan auto-fills the fields below. You can still adjust individually.
            </p>
          </div>

          <Separator />

          {/* Individual quota fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Max Servers</Label>
              <Input type="number" min={0} value={form.max_servers} onChange={num("max_servers")} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max Allocations (ports)</Label>
              <Input type="number" min={0} value={form.max_allocations} onChange={num("max_allocations")} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max RAM (MB)</Label>
              <Input type="number" min={0} step={512} value={form.max_ram_mb} onChange={num("max_ram_mb")} className="h-8 text-sm" />
              <p className="text-[10px] text-muted-foreground">{(form.max_ram_mb / 1024).toFixed(1)} GB</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max Disk (MB)</Label>
              <Input type="number" min={0} step={1024} value={form.max_disk_mb} onChange={num("max_disk_mb")} className="h-8 text-sm" />
              <p className="text-[10px] text-muted-foreground">{(form.max_disk_mb / 1024).toFixed(1)} GB</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max CPU (%)</Label>
              <Input type="number" min={0} step={100} value={form.max_cpu_percent} onChange={num("max_cpu_percent")} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function UsersPage() {
  const { data: users = [], isLoading } = useQuery<UserRow[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data;
    },
  });
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <PageHeader title="Users" description={`${users.length} registered users`} />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Servers</TableHead>
              <TableHead>Limits</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const planInfo = PLANS[user.plan_tier] ?? PLANS.free;
              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium text-sm">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${planInfo.color}`}>
                      {planInfo.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={user.role === "admin" ? "text-primary border-primary/30 text-xs" : "text-xs"}
                    >
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {user.server_count} / {(user as any).max_servers ?? 1}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {((user as any).max_ram_mb ?? 1024) / 1024}GB RAM ·{" "}
                    {(user as any).max_allocations ?? 1} port{(user as any).max_allocations !== 1 ? "s" : ""}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(user.created_at)}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => setEditingUser(user)}
                      className="text-muted-foreground hover:text-foreground transition-colors p-1"
                      title="Edit quotas"
                    >
                      <Settings2 className="w-4 h-4" />
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {editingUser && (
        <QuotaDialog user={editingUser} onClose={() => setEditingUser(null)} />
      )}
    </div>
  );
}
