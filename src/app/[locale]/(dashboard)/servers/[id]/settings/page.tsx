"use client";
import { use } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { LoadingSpinner } from "@/components/shared/MinecraftLoader";
import { PageLoader } from "@/components/shared/LoadingScreen";
import { updateServerSchema, type UpdateServerInput } from "@/lib/validations/server";
import { FREE_TIER } from "@/lib/constants";
import { toast } from "sonner";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";

export default function SettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const locale = useLocale();
  const router = useRouter();
  const qc = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: server, isLoading } = useQuery({
    queryKey: ["server", id],
    queryFn: () => fetch(`/api/servers/${id}`).then((r) => r.json()),
  });

  const form = useForm<UpdateServerInput>({
    resolver: zodResolver(updateServerSchema),
    values: server
      ? {
          name: server.name,
          motd: server.motd ?? "",
          max_players: server.max_players,
          ram_mb: server.ram_mb,
          cpu_percent: server.cpu_percent,
          java_flags: server.java_flags ?? "",
        }
      : undefined,
  });

  if (isLoading || !server) return <PageLoader />;

  async function onSubmit(data: UpdateServerInput) {
    setSaving(true);
    try {
      const res = await fetch(`/api/servers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ["server", id] });
        toast.success("Settings saved");
      } else {
        toast.error("Failed to save settings");
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteServer() {
    await fetch(`/api/servers/${id}`, { method: "DELETE" });
    router.push(`/${locale}`);
    toast.success("Server deleted");
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl space-y-6"
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card className="p-5 space-y-5">
          <h3 className="font-semibold">General</h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Server Name</Label>
              <Input {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Max Players</Label>
              <Input
                type="number"
                {...form.register("max_players", { valueAsNumber: true })}
                min={1}
                max={1000}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Message of the Day (MOTD)</Label>
            <Input {...form.register("motd")} placeholder="A Minecraft Server" />
          </div>
        </Card>

        <Card className="p-5 space-y-5">
          <h3 className="font-semibold">Resources</h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>RAM (MB)</Label>
              <Input
                type="number"
                {...form.register("ram_mb", { valueAsNumber: true })}
                min={512}
                max={FREE_TIER.RAM_MB}
              />
              <p className="text-xs text-muted-foreground">
                Max on free tier: {FREE_TIER.RAM_MB}MB
              </p>
            </div>
            <div className="space-y-2">
              <Label>CPU Limit (%)</Label>
              <Input
                type="number"
                {...form.register("cpu_percent", { valueAsNumber: true })}
                min={10}
                max={FREE_TIER.CPU_PERCENT}
              />
            </div>
          </div>

          {server.edition === "java" && (
            <div className="space-y-2">
              <Label>Java Flags</Label>
              <Textarea
                {...form.register("java_flags")}
                placeholder="-XX:+UseG1GC -XX:MaxGCPauseMillis=50"
                className="font-mono text-sm"
                rows={2}
              />
            </div>
          )}
        </Card>

        <div className="flex justify-end">
          <motion.div whileTap={{ scale: 0.96 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving && <LoadingSpinner size={14} />}
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </motion.div>
        </div>
      </form>

      <Separator />

      <Card className="p-5 border-destructive/30">
        <h3 className="font-semibold text-destructive mb-2">Danger Zone</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Permanently delete this server and all its data.
        </p>
        <Button
          variant="destructive"
          onClick={() => setDeleteOpen(true)}
          className="gap-2"
        >
          Delete Server
        </Button>
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this server?"
        description="This action cannot be undone. All files, backups, and data will be permanently deleted."
        confirmLabel="Delete Server"
        onConfirm={deleteServer}
      />
    </motion.div>
  );
}
