"use client";
import { use, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, Download, Link2, Trash2, Check, Pencil, Upload } from "lucide-react";
import { PixelPanel, PixelButton } from "@/components/pixel/PixelPanel";
import { GrassBlock } from "@/components/pixel/Block";
import { LoadingSpinner } from "@/components/shared/MinecraftLoader";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { formatBytes } from "@/lib/utils";
import { toast } from "sonner";

interface World {
  name: string;
  size_bytes: number;
  modified_at: string | null;
  active: boolean;
  has_level_dat: boolean;
}

async function call(serverId: string, op: string, args: Record<string, unknown> = {}) {
  const res = await fetch(`/api/servers/${serverId}/worlds`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op, ...args }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(e.error ?? "Operation failed");
  }
  return res.json();
}

export default function WorldsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const [importOpen, setImportOpen] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importName, setImportName] = useState("");
  const [renameTarget, setRenameTarget] = useState<World | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<World | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, refetch } = useQuery<{ worlds: World[]; active: string }>({
    queryKey: ["worlds", id],
    queryFn: () => fetch(`/api/servers/${id}/worlds`).then((r) => r.json()),
  });

  async function setActive(w: World) {
    setBusy(`Activating ${w.name}...`);
    try {
      await call(id, "set-active", { name: w.name });
      toast.success(`${w.name} is now the active world (restart to take effect)`);
      qc.invalidateQueries({ queryKey: ["worlds", id] });
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  }

  async function downloadWorld(w: World) {
    setBusy(`Zipping ${w.name}...`);
    try {
      const data = await call(id, "export", { name: w.name });
      if (data.url) {
        const a = document.createElement("a");
        a.href = data.url; a.download = data.filename || `${w.name}.zip`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        toast.success("Download started");
      }
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  }

  async function importWorld() {
    if (!importUrl.trim()) return;
    setBusy(`Downloading ${importName || "world"}...`);
    try {
      const data = await call(id, "import-url", {
        url: importUrl,
        name: importName.trim() || undefined,
      });
      toast.success(`Imported as "${data.worldName}"`);
      setImportOpen(false); setImportUrl(""); setImportName("");
      await refetch();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  }

  async function renameWorld() {
    if (!renameTarget || !renameValue.trim()) return;
    try {
      await call(id, "rename", { oldName: renameTarget.name, newName: renameValue.trim() });
      toast.success("Renamed");
      setRenameTarget(null); setRenameValue("");
      await refetch();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function deleteWorld(w: World) {
    try {
      await call(id, "delete", { name: w.name });
      toast.success("World deleted");
      await refetch();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function uploadWorld(files: FileList | null) {
    if (!files?.length) return;
    const file = files[0];
    if (!file.name.toLowerCase().endsWith(".zip")) {
      toast.error("Only .zip files are supported");
      return;
    }
    setBusy(`Uploading ${file.name}...`);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/servers/${id}/worlds/upload`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      toast.success(`Imported as "${data.worldName}"`);
      await refetch();
    } catch (e) { toast.error((e as Error).message); }
    finally {
      setBusy(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (isLoading) return (
    <div className="flex justify-center py-20"><LoadingSpinner size={28} /></div>
  );

  return (
    <div
      className="space-y-4 relative min-h-[calc(100vh-220px)] p-1"
      style={{
        // Minecraft map item as backdrop — stretched, dimmed, pixelated
        backgroundImage: `url("https://ccvaults.com/assets/75.$%20GUI/map_background.png")`,
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        imageRendering: "pixelated",
        backgroundColor: "rgba(0,0,0,0.5)",
        backgroundBlendMode: "multiply",
      }}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={(e) => uploadWorld(e.target.files)}
      />

      <PixelPanel variant="dark" className="p-4 backdrop-blur-sm">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <GrassBlock size={36} />
            <div>
              <h2 className="font-minecraft text-[12px] uppercase">Worlds</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {data?.worlds.length ?? 0} world{(data?.worlds.length ?? 0) === 1 ? "" : "s"} ·
                {" "}Active: <span className="text-primary font-mono">{data?.active}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PixelButton variant="green" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-3.5 h-3.5" />
              Upload .zip
            </PixelButton>
            <PixelButton onClick={() => setImportOpen(true)}>
              <Link2 className="w-3.5 h-3.5" />
              From URL
            </PixelButton>
          </div>
        </div>
        {busy && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-400 font-minecraft">
            <LoadingSpinner size={12} /> {busy}
          </div>
        )}
      </PixelPanel>

      {(data?.worlds.length ?? 0) === 0 ? (
        <PixelPanel variant="stone" className="p-12 text-center">
          <Globe className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-minecraft text-xs uppercase text-muted-foreground">No worlds yet</p>
          <p className="text-xs text-muted-foreground mt-1">Start the server to generate one, or import a .zip from a URL.</p>
        </PixelPanel>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data!.worlds.map((w) => (
            <PixelPanel
              key={w.name}
              variant={w.active ? "ore" : "stone"}
              className="p-4 space-y-3"
            >
              <div className="flex items-start gap-3">
                <GrassBlock size={32} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-minecraft text-[11px] truncate">{w.name}</span>
                    {w.active && (
                      <span className="text-[9px] font-minecraft uppercase px-1.5 py-0.5 text-primary border border-primary/40">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                    {formatBytes(w.size_bytes)}
                    {w.has_level_dat ? "" : " · no level.dat"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {!w.active && (
                  <PixelButton size="sm" variant="green" onClick={() => setActive(w)}>
                    <Check className="w-3 h-3" />
                    Set Active
                  </PixelButton>
                )}
                <PixelButton size="sm" onClick={() => downloadWorld(w)}>
                  <Download className="w-3 h-3" />
                  Download
                </PixelButton>
                <PixelButton size="sm" onClick={() => { setRenameTarget(w); setRenameValue(w.name); }}>
                  <Pencil className="w-3 h-3" />
                  Rename
                </PixelButton>
                <PixelButton size="sm" variant="red" onClick={() => setDeleteTarget(w)}>
                  <Trash2 className="w-3 h-3" />
                  Delete
                </PixelButton>
              </div>
            </PixelPanel>
          ))}
        </div>
      )}

      {/* Import modal */}
      {importOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setImportOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
            <PixelPanel variant="stone" title="Import World from URL" icon={<Link2 className="w-3 h-3" />} className="p-4">
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-minecraft uppercase text-muted-foreground">World .zip URL</label>
                  <input
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    placeholder="https://example.com/my-world.zip"
                    className="w-full mt-1 px-3 py-2 text-sm font-mono bg-background border-2 border-border focus:border-primary outline-none"
                    style={{ borderRadius: 0 }}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-[10px] font-minecraft uppercase text-muted-foreground">Name (optional)</label>
                  <input
                    value={importName}
                    onChange={(e) => setImportName(e.target.value)}
                    placeholder="leave blank to auto-detect"
                    className="w-full mt-1 px-3 py-2 text-sm font-mono bg-background border-2 border-border focus:border-primary outline-none"
                    style={{ borderRadius: 0 }}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <PixelButton variant="ghost" onClick={() => setImportOpen(false)}>Cancel</PixelButton>
                  <PixelButton variant="green" onClick={importWorld} disabled={!importUrl.trim()}>Download</PixelButton>
                </div>
              </div>
            </PixelPanel>
          </div>
        </div>
      )}

      {/* Rename modal */}
      {renameTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setRenameTarget(null)}
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm">
            <PixelPanel variant="stone" title="Rename World" icon={<Pencil className="w-3 h-3" />} className="p-4">
              <div className="space-y-3">
                <input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-background border-2 border-border focus:border-primary outline-none"
                  style={{ borderRadius: 0 }}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && renameWorld()}
                />
                <div className="flex justify-end gap-2">
                  <PixelButton variant="ghost" onClick={() => setRenameTarget(null)}>Cancel</PixelButton>
                  <PixelButton variant="green" onClick={renameWorld}>Rename</PixelButton>
                </div>
              </div>
            </PixelPanel>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Delete world "${deleteTarget?.name}"?`}
        description="The entire world folder will be removed. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => deleteTarget ? deleteWorld(deleteTarget) : Promise.resolve()}
      />
    </div>
  );
}
