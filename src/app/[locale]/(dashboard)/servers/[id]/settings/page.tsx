"use client";
import { use, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, AlertTriangle, Info, Trash2 } from "lucide-react";
import { PixelPanel, PixelButton, PixelSlider } from "@/components/pixel/PixelPanel";
import { LoadingSpinner } from "@/components/shared/MinecraftLoader";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { MC_JAVA_VERSIONS, JAVA_LOADERS } from "@/lib/constants";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

function requiredJava(gameVersion: string | undefined | null): "8" | "17" | "21" {
  if (!gameVersion) return "21";
  const [maj, min] = gameVersion.split(".").map(Number);
  if (maj > 1 || (maj === 1 && min >= 21)) return "21";
  if (maj === 1 && min >= 17) return "17";
  return "8";
}

export default function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const router = useRouter();
  const locale = useLocale();
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", motd: "", max_players: 20,
    game_version: "1.21.4", loader: "paper" as string,
    ram_mb: 1024, cpu_percent: 100, disk_mb: 5120,
    startup_jar: "", java_version: "21",
  });

  const { data: server, isLoading, error: serverError } = useQuery({
    queryKey: ["server", id],
    queryFn: async () => {
      const r = await fetch(`/api/servers/${id}`);
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "Failed to load server");
      return json;
    },
  });

  useEffect(() => {
    if (server) {
      const ev = (server.env_vars as Record<string, unknown>) ?? {};
      setForm({
        name: server.name,
        motd: server.motd ?? "",
        max_players: server.max_players ?? 20,
        game_version: server.game_version,
        loader: server.loader,
        ram_mb: server.ram_mb ?? 1024,
        cpu_percent: server.cpu_percent ?? 100,
        disk_mb: server.disk_mb ?? 5120,
        startup_jar: (ev.startup_jar as string) ?? "",
        java_version: (ev.java_version as string) ?? "21",
      });
    }
  }, [server]);

  if (isLoading) return <div className="flex justify-center py-20"><LoadingSpinner size={28} /></div>;
  if (serverError || !server) return (
    <div className="py-20 text-center text-muted-foreground font-minecraft text-xs uppercase">
      {serverError ? (serverError as Error).message : "Server not found"}
    </div>
  );

  const changed = server.name !== form.name
    || (server.motd ?? "") !== form.motd
    || server.max_players !== form.max_players
    || server.game_version !== form.game_version
    || server.loader !== form.loader
    || (server.ram_mb ?? 1024) !== form.ram_mb
    || (server.cpu_percent ?? 100) !== form.cpu_percent
    || (server.disk_mb ?? 5120) !== form.disk_mb
    || ((server.env_vars as Record<string, unknown>)?.startup_jar ?? "") !== form.startup_jar
    || ((server.env_vars as Record<string, unknown>)?.java_version ?? "21") !== form.java_version;

  const versionChanged = server.game_version !== form.game_version;
  const loaderChanged = server.loader !== form.loader;
  const newJava = requiredJava(form.game_version);
  const oldJava = requiredJava(server.game_version);
  const javaChanged = oldJava !== newJava;
  const oldVer = parseFloat((server.game_version ?? "1.21").split(".").slice(0, 2).join("."));
  const newVer = parseFloat((form.game_version ?? "1.21").split(".").slice(0, 2).join("."));
  const downgrade = newVer < oldVer;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/servers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success("Settings saved — restart the server to apply");
        qc.invalidateQueries({ queryKey: ["server", id] });
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Failed to save");
      }
    } finally { setSaving(false); }
  }

  async function deleteServer() {
    const res = await fetch(`/api/servers/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Server deleted");
      router.push(`/${locale}/dashboard`);
    } else {
      toast.error("Failed to delete");
    }
  }

  return (
    <div className="space-y-4">
      {/* Basics */}
      <PixelPanel variant="stone" title="Basics" className="p-4 space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-minecraft uppercase text-muted-foreground">Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full px-3 py-2 text-sm bg-background border-2 border-border focus:border-primary outline-none"
              style={{ borderRadius: 0 }}
            />
          </div>
          <div>
            <label className="text-[10px] font-minecraft uppercase text-muted-foreground">Max Players</label>
            <input
              type="number" min={1} max={1000}
              value={form.max_players}
              onChange={(e) => setForm({ ...form, max_players: parseInt(e.target.value) || 1 })}
              className="mt-1 w-full px-3 py-2 text-sm font-mono bg-background border-2 border-border focus:border-primary outline-none"
              style={{ borderRadius: 0 }}
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-minecraft uppercase text-muted-foreground">MOTD</label>
          <input
            value={form.motd}
            onChange={(e) => setForm({ ...form, motd: e.target.value })}
            placeholder="A Minecraft Server"
            className="mt-1 w-full px-3 py-2 text-sm bg-background border-2 border-border focus:border-primary outline-none"
            style={{ borderRadius: 0 }}
          />
        </div>
      </PixelPanel>

      {/* Engine — version + loader */}
      <PixelPanel variant="stone" title="Engine" className="p-4 space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-minecraft uppercase text-muted-foreground">Game Version</label>
            <select
              value={form.game_version}
              onChange={(e) => setForm({ ...form, game_version: e.target.value })}
              className="mt-1 w-full px-3 py-2 text-sm font-mono bg-background border-2 border-border focus:border-primary outline-none"
              style={{ borderRadius: 0 }}
            >
              {MC_JAVA_VERSIONS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-minecraft uppercase text-muted-foreground">Loader</label>
            <select
              value={form.loader}
              onChange={(e) => setForm({ ...form, loader: e.target.value })}
              className="mt-1 w-full px-3 py-2 text-sm bg-background border-2 border-border focus:border-primary outline-none"
              style={{ borderRadius: 0 }}
            >
              {JAVA_LOADERS.map((l) => <option key={l.id} value={l.id}>{l.label} — {l.desc}</option>)}
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-minecraft uppercase text-muted-foreground">Startup JAR</label>
            <input
              value={form.startup_jar}
              onChange={(e) => setForm({ ...form, startup_jar: e.target.value })}
              placeholder="server.jar"
              className="mt-1 w-full px-3 py-2 text-sm font-mono bg-background border-2 border-border focus:border-primary outline-none"
              style={{ borderRadius: 0 }}
            />
            <p className="text-[10px] text-muted-foreground mt-1">Leave blank to use the default jar.</p>
          </div>
          <div>
            <label className="text-[10px] font-minecraft uppercase text-muted-foreground">Java Version</label>
            <select
              value={form.java_version}
              onChange={(e) => setForm({ ...form, java_version: e.target.value })}
              className="mt-1 w-full px-3 py-2 text-sm font-mono bg-background border-2 border-border focus:border-primary outline-none"
              style={{ borderRadius: 0 }}
            >
              {["8", "11", "17", "21", "24", "25"].map((v) => (
                <option key={v} value={v}>Java {v}</option>
              ))}
            </select>
            <p className="text-[10px] text-muted-foreground mt-1">Override auto-detected Java runtime.</p>
          </div>
        </div>

        <div
          className="text-xs px-3 py-2 flex items-start gap-2"
          style={{ background: "rgba(56,189,248,0.08)", border: "2px solid rgba(56,189,248,0.3)" }}
        >
          <Info className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
          <div>
            <span className="text-sky-400 font-minecraft text-[10px] uppercase">Java Runtime</span>
            <p className="text-muted-foreground mt-0.5">
              Java {newJava} required for {form.game_version}.
              {javaChanged && " The daemon will auto-install on next start."}
            </p>
          </div>
        </div>

        {downgrade && (
          <div
            className="text-xs px-3 py-2 flex items-start gap-2"
            style={{ background: "rgba(217,36,36,0.1)", border: "2px solid rgba(217,36,36,0.3)" }}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
            <div>
              <span className="text-destructive font-minecraft text-[10px] uppercase">Version Downgrade</span>
              <p className="text-muted-foreground mt-0.5">
                Downgrading from {server.game_version} → {form.game_version} can corrupt existing worlds. <strong>Back up your world first.</strong>
              </p>
            </div>
          </div>
        )}

        {loaderChanged && (
          <div
            className="text-xs px-3 py-2 flex items-start gap-2"
            style={{ background: "rgba(232,201,58,0.1)", border: "2px solid rgba(232,201,58,0.3)" }}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-amber-400 font-minecraft text-[10px] uppercase">Loader Change</span>
              <p className="text-muted-foreground mt-0.5">
                Switching {server.loader} → {form.loader} may break existing plugins / mods. The daemon will download the new server jar on next start.
              </p>
            </div>
          </div>
        )}

        {versionChanged && !downgrade && (
          <div
            className="text-xs px-3 py-2 flex items-start gap-2"
            style={{ background: "rgba(90,154,46,0.1)", border: "2px solid rgba(90,154,46,0.3)" }}
          >
            <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
            <p className="text-muted-foreground">
              Upgrading to {form.game_version}. Worlds will auto-migrate — back up first to be safe.
            </p>
          </div>
        )}
      </PixelPanel>

      {/* Resources */}
      <PixelPanel variant="stone" title="Resources" className="p-4 space-y-4">
        <PixelSlider
          label="RAM"
          value={form.ram_mb}
          min={512} max={32768} step={512}
          onChange={(v) => setForm({ ...form, ram_mb: v })}
          format={(v) => v >= 1024 ? `${(v / 1024).toFixed(v % 1024 === 0 ? 0 : 1)} GB` : `${v} MB`}
        />
        <PixelSlider
          label="CPU"
          value={form.cpu_percent}
          min={25} max={400} step={25}
          onChange={(v) => setForm({ ...form, cpu_percent: v })}
          format={(v) => v >= 100 ? `${(v / 100).toFixed(v % 100 === 0 ? 0 : 1)} cores` : `${v}%`}
        />
        <PixelSlider
          label="Disk"
          value={form.disk_mb}
          min={1024} max={102400} step={1024}
          onChange={(v) => setForm({ ...form, disk_mb: v })}
          format={(v) => v >= 1024 ? `${(v / 1024).toFixed(v % 1024 === 0 ? 0 : 1)} GB` : `${v} MB`}
        />
        <div
          className="text-xs px-3 py-2 flex items-start gap-2"
          style={{ background: "rgba(232,201,58,0.1)", border: "2px solid rgba(232,201,58,0.3)" }}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-muted-foreground">
            Changes apply on next server start. Ensure your node has enough headroom.
          </p>
        </div>
      </PixelPanel>

      {/* Save bar */}
      <div className="flex items-center gap-3">
        <PixelButton variant="green" size="lg" onClick={save} disabled={!changed || saving}>
          {saving ? <LoadingSpinner size={12} /> : <Save className="w-3.5 h-3.5" />}
          {saving ? "Saving..." : "Save Changes"}
        </PixelButton>
        {changed && (
          <span className="text-[10px] text-amber-400 font-minecraft">
            Restart server to apply
          </span>
        )}
      </div>

      {/* Danger zone */}
      <PixelPanel variant="dark" className="p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-minecraft text-[10px] uppercase text-destructive">Danger Zone</h3>
            <p className="text-xs text-muted-foreground mt-1">Permanently delete this server and all its data.</p>
          </div>
          <PixelButton variant="red" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="w-3.5 h-3.5" />
            Delete Server
          </PixelButton>
        </div>
      </PixelPanel>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete "${server.name}"?`}
        description="The server folder, world files, mods, and database row will all be permanently removed. This cannot be undone."
        confirmLabel="Delete Forever"
        onConfirm={deleteServer}
      />
    </div>
  );
}
