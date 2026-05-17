"use client";
import { useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Upload, FileArchive, CheckCircle2, AlertCircle, FolderOpen, Archive } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PixelSlider } from "@/components/pixel/PixelPanel";
import { LoadingSpinner } from "@/components/shared/MinecraftLoader";
import { formatMb } from "@/lib/utils";
import type { Node } from "@/lib/supabase/types";

type ImportStatus = "idle" | "uploading" | "installing" | "done" | "error";
type SourceType = "zip" | "dir";

export default function AdminImportServerPage() {
  const router = useRouter();
  const locale = useLocale();

  const [sourceType, setSourceType] = useState<SourceType>("zip");
  const [name, setName] = useState("");
  const [ownerClerkUserId, setOwnerClerkUserId] = useState("");
  const [nodeId, setNodeId] = useState("");
  const [ramMb, setRamMb] = useState(1024);
  const [diskMb, setDiskMb] = useState(10240);
  const [cpuPercent, setCpuPercent] = useState(100);
  const [file, setFile] = useState<File | null>(null);
  const [sourcePath, setSourcePath] = useState("");
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: nodes = [] } = useQuery<(Node & { last_seen_at: string | null })[]>({
    queryKey: ["nodes"],
    queryFn: () => fetch("/api/nodes").then((r) => r.json()),
  });

  // ── Dropzone handlers ──────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.name.endsWith(".zip")) {
      setFile(dropped);
    } else {
      toast.error("Please drop a .zip file");
    }
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) setFile(picked);
  };

  // ── Submit ─────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nodeId || !name.trim() || !ownerClerkUserId.trim()) {
      toast.error("Fill in all required fields");
      return;
    }
    if (sourceType === "zip" && !file) {
      toast.error("Select a ZIP file to upload");
      return;
    }
    if (sourceType === "dir" && !sourcePath.trim()) {
      toast.error("Enter the absolute path on the node");
      return;
    }

    setStatus(sourceType === "zip" ? "uploading" : "installing");
    setErrorMsg("");

    const fd = new FormData();
    fd.append("source_type", sourceType);
    fd.append("node_id", nodeId);
    fd.append("name", name.trim());
    fd.append("ram_mb", String(ramMb));
    fd.append("disk_mb", String(diskMb));
    fd.append("cpu_percent", String(cpuPercent));
    fd.append("owner_clerk_user_id", ownerClerkUserId.trim());
    if (sourceType === "zip" && file) fd.append("file", file);
    if (sourceType === "dir") fd.append("source_path", sourcePath.trim());

    setStatus("installing");

    try {
      const res = await fetch("/api/admin/servers/import", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.message ?? data.error ?? "Import failed");
        return;
      }

      setStatus("done");
      toast.success(`Server "${name}" imported successfully`);

      setTimeout(() => {
        router.push(`/${locale}/admin/servers`);
      }, 1500);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Network error");
    }
  }

  const isSubmitting = status === "uploading" || status === "installing";
  const canSubmit = !isSubmitting && status !== "done" && !!nodeId && !!name && !!ownerClerkUserId &&
    (sourceType === "zip" ? !!file : !!sourcePath.trim());

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Import Server"
        description="Register an existing Minecraft server on a node from a ZIP archive or a directory already on the node."
      />

      {status === "done" && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>Import complete! Redirecting to servers list…</span>
        </div>
      )}

      {status === "error" && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-6 space-y-5">
          {/* ── Server details ─────────────────────────────────────── */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Server Details</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Server name <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="My Imported Server"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Owner Clerk User ID <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="user_2abc123…"
                  value={ownerClerkUserId}
                  onChange={(e) => setOwnerClerkUserId(e.target.value)}
                  disabled={isSubmitting}
                  required
                  className="font-mono text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  The Clerk user ID (starts with <code className="text-xs">user_</code>) that owns this server.
                </p>
              </div>
            </div>
          </div>

          {/* ── Node ──────────────────────────────────────────────── */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Target Node</h3>
            <Select value={nodeId} onValueChange={setNodeId} disabled={isSubmitting}>
              <SelectTrigger>
                <SelectValue placeholder="Select a node…" />
              </SelectTrigger>
              <SelectContent>
                {nodes.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.name}
                    {n.status !== "online" && (
                      <span className="ml-1.5 text-muted-foreground text-xs">({n.status})</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── Resources ─────────────────────────────────────────── */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Resource Allocation</h3>
            <div className="space-y-4">
              <PixelSlider
                label="RAM"
                value={ramMb}
                min={512}
                max={32768}
                step={512}
                format={(v) => formatMb(v)}
                onChange={setRamMb}
              />
              <PixelSlider
                label="Disk"
                value={diskMb}
                min={1024}
                max={204800}
                step={1024}
                format={(v) => formatMb(v)}
                onChange={setDiskMb}
              />
              <PixelSlider
                label="CPU"
                value={cpuPercent}
                min={25}
                max={800}
                step={25}
                format={(v) => `${v}%`}
                onChange={setCpuPercent}
              />
            </div>
          </div>
        </Card>

        {/* ── Source type toggle ────────────────────────────────────── */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSourceType("zip")}
            disabled={isSubmitting}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors
              ${sourceType === "zip"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40"}`}
          >
            <Archive className="w-4 h-4" />
            Upload ZIP
          </button>
          <button
            type="button"
            onClick={() => setSourceType("dir")}
            disabled={isSubmitting}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors
              ${sourceType === "dir"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40"}`}
          >
            <FolderOpen className="w-4 h-4" />
            Node Directory
          </button>
        </div>

        {/* ── ZIP Dropzone ──────────────────────────────────────────── */}
        {sourceType === "zip" && (
          <Card className="p-6">
            <h3 className="text-sm font-semibold mb-3">ZIP Archive <span className="text-destructive">*</span></h3>

            <div
              className={`relative flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-lg px-6 py-10 transition-colors cursor-pointer
                ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-foreground/2"}
                ${isSubmitting ? "pointer-events-none opacity-60" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => !isSubmitting && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={onFileChange}
                disabled={isSubmitting}
              />

              {file ? (
                <>
                  <FileArchive className="w-10 h-10 text-primary" />
                  <div className="text-center">
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(file.size / 1024 / 1024).toFixed(1)} MB — click or drop to replace
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-medium">Drop a ZIP file here</p>
                    <p className="text-xs text-muted-foreground mt-0.5">or click to browse</p>
                  </div>
                </>
              )}
            </div>
          </Card>
        )}

        {/* ── Node directory path ───────────────────────────────────── */}
        {sourceType === "dir" && (
          <Card className="p-6 space-y-3">
            <h3 className="text-sm font-semibold">Node Directory Path <span className="text-destructive">*</span></h3>
            <div className="space-y-1">
              <Input
                placeholder="/opt/minecraft/my-server"
                value={sourcePath}
                onChange={(e) => setSourcePath(e.target.value)}
                disabled={isSubmitting}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Absolute path to the server directory on the <strong>target node</strong>. The daemon will copy its contents into the new server.
              </p>
            </div>
          </Card>
        )}

        {/* ── Progress / Submit ─────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={!canSubmit}
            className="gap-2 min-w-32"
          >
            {isSubmitting && <LoadingSpinner size={14} />}
            {status === "idle" && "Import Server"}
            {status === "uploading" && "Uploading…"}
            {status === "installing" && "Installing…"}
            {status === "done" && "Done!"}
            {status === "error" && "Retry"}
          </Button>

          {isSubmitting && (
            <p className="text-xs text-muted-foreground">
              {status === "uploading"
                ? "Uploading ZIP to storage…"
                : sourceType === "dir"
                  ? "Daemon is copying directory — this may take a few minutes for large servers…"
                  : "Sending to daemon for extraction — this may take a few minutes for large servers…"}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
