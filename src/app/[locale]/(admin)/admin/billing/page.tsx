"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Star, Link2, Info } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageLoader } from "@/components/shared/LoadingScreen";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { formatMb } from "@/lib/utils";
import type { BillingPlan } from "@/lib/supabase/types";

type FormState = {
  id?: string;
  plan_key: string;
  clerk_plan_id: string;
  name: string;
  description: string;
  monthly_price_usd: string;
  max_servers: string;
  max_ram_mb: string;
  max_disk_mb: string;
  max_cpu_percent: string;
  features: string;
  sort_order: string;
  is_visible: boolean;
  is_highlighted: boolean;
};

const empty: FormState = {
  plan_key: "",
  clerk_plan_id: "",
  name: "",
  description: "",
  monthly_price_usd: "",
  max_servers: "1",
  max_ram_mb: "2048",
  max_disk_mb: "10240",
  max_cpu_percent: "200",
  features: "",
  sort_order: "0",
  is_visible: true,
  is_highlighted: false,
};

function planToForm(p: BillingPlan): FormState {
  const features = Array.isArray(p.features)
    ? (p.features as string[]).join("\n")
    : "";
  return {
    id: p.id,
    plan_key: p.plan_key,
    clerk_plan_id: p.clerk_plan_id ?? "",
    name: p.name,
    description: p.description ?? "",
    monthly_price_usd: p.monthly_price_usd?.toString() ?? "",
    max_servers: p.max_servers.toString(),
    max_ram_mb: p.max_ram_mb.toString(),
    max_disk_mb: p.max_disk_mb.toString(),
    max_cpu_percent: p.max_cpu_percent.toString(),
    features,
    sort_order: p.sort_order.toString(),
    is_visible: p.is_visible,
    is_highlighted: p.is_highlighted,
  };
}

export default function AdminBillingPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<FormState | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: plans = [], isLoading } = useQuery<BillingPlan[]>({
    queryKey: ["billing-plans-admin"],
    queryFn: async () => {
      const res = await fetch("/api/billing/plans?all=1");
      if (!res.ok) return [];
      return res.json();
    },
  });

  async function savePlan() {
    if (!editing) return;
    setSaving(true);
    try {
      const payload = {
        plan_key: editing.plan_key.trim(),
        clerk_plan_id: editing.clerk_plan_id.trim() || null,
        name: editing.name.trim(),
        description: editing.description.trim() || null,
        monthly_price_usd: editing.monthly_price_usd
          ? Number(editing.monthly_price_usd)
          : null,
        max_servers: Number(editing.max_servers),
        max_ram_mb: Number(editing.max_ram_mb),
        max_disk_mb: Number(editing.max_disk_mb),
        max_cpu_percent: Number(editing.max_cpu_percent),
        features: editing.features
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        sort_order: Number(editing.sort_order),
        is_visible: editing.is_visible,
        is_highlighted: editing.is_highlighted,
      };

      const url = editing.id ? `/api/billing/plans/${editing.id}` : "/api/billing/plans";
      const method = editing.id ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast.error(err?.error?.formErrors?.[0] ?? "Save failed");
        return;
      }
      toast.success(editing.id ? "Plan updated" : "Plan created");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["billing-plans-admin"] });
      qc.invalidateQueries({ queryKey: ["billing-plans"] });
    } finally {
      setSaving(false);
    }
  }

  async function deletePlan() {
    if (!deletingId) return;
    const res = await fetch(`/api/billing/plans/${deletingId}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Delete failed");
      return;
    }
    toast.success("Plan deleted");
    setDeletingId(null);
    qc.invalidateQueries({ queryKey: ["billing-plans-admin"] });
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Billing Plans"
        description="Map Clerk plan keys to MCloud resource quotas. Only visible plans appear on the user upgrade page."
        action={
          <Button onClick={() => setEditing({ ...empty })} className="gap-2">
            <Plus className="w-4 h-4" />
            New Plan
          </Button>
        }
      />

      {/* Clerk "Public" vs MCloud is_visible explanation */}
      <div className="flex gap-3 rounded-md border border-blue-500/30 bg-blue-500/10 p-4 text-sm">
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-1 text-muted-foreground">
          <p className="font-medium text-foreground">Two separate visibility controls</p>
          <p>
            <span className="text-foreground font-mono">Clerk Dashboard → Billing → Plans → Public</span>
            {" "}— must be <strong>Public</strong> for self-service checkout to work. This does NOT expose
            the plan in any Clerk pricing table unless you render Clerk&apos;s{" "}
            <code className="text-xs">&lt;PricingTable /&gt;</code> component (MCloud doesn&apos;t).
          </p>
          <p>
            <span className="text-foreground font-mono">is_visible</span> (below)
            {" "}— controls whether the plan shows on MCloud&apos;s <code className="text-xs">/upgrade</code> page.
            Set to <strong>Hidden</strong> + share the secret link (🔗) for invite-only plans.
          </p>
          <p className="text-xs">
            TL;DR: set every plan to <strong>Public in Clerk</strong>, then use <strong>Hidden here</strong> to
            keep it off the public upgrade page.
          </p>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plan Key</TableHead>
              <TableHead>Clerk Plan ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>RAM</TableHead>
              <TableHead>Disk</TableHead>
              <TableHead>CPU</TableHead>
              <TableHead>Servers</TableHead>
              <TableHead>Visible</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-12">
                  No plans yet. Add a plan to expose it on the user upgrade page.
                </TableCell>
              </TableRow>
            ) : (
              plans.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.plan_key}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {p.clerk_plan_id ?? <span className="text-destructive/70">not set</span>}
                  </TableCell>
                  <TableCell className="font-medium text-sm flex items-center gap-1">
                    {p.name}
                    {p.is_highlighted && <Star className="w-3 h-3 fill-primary text-primary" />}
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.monthly_price_usd != null ? `$${p.monthly_price_usd}/mo` : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{formatMb(p.max_ram_mb)}</TableCell>
                  <TableCell className="text-sm">{formatMb(p.max_disk_mb)}</TableCell>
                  <TableCell className="text-sm">{p.max_cpu_percent}%</TableCell>
                  <TableCell className="text-sm">{p.max_servers}</TableCell>
                  <TableCell>
                    <Badge variant={p.is_visible ? "default" : "secondary"} className="text-[10px]">
                      {p.is_visible ? "Visible" : "Hidden"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground"
                        title="Copy secret checkout link"
                        onClick={() => {
                          const base = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
                          const url = `${base}/en/upgrade?plan=${encodeURIComponent(p.plan_key)}`;
                          navigator.clipboard.writeText(url);
                          toast.success("Secret checkout link copied!");
                        }}
                      >
                        <Link2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => setEditing(planToForm(p))}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => setDeletingId(p.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Plan" : "New Plan"}</DialogTitle>
            <DialogDescription>
              The plan key must match the Clerk plan slug exactly (e.g. <code className="text-xs">plus</code> or <code className="text-xs">pro</code>).
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Clerk plan key</Label>
                  <Input
                    placeholder="plus"
                    value={editing.plan_key}
                    onChange={(e) => setEditing({ ...editing, plan_key: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Display name</Label>
                  <Input
                    placeholder="Plus"
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Clerk Plan ID <span className="text-muted-foreground">(from Clerk Dashboard → Billing → Plans)</span></Label>
                <Input
                  placeholder="cplan_2abc123…"
                  value={editing.clerk_plan_id}
                  onChange={(e) => setEditing({ ...editing, clerk_plan_id: e.target.value })}
                />
                <p className="text-[11px] text-muted-foreground">
                  Required for checkout. Copy the opaque ID from your Clerk Billing dashboard, not the slug.
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Textarea
                  rows={2}
                  placeholder="For serious players who need more headroom."
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Price (USD/mo)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="9.99"
                    value={editing.monthly_price_usd}
                    onChange={(e) => setEditing({ ...editing, monthly_price_usd: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Sort order</Label>
                  <Input
                    type="number"
                    value={editing.sort_order}
                    onChange={(e) => setEditing({ ...editing, sort_order: e.target.value })}
                  />
                </div>
              </div>

              <div className="border-t pt-3">
                <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Quotas</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Max servers</Label>
                    <Input
                      type="number"
                      value={editing.max_servers}
                      onChange={(e) => setEditing({ ...editing, max_servers: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">RAM (MB)</Label>
                    <Input
                      type="number"
                      value={editing.max_ram_mb}
                      onChange={(e) => setEditing({ ...editing, max_ram_mb: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Disk (MB)</Label>
                    <Input
                      type="number"
                      value={editing.max_disk_mb}
                      onChange={(e) => setEditing({ ...editing, max_disk_mb: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">CPU (%)</Label>
                    <Input
                      type="number"
                      value={editing.max_cpu_percent}
                      onChange={(e) => setEditing({ ...editing, max_cpu_percent: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Feature list (one per line)</Label>
                <Textarea
                  rows={4}
                  placeholder={"Unlimited backups\nPriority support\nCustom domain"}
                  value={editing.features}
                  onChange={(e) => setEditing({ ...editing, features: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={editing.is_visible}
                    onChange={(e) => setEditing({ ...editing, is_visible: e.target.checked })}
                  />
                  Visible on upgrade page
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={editing.is_highlighted}
                    onChange={(e) => setEditing({ ...editing, is_highlighted: e.target.checked })}
                  />
                  Highlight as recommended
                </label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={savePlan} disabled={saving || !editing?.plan_key || !editing?.name}>
              {saving ? "Saving…" : editing?.id ? "Save changes" : "Create plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(o) => !o && setDeletingId(null)}
        title="Delete plan?"
        description="The plan will stop appearing on the upgrade page. Existing subscribers in Clerk are unaffected."
        confirmLabel="Delete"
        onConfirm={deletePlan}
      />
    </div>
  );
}
