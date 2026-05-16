"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Folder, FolderOpen, FileText, File as FileIcon, Trash2, Plus, Upload, Download,
  Link2, FilePlus, ChevronRight, FileArchive, Save, ArrowLeft, Pencil,
} from "lucide-react";
import { PixelPanel, PixelButton } from "@/components/pixel/PixelPanel";
import { LoadingSpinner } from "@/components/shared/MinecraftLoader";
import { cn, formatBytes } from "@/lib/utils";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

interface FsItem {
  name: string;
  path: string;
  is_directory: boolean;
  size_bytes: number;
  modified_at: string | null;
}

const TEXT_EXTS = [".properties", ".txt", ".yml", ".yaml", ".json", ".toml", ".cfg", ".conf", ".log", ".sh", ".xml", ".md"];
const isTextFile = (name: string) => TEXT_EXTS.some((ext) => name.toLowerCase().endsWith(ext));

async function callFs(serverId: string, op: string, args: Record<string, unknown> = {}) {
  const res = await fetch(`/api/servers/${serverId}/fs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op, ...args }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Operation failed");
  }
  return res.json();
}

export function FileManagerV2({ serverId }: { serverId: string }) {
  const [cwd, setCwd] = useState("/");
  const [items, setItems] = useState<FsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<FsItem | null>(null);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [renameTarget, setRenameTarget] = useState<FsItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<FsItem | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callFs(serverId, "list", { path: cwd });
      setItems(data.items ?? []);
    } catch (e) {
      toast.error(`Could not list files: ${(e as Error).message}`);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [serverId, cwd]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function openItem(item: FsItem) {
    if (item.is_directory) {
      setCwd(item.path);
      setSelected(null);
      return;
    }
    setSelected(item);
    if (!isTextFile(item.name)) {
      setContent("# Binary file — cannot display. Use Download instead.");
      return;
    }
    setContent("# Loading...");
    try {
      const data = await callFs(serverId, "read", { path: item.path });
      setContent(data.content ?? "");
    } catch (e) {
      setContent(`# Error: ${(e as Error).message}`);
    }
  }

  async function saveFile() {
    if (!selected) return;
    setSaving(true);
    try {
      await callFs(serverId, "write", { path: selected.path, content });
      toast.success("Saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(`Uploading ${files.length} file${files.length > 1 ? "s" : ""}...`);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("targetDir", cwd);
        const res = await fetch(`/api/servers/${serverId}/fs/upload`, { method: "POST", body: fd });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(err.error ?? "Upload failed");
        }
      }
      toast.success(`Uploaded ${files.length} file${files.length > 1 ? "s" : ""}`);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleUrlImport() {
    if (!urlValue.trim()) return;
    const filename = urlValue.split("/").pop()?.split("?")[0] || "download";
    const safe = filename.replace(/[^\w.\-]/g, "_");
    const targetPath = cwd.replace(/\/+$/, "") + "/" + safe;
    setBusy(`Downloading ${safe}...`);
    try {
      await callFs(serverId, "import-url", { url: urlValue, targetPath });
      toast.success(`${safe} downloaded`);
      setUrlOpen(false);
      setUrlValue("");
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function handleExport(item: FsItem) {
    setBusy(`Preparing ${item.name}${item.is_directory ? " (zipping)" : ""}...`);
    try {
      const data = await callFs(serverId, "export", { path: item.path });
      if (data.url) {
        // Trigger browser download
        const a = document.createElement("a");
        a.href = data.url as string;
        a.download = (data.filename as string) || item.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success(`Downloading ${data.filename}`);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function handleZip(item: FsItem) {
    const archive = cwd.replace(/\/+$/, "") + "/" + item.name + ".zip";
    setBusy(`Zipping ${item.name}...`);
    try {
      await callFs(serverId, "zip", { sourcePath: item.path, archivePath: archive });
      toast.success(`${item.name}.zip created`);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(null); }
  }

  async function handleUnzip(item: FsItem) {
    setBusy(`Unzipping ${item.name}...`);
    try {
      await callFs(serverId, "unzip", { archivePath: item.path, targetDir: cwd });
      toast.success(`Extracted ${item.name}`);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(null); }
  }

  async function createFolder() {
    if (!newName.trim()) return;
    const safe = newName.trim().replace(/[^\w.\-]/g, "_");
    const target = cwd.replace(/\/+$/, "") + "/" + safe;
    try {
      await callFs(serverId, "mkdir", { path: target });
      toast.success("Folder created");
      setNewFolderOpen(false); setNewName("");
      await refresh();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function renameItem() {
    if (!renameTarget || !renameValue.trim()) return;
    const safe = renameValue.trim().replace(/[^\w.\-]/g, "_");
    const parent = renameTarget.path.split("/").slice(0, -1).join("/") || "/";
    const newPath = parent.replace(/\/+$/, "") + "/" + safe;
    try {
      await callFs(serverId, "rename", { oldPath: renameTarget.path, newPath });
      toast.success("Renamed");
      setRenameTarget(null); setRenameValue("");
      await refresh();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function deleteItem(item: FsItem) {
    try {
      await callFs(serverId, "delete", { path: item.path });
      toast.success("Deleted");
      if (selected?.path === item.path) setSelected(null);
      await refresh();
    } catch (e) { toast.error((e as Error).message); }
  }

  function navUp() {
    if (cwd === "/") return;
    const parts = cwd.split("/").filter(Boolean);
    parts.pop();
    setCwd(parts.length === 0 ? "/" : "/" + parts.join("/"));
    setSelected(null);
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <PixelPanel variant="dark" className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <PixelButton size="sm" onClick={navUp} disabled={cwd === "/"}>
            <ArrowLeft className="w-3 h-3" />
            Up
          </PixelButton>
          <div
            className="px-3 py-1 font-mono text-xs flex-1 min-w-[200px]"
            style={{ background: "rgba(0,0,0,0.4)", border: "2px solid #3a3a3a" }}
          >
            <span className="text-muted-foreground">📁</span> {cwd}
          </div>
          <PixelButton size="sm" variant="green" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-3 h-3" />
            Upload
          </PixelButton>
          <PixelButton size="sm" onClick={() => setUrlOpen(true)}>
            <Link2 className="w-3 h-3" />
            From URL
          </PixelButton>
          <PixelButton size="sm" onClick={() => setNewFolderOpen(true)}>
            <Plus className="w-3 h-3" />
            New Folder
          </PixelButton>
          <PixelButton size="sm" onClick={refresh}>
            <FilePlus className="w-3 h-3" />
            Refresh
          </PixelButton>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
        </div>
        {busy && (
          <div className="mt-2 flex items-center gap-2 text-xs text-amber-400 font-minecraft">
            <LoadingSpinner size={12} /> {busy}
          </div>
        )}
      </PixelPanel>

      {/* Main grid: file list + editor */}
      <div className="grid gap-3 lg:grid-cols-[minmax(280px,360px)_1fr]">
        {/* Files list */}
        <PixelPanel variant="stone" title="Files" icon={<Folder className="w-3 h-3" />} className="overflow-hidden">
          <div className="max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center"><LoadingSpinner size={20} /></div>
            ) : items.length === 0 ? (
              <p className="p-6 text-center text-xs text-muted-foreground font-minecraft">
                Empty directory
              </p>
            ) : (
              items.map((item) => (
                <div
                  key={item.path}
                  className={cn(
                    "group flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer border-b border-border/30",
                    selected?.path === item.path
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-accent text-foreground"
                  )}
                  onClick={() => openItem(item)}
                >
                  {item.is_directory ? (
                    <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                  ) : isTextFile(item.name) ? (
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  ) : item.name.endsWith(".zip") || item.name.endsWith(".jar") ? (
                    <FileArchive className="w-4 h-4 text-muted-foreground shrink-0" />
                  ) : (
                    <FileIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="flex-1 truncate text-xs">{item.name}</span>
                  {!item.is_directory && (
                    <span className="text-[10px] text-muted-foreground hidden group-hover:inline">
                      {formatBytes(item.size_bytes)}
                    </span>
                  )}
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleExport(item); }}
                      title="Download"
                      className="p-0.5 text-muted-foreground hover:text-primary"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                    {item.name.endsWith(".zip") ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleUnzip(item); }}
                        title="Unzip"
                        className="p-0.5 text-muted-foreground hover:text-primary"
                      >
                        <FolderOpen className="w-3 h-3" />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleZip(item); }}
                        title="Zip"
                        className="p-0.5 text-muted-foreground hover:text-primary"
                      >
                        <FileArchive className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setRenameTarget(item); setRenameValue(item.name); }}
                      title="Rename"
                      className="p-0.5 text-muted-foreground hover:text-primary"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(item); }}
                      title="Delete"
                      className="p-0.5 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </PixelPanel>

        {/* Editor */}
        <PixelPanel variant="stone" className="overflow-hidden flex flex-col">
          {selected ? (
            <>
              <div className="flex items-center gap-2 px-3 py-2 border-b-2 border-border">
                <FileText className="w-3.5 h-3.5 text-primary" />
                <code className="text-xs font-mono flex-1 truncate">{selected.path}</code>
                <PixelButton size="sm" variant="green" onClick={saveFile} disabled={saving || !isTextFile(selected.name)}>
                  {saving ? <LoadingSpinner size={10} /> : <Save className="w-3 h-3" />}
                  {saving ? "Saving" : "Save"}
                </PixelButton>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                spellCheck={false}
                className="flex-1 min-h-[400px] p-3 font-mono text-xs bg-background text-foreground border-0 resize-none focus:outline-none"
              />
            </>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="font-minecraft text-xs uppercase">Select a file to edit</p>
            </div>
          )}
        </PixelPanel>
      </div>

      {/* URL import dialog */}
      {urlOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setUrlOpen(false)}
        >
          <PixelPanel variant="stone" title="Download from URL" icon={<Link2 className="w-3 h-3" />} className="w-full max-w-md p-4" >
            <div onClick={(e) => e.stopPropagation()} className="space-y-3">
              <input
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                placeholder="https://example.com/world.zip"
                className="w-full px-3 py-2 text-sm font-mono bg-background border-2 border-border focus:border-primary outline-none"
                style={{ borderRadius: 0 }}
                autoFocus
              />
              <p className="text-[10px] text-muted-foreground font-minecraft">
                Saves into <code className="text-foreground">{cwd}</code>
              </p>
              <div className="flex justify-end gap-2">
                <PixelButton variant="ghost" onClick={() => setUrlOpen(false)}>Cancel</PixelButton>
                <PixelButton variant="green" onClick={handleUrlImport} disabled={!urlValue.trim()}>Download</PixelButton>
              </div>
            </div>
          </PixelPanel>
        </div>
      )}

      {/* New folder dialog */}
      {newFolderOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setNewFolderOpen(false)}
        >
          <PixelPanel variant="stone" title="New Folder" icon={<Folder className="w-3 h-3" />} className="w-full max-w-sm p-4">
            <div onClick={(e) => e.stopPropagation()} className="space-y-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="folder-name"
                className="w-full px-3 py-2 text-sm font-mono bg-background border-2 border-border focus:border-primary outline-none"
                style={{ borderRadius: 0 }}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && createFolder()}
              />
              <div className="flex justify-end gap-2">
                <PixelButton variant="ghost" onClick={() => setNewFolderOpen(false)}>Cancel</PixelButton>
                <PixelButton variant="green" onClick={createFolder}>Create</PixelButton>
              </div>
            </div>
          </PixelPanel>
        </div>
      )}

      {/* Rename dialog */}
      {renameTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setRenameTarget(null)}
        >
          <PixelPanel variant="stone" title="Rename" icon={<Pencil className="w-3 h-3" />} className="w-full max-w-sm p-4">
            <div onClick={(e) => e.stopPropagation()} className="space-y-3">
              <input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-background border-2 border-border focus:border-primary outline-none"
                style={{ borderRadius: 0 }}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && renameItem()}
              />
              <div className="flex justify-end gap-2">
                <PixelButton variant="ghost" onClick={() => setRenameTarget(null)}>Cancel</PixelButton>
                <PixelButton variant="green" onClick={renameItem}>Rename</PixelButton>
              </div>
            </div>
          </PixelPanel>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name}?`}
        description={deleteTarget?.is_directory ? "All files inside will be deleted." : "This cannot be undone."}
        confirmLabel="Delete"
        onConfirm={() => deleteTarget ? deleteItem(deleteTarget) : Promise.resolve()}
      />
    </div>
  );
}
