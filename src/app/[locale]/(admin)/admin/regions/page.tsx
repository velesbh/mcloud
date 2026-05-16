"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Globe, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { LoadingSpinner } from "@/components/shared/MinecraftLoader";
import { PageLoader } from "@/components/shared/LoadingScreen";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { toast } from "sonner";
import type { Region } from "@/lib/supabase/types";

export default function RegionsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", description: "", flag_emoji: "🌐" });

  const { data: regions = [], isLoading } = useQuery<Region[]>({
    queryKey: ["regions"],
    queryFn: () => fetch("/api/regions").then((r) => r.json()),
  });

  async function createRegion() {
    setSaving(true);
    try {
      console.log("Creating region with form:", form);
      const res = await fetch("/api/regions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      console.log("Response status:", res.status, "ok:", res.ok, "content-type:", res.headers.get("content-type"));

      const text = await res.text();
      console.log("Response text (first 500 chars):", text.substring(0, 500));

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("Failed to parse JSON response:", e);
        toast.error(`Server error (${res.status}): ${text.substring(0, 200)}`);
        setSaving(false);
        return;
      }

      console.log("Response data:", data);
      if (res.ok) {
        console.log("Region created, invalidating queries");
        await qc.invalidateQueries({ queryKey: ["regions"] });
        toast.success("Region created");
        setOpen(false);
        setForm({ name: "", slug: "", description: "", flag_emoji: "🌐" });
      } else {
        console.error("Region creation failed:", data);
        toast.error(data.error || "Failed to create region");
      }
    } catch (err) {
      console.error("Region creation error:", err);
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRegion(id: string) {
    try {
      const res = await fetch(`/api/regions/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ["regions"] });
        toast.success("Region deleted");
        setDeleteTarget(null);
      } else {
        toast.error(data.error || "Failed to delete region");
      }
    } catch (err) {
      toast.error("Network error");
    }
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Regions"
        description="Geographic groupings of server nodes."
        action={
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Region
          </Button>
        }
      />

      {regions.length === 0 ? (
        <EmptyState title="No regions" icon={<Globe className="w-12 h-12 text-muted-foreground" />} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {regions.map((region) => (
            <Card key={region.id} className="p-4 flex items-center gap-3">
              <span className="text-3xl">{region.flag_emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{region.name}</p>
                <p className="text-xs text-muted-foreground">{region.slug}</p>
                {region.description && (
                  <p className="text-xs text-muted-foreground truncate">{region.description}</p>
                )}
              </div>
              <button
                onClick={() => setDeleteTarget(region.id)}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Region</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="US East" />
              </div>
              <div className="space-y-1">
                <Label>Slug</Label>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="us-east" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Flag Emoji</Label>
                <Input value={form.flag_emoji} onChange={(e) => setForm({ ...form, flag_emoji: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={createRegion} disabled={saving || !form.name || !form.slug} className="gap-2">
              {saving && <LoadingSpinner size={12} />}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete this region?"
        confirmLabel="Delete"
        onConfirm={() => deleteTarget ? deleteRegion(deleteTarget) : Promise.resolve()}
      />
    </div>
  );
}
