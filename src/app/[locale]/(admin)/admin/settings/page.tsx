"use client";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageLoader } from "@/components/shared/LoadingScreen";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PixelSlider } from "@/components/pixel/PixelPanel";

export default function AdminSettingsPage() {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [localPercent, setLocalPercent] = useState<number | null>(null);

  const { data: settings, isLoading } = useQuery<Record<string, unknown>>({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) return {};
      return (await res.json()) as Record<string, unknown>;
    },
  });

  // Initialise local state once settings have loaded (don't overwrite user edits)
  useEffect(() => {
    if (settings && localPercent === null) {
      setLocalPercent(Number(settings.premium_allocation_percent ?? 0));
    }
  }, [settings, localPercent]);

  const currentPercent = localPercent ?? Number(settings?.premium_allocation_percent ?? 0);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([
          { key: "premium_allocation_percent", value: currentPercent },
        ]),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null) as { error?: string } | null;
        toast.error(err?.error ?? "Save failed");
        return;
      }
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Settings"
        description="Global configuration for resource allocation and platform behaviour."
      />

      <Card className="p-6 space-y-6">
        {/* ── Premium Allocation ────────────────────────────────────── */}
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Premium Allocation</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Reserve this % of each node&apos;s resources for premium users. Free users cannot claim
              resources that would dip below this threshold.
            </p>
          </div>

          <PixelSlider
            label="Premium reserved %"
            value={currentPercent}
            min={0}
            max={80}
            step={5}
            format={(v) => `${v}%`}
            onChange={(v) => setLocalPercent(v)}
          />

          <div className="flex items-center gap-3">
            <Button
              onClick={handleSave}
              disabled={saving}
              size="sm"
            >
              {saving ? "Saving…" : "Save settings"}
            </Button>
            {currentPercent > 0 ? (
              <p className="text-xs text-muted-foreground">
                {currentPercent}% of each node&apos;s capacity is held for premium users
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                No resources are reserved — all users can use the full node capacity
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
