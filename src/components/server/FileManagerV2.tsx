"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Folder, FolderOpen, FileText, File as FileIcon, Trash2, Plus, Upload, Download,
  Link2, FilePlus, ChevronRight, FileArchive, Save, ArrowLeft, Pencil,
  MoreVertical, CheckSquare,
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

interface CtxMenu {
  x: number;
  y: number;
  item: FsItem;
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

  // Single-click editor selection
  const [activeFile, setActiveFile] = useState<FsItem | null>(null);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  // Multi-select via Ctrl+click
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

  // Dialogs
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [renameTarget, setRenameTarget] = useState<FsItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<FsItem | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

  // Right-click context menu
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);

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

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
    };
  }, [ctxMenu]);

  /* ── handlers ── */

  function handleItemClick(item: FsItem, e: React.MouseEvent) {
    if (item.is_directory) {
      setCwd(item.path);
      setActiveFile(null);
      setSelectedPaths(new Set());
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      // Multi-select toggle
      setSelectedPaths((prev) => {
        const next = new Set(prev);
        if (next.has(item.path)) next.delete(item.path);
        else next.add(item.path);
        return next;
      });
      return;
    }
    // Regular click — clear multi-select and open file
    setSelectedPaths(new Set());
    openFile(item);
  }

  function handleContextMenu(e: React.MouseEvent, item: FsItem) {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, item });
  }

  async function openFile(item: FsItem) {
    setActiveFile(item);
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
    if (!activeFile) return;
    setSaving(true);
    try {
      await callFs(serverId, "write", { path: activeFile.path, content });
      toast.success("Saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    const fileArr = Array.from(files);
    setBusy(`Uploading ${fileArr.length} file${fileArr.length > 1 ? "s" : ""}...`);
    setUploadProgress(0);
    try {
      for (let fi = 0; fi < fileArr.length; fi++) {
        const file = fileArr[fi];
        const baseProgress = Math.round((fi / fileArr.length) * 100);
        const sliceSize = Math.round(100 / fileArr.length);

        if (file.size > 4 * 1024 * 1024) {
          const presignRes = await fetch(
            `/api/servers/${serverId}/fs?filename=${encodeURIComponent(file.name)}`
          );
          if (presignRes.ok) {
            const { uploadUrl, downloadUrl } = await presignRes.json() as {
              uploadUrl: string; downloadUrl: string; storageKey: string;
            };
            // XHR gives us upload progress events; fetch does not
            await new Promise<void>((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                  const pct = baseProgress + Math.round((e.loaded / e.total) * sliceSize * 0.9);
                  setUploadProgress(Math.min(pct, 99));
                }
              };
              xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) resolve();
                else reject(new Error(`S3 upload failed: ${xhr.status}`));
              };
              xhr.onerror = () => reject(new Error("S3 upload network error"));
              xhr.open("PUT", uploadUrl);
              xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
              xhr.send(file);
            });
            // Tell daemon to pull from S3
            const importRes = await fetch(`/api/servers/${serverId}/fs`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                op: "import-url",
                url: downloadUrl,
                targetPath: cwd.replace(/\/+$/, "") + "/" + file.name.replace(/[^\w.\-]/g, "_"),
              }),
            });
            if (!importRes.ok) {
              const err = await importRes.json().catch(() => ({ error: importRes.statusText }));
              throw new Error(err.error ?? "Import failed");
            }
            setUploadProgress(baseProgress + sliceSize);
            continue;
          }
          // S3 not configured — fall through to multipart
        }

        // Small file — multipart upload via Vercel (progress via XHR too)
        await new Promise<void>((resolve, reject) => {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("targetDir", cwd);
          const xhr = new XMLHttpRequest();
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = baseProgress + Math.round((e.loaded / e.total) * sliceSize);
              setUploadProgress(Math.min(pct, 99));
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else {
              try {
                const body = JSON.parse(xhr.responseText);
                reject(new Error(body.error ?? "Upload failed"));
              } catch {
                reject(new Error(`Upload failed: ${xhr.status}`));
              }
            }
          };
          xhr.onerror = () => reject(new Error("Upload network error"));
          xhr.open("POST", `/api/servers/${serverId}/fs/upload`);
          xhr.send(fd);
        });
        setUploadProgress(baseProgress + sliceSize);
      }
      setUploadProgress(100);
      toast.success(`Uploaded ${fileArr.length} file${fileArr.length > 1 ? "s" : ""}`);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
      setUploadProgress(null);
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
    setDownloadProgress(0);
    try {
      const res = await fetch(`/api/servers/${serverId}/fs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "export", path: item.path }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? "Download failed");
      }

      const contentLength = Number(res.headers.get("Content-Length") ?? 0);
      const contentDisposition = res.headers.get("Content-Disposition") ?? "";
      const match = contentDisposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || item.name + (item.is_directory ? ".zip" : "");

      // Stream the body so we can track progress
      const reader = res.body!.getReader();
      const chunks: Uint8Array<ArrayBuffer>[] = [];
      let received = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (contentLength > 0) {
          setDownloadProgress(Math.min(Math.round((received / contentLength) * 100), 99));
        }
      }
      setDownloadProgress(100);

      const blob = new Blob(chunks);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${filename}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
      setDownloadProgress(null);
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
      if (activeFile?.path === item.path) setActiveFile(null);
      await refresh();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function bulkDelete() {
    const paths = Array.from(selectedPaths);
    setBusy(`Deleting ${paths.length} items...`);
    let failed = 0;
    for (const path of paths) {
      try {
        await callFs(serverId, "delete", { path });
      } catch {
        failed++;
      }
    }
    setBusy(null);
    setSelectedPaths(new Set());
    if (failed > 0) toast.error(`${failed} items failed to delete`);
    else toast.success(`Deleted ${paths.length} items`);
    await refresh();
  }

  function navUp() {
    if (cwd === "/") return;
    const parts = cwd.split("/").filter(Boolean);
    parts.pop();
    setCwd(parts.length === 0 ? "/" : "/" + parts.join("/"));
    setActiveFile(null);
    setSelectedPaths(new Set());
  }

  /* ── Breadcrumb segments ── */
  function Breadcrumb() {
    const segments = cwd === "/" ? [] : cwd.split("/").filter(Boolean);
    return (
      <div className="flex items-center gap-1 px-3 py-1 font-mono text-xs flex-1 min-w-0 overflow-x-auto"
        style={{ background: "rgba(0,0,0,0.4)", border: "2px solid #3a3a3a" }}
      >
        <button
          className="text-primary hover:underline shrink-0"
          onClick={() => { setCwd("/"); setActiveFile(null); setSelectedPaths(new Set()); }}
        >
          /
        </button>
        {segments.map((seg, i) => {
          const path = "/" + segments.slice(0, i + 1).join("/");
          return (
            <span key={path} className="flex items-center gap-1 shrink-0">
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
              <button
                className="text-primary hover:underline"
                onClick={() => { setCwd(path); setActiveFile(null); setSelectedPaths(new Set()); }}
              >
                {seg}
              </button>
            </span>
          );
        })}
      </div>
    );
  }

  const hasSelection = selectedPaths.size > 0;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <PixelPanel variant="dark" className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <PixelButton size="sm" onClick={navUp} disabled={cwd === "/"}>
            <ArrowLeft className="w-3 h-3" />
            Up
          </PixelButton>
          <Breadcrumb />
          {hasSelection ? (
            <PixelButton size="sm" variant="red" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 className="w-3 h-3" />
              Delete {selectedPaths.size}
            </PixelButton>
          ) : null}
          <PixelButton size="sm" variant="green" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-3 h-3" />
            Upload
          </PixelButton>
          <PixelButton size="sm" onClick={() => setUrlOpen(true)}>
            <Link2 className="w-3 h-3" />
            URL
          </PixelButton>
          <PixelButton size="sm" onClick={() => setNewFolderOpen(true)}>
            <Plus className="w-3 h-3" />
            Folder
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
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-amber-400 font-minecraft">
              <LoadingSpinner size={12} /> {busy}
            </div>
            {(uploadProgress !== null || downloadProgress !== null) && (
              <PixelProgressBar
                progress={uploadProgress ?? downloadProgress ?? 0}
                label={uploadProgress !== null ? "Upload" : "Download"}
              />
            )}
          </div>
        )}
        {hasSelection && (
          <div className="mt-2 flex items-center gap-2 text-xs text-primary font-minecraft">
            <CheckSquare className="w-3.5 h-3.5" />
            {selectedPaths.size} selected — Ctrl+click to add/remove · Ctrl+A to select all
          </div>
        )}
      </PixelPanel>

      {/* Main grid: file list + editor */}
      <div className="grid gap-3 lg:grid-cols-[minmax(280px,360px)_1fr]">
        {/* Files list */}
        <PixelPanel variant="stone" title="Files" icon={<Folder className="w-3 h-3" />} className="overflow-hidden">
          <div
            className="max-h-[60vh] overflow-y-auto"
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "a") {
                e.preventDefault();
                setSelectedPaths(new Set(items.filter((i) => !i.is_directory).map((i) => i.path)));
              }
            }}
            tabIndex={0}
          >
            {loading ? (
              <div className="p-8 text-center"><LoadingSpinner size={20} /></div>
            ) : items.length === 0 ? (
              <p className="p-6 text-center text-xs text-muted-foreground font-minecraft">
                Empty directory
              </p>
            ) : (
              items.map((item) => {
                const isSelected = selectedPaths.has(item.path);
                const isEditing = activeFile?.path === item.path;
                return (
                  <div
                    key={item.path}
                    className={cn(
                      "group flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer border-b border-border/30 select-none",
                      isSelected
                        ? "bg-primary/20 text-primary"
                        : isEditing
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-accent text-foreground"
                    )}
                    onClick={(e) => handleItemClick(item, e)}
                    onContextMenu={(e) => handleContextMenu(e, item)}
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
                    {/* Quick-action row on hover */}
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 ml-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleExport(item); }}
                        title="Download"
                        className="p-0.5 text-muted-foreground hover:text-primary"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleContextMenu(e, item); }}
                        title="More"
                        className="p-0.5 text-muted-foreground hover:text-primary"
                      >
                        <MoreVertical className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </PixelPanel>

        {/* Editor */}
        <PixelPanel variant="stone" className="overflow-hidden flex flex-col">
          {activeFile ? (
            <>
              <div className="flex items-center gap-2 px-3 py-2 border-b-2 border-border">
                <FileText className="w-3.5 h-3.5 text-primary" />
                <code className="text-xs font-mono flex-1 truncate">{activeFile.path}</code>
                <PixelButton
                  size="sm"
                  variant="green"
                  onClick={saveFile}
                  disabled={saving || !isTextFile(activeFile.name)}
                >
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
              <p className="text-[10px] mt-1 opacity-60">Ctrl+click for multi-select</p>
            </div>
          )}
        </PixelPanel>
      </div>

      {/* ── Right-click context menu ── */}
      {ctxMenu && (
        <div
          className="fixed z-50 min-w-[160px] py-1"
          style={{
            left: ctxMenu.x,
            top: ctxMenu.y,
            background: "hsl(var(--card))",
            border: "2px solid hsl(var(--border))",
            boxShadow: "4px 4px 0 rgba(0,0,0,0.4)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {isTextFile(ctxMenu.item.name) && !ctxMenu.item.is_directory && (
            <CtxItem
              icon={<FileText className="w-3.5 h-3.5" />}
              label="Edit"
              onClick={() => { openFile(ctxMenu.item); setCtxMenu(null); }}
            />
          )}
          <CtxItem
            icon={<Download className="w-3.5 h-3.5" />}
            label="Download"
            onClick={() => { handleExport(ctxMenu.item); setCtxMenu(null); }}
          />
          {ctxMenu.item.name.endsWith(".zip") ? (
            <CtxItem
              icon={<FolderOpen className="w-3.5 h-3.5" />}
              label="Unzip here"
              onClick={() => { handleUnzip(ctxMenu.item); setCtxMenu(null); }}
            />
          ) : null}
          {!ctxMenu.item.name.endsWith(".zip") && (
            <CtxItem
              icon={<FileArchive className="w-3.5 h-3.5" />}
              label={ctxMenu.item.is_directory ? "Zip folder" : "Zip"}
              onClick={() => { handleZip(ctxMenu.item); setCtxMenu(null); }}
            />
          )}
          <CtxItem
            icon={<Pencil className="w-3.5 h-3.5" />}
            label="Rename"
            onClick={() => {
              setRenameTarget(ctxMenu.item);
              setRenameValue(ctxMenu.item.name);
              setCtxMenu(null);
            }}
          />
          <div style={{ height: 1, background: "hsl(var(--border))", margin: "4px 8px" }} />
          <CtxItem
            icon={<Trash2 className="w-3.5 h-3.5 text-destructive" />}
            label="Delete"
            labelClass="text-destructive"
            onClick={() => { setDeleteTarget(ctxMenu.item); setCtxMenu(null); }}
          />
        </div>
      )}

      {/* ── Dialogs ── */}

      {urlOpen && (
        <Modal onClose={() => setUrlOpen(false)} title="Download from URL" icon={<Link2 className="w-3 h-3" />}>
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
        </Modal>
      )}

      {newFolderOpen && (
        <Modal onClose={() => setNewFolderOpen(false)} title="New Folder" icon={<Folder className="w-3 h-3" />}>
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
        </Modal>
      )}

      {renameTarget && (
        <Modal onClose={() => setRenameTarget(null)} title="Rename" icon={<Pencil className="w-3 h-3" />}>
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
        </Modal>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name}?`}
        description={deleteTarget?.is_directory ? "All files inside will be deleted." : "This cannot be undone."}
        confirmLabel="Delete"
        onConfirm={() => deleteTarget ? deleteItem(deleteTarget) : Promise.resolve()}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={(o) => !o && setBulkDeleteOpen(false)}
        title={`Delete ${selectedPaths.size} items?`}
        description="All selected files and folders will be permanently deleted."
        confirmLabel={`Delete ${selectedPaths.size} items`}
        onConfirm={bulkDelete}
      />
    </div>
  );
}

/* ── Pixel progress bar ── */
function PixelProgressBar({ progress, label }: { progress: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-minecraft text-muted-foreground w-16 shrink-0">{label}</span>
      <div
        className="flex-1 h-3 relative"
        style={{ background: "#1a1a1a", border: "2px solid #3a3a3a", imageRendering: "pixelated" }}
      >
        <div
          className="absolute inset-0 transition-all duration-150"
          style={{
            width: `${progress}%`,
            background: progress === 100 ? "#22c55e" : "#16a34a",
            boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.3)",
          }}
        />
      </div>
      <span className="text-[10px] font-minecraft text-primary w-8 text-right shrink-0">{progress}%</span>
    </div>
  );
}

/* ── Context menu item ── */
function CtxItem({
  icon, label, labelClass, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  labelClass?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs hover:bg-accent transition-colors"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className={cn("font-minecraft uppercase text-[10px]", labelClass)}>{label}</span>
    </button>
  );
}

/* ── Generic modal ── */
function Modal({
  children, onClose, title, icon,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <PixelPanel
          variant="stone"
          title={title}
          icon={icon}
          className="w-full max-w-md p-4 space-y-3"
        >
          {children}
        </PixelPanel>
      </div>
    </div>
  );
}
