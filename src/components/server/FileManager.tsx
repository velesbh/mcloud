"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  Folder,
  FolderOpen,
  FileText,
  File,
  Trash2,
  Plus,
  Upload,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { LoadingSpinner } from "@/components/shared/MinecraftLoader";
import { cn, formatBytes } from "@/lib/utils";
import { toast } from "sonner";
import type { ServerFile } from "@/lib/supabase/types";

interface FileNode extends ServerFile {
  children?: FileNode[];
}

function buildTree(files: ServerFile[]): FileNode[] {
  const map: Record<string, FileNode> = {};

  // Build node map first
  files.forEach((f) => {
    map[f.path] = { ...f, children: f.is_directory ? [] : undefined };
  });

  // Wire children to parents
  files.forEach((f) => {
    if (f.path === "/") return; // root itself — skip
    const parts = f.path.split("/").filter(Boolean);
    // "/world" → parent "/",  "/plugins/foo.jar" → parent "/plugins"
    const parentPath = parts.length === 1 ? "/" : "/" + parts.slice(0, -1).join("/");
    const parent = map[parentPath];
    if (parent?.children !== undefined) {
      parent.children.push(map[f.path]);
    }
  });

  // Return root's children (or top-level items if no root entry)
  return map["/"]?.children ?? Object.values(map).filter((n) => {
    const parts = n.path.split("/").filter(Boolean);
    return parts.length === 1;
  });
}

function FileTreeNode({
  node,
  depth = 0,
  selectedPath,
  onSelect,
  onDelete,
}: {
  node: FileNode;
  depth?: number;
  selectedPath: string | null;
  onSelect: (node: FileNode) => void;
  onDelete: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded text-sm cursor-pointer group",
          selectedPath === node.path
            ? "bg-primary/10 text-primary"
            : "hover:bg-accent text-foreground"
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => {
          if (node.is_directory) setExpanded((e) => !e);
          else onSelect(node);
        }}
      >
        {node.is_directory && (
          <span className="text-muted-foreground">
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </span>
        )}
        {!node.is_directory && <span className="w-3" />}
        {node.is_directory ? (
          expanded ? (
            <FolderOpen className="w-4 h-4 text-primary shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-primary shrink-0" />
          )
        ) : node.name.endsWith(".properties") || node.name.endsWith(".txt") || node.name.endsWith(".yml") || node.name.endsWith(".yaml") || node.name.endsWith(".json") ? (
          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <File className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
        <span className="flex-1 truncate">{node.name}</span>
        {!node.is_directory && (
          <span className="text-xs text-muted-foreground hidden group-hover:block">
            {formatBytes(node.size_bytes)}
          </span>
        )}
        {node.path !== "/" && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node.path);
            }}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
      {node.is_directory && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileManager({ serverId }: { serverId: string }) {
  const qc = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data: files = [], isLoading } = useQuery<ServerFile[]>({
    queryKey: ["files", serverId],
    queryFn: () => fetch(`/api/servers/${serverId}/files`).then((r) => r.json()),
  });

  const tree = buildTree(files);

  const TEXT_EXTS = [".properties", ".txt", ".yml", ".yaml", ".json", ".toml", ".cfg", ".conf", ".log", ".sh", ".xml"];
  function isTextFile(name: string) {
    return TEXT_EXTS.some((ext) => name.toLowerCase().endsWith(ext));
  }

  async function handleSelectFile(node: FileNode) {
    setSelectedFile(node);
    if (node.is_directory) return;
    if (!isTextFile(node.name)) {
      setEditContent("# Binary file — cannot display");
      return;
    }
    setEditContent("# Loading...");
    try {
      const res = await fetch(`/api/servers/${serverId}/files/content?path=${encodeURIComponent(node.path)}`);
      if (res.ok) {
        const text = await res.text();
        setEditContent(text);
      } else {
        setEditContent("# Could not load file content");
      }
    } catch {
      setEditContent("# Failed to load file");
    }
  }

  async function saveFile() {
    if (!selectedFile) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/servers/${serverId}/files/content?path=${encodeURIComponent(selectedFile.path)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "text/plain" },
          body: editContent,
        }
      );
      if (res.ok) {
        toast.success("File saved");
      } else {
        toast.error("Failed to save file");
      }
    } catch {
      toast.error("Failed to save file");
    } finally {
      setSaving(false);
    }
  }

  async function createFolder() {
    if (!newFolderName.trim()) return;
    await fetch(`/api/servers/${serverId}/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "folder",
        path: `/${newFolderName}`,
        name: newFolderName,
      }),
    });
    qc.invalidateQueries({ queryKey: ["files", serverId] });
    setNewFolderName("");
    setShowNewFolder(false);
    toast.success("Folder created");
  }

  async function deleteFile(path: string) {
    await fetch(`/api/servers/${serverId}/files`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    qc.invalidateQueries({ queryKey: ["files", serverId] });
    if (selectedFile?.path === path) setSelectedFile(null);
    toast.success("Deleted");
  }

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="flex gap-4 h-[calc(100vh-240px)] min-h-[400px]">
      {/* File tree */}
      <Card className="w-60 flex flex-col shrink-0">
        <div className="flex items-center gap-1 p-2 border-b border-border">
          <span className="text-xs font-semibold text-muted-foreground flex-1 px-1">Files</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setShowNewFolder((v) => !v)}
            title="New folder"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
        {showNewFolder && (
          <div className="p-2 border-b border-border">
            <div className="flex gap-1">
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                className="h-7 text-xs"
                onKeyDown={(e) => e.key === "Enter" && createFolder()}
                autoFocus
              />
              <Button size="sm" className="h-7 px-2" onClick={createFolder}>
                Add
              </Button>
            </div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto py-1">
          {tree.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No files</p>
          ) : (
            tree.map((node) => (
              <FileTreeNode
                key={node.id}
                node={node}
                selectedPath={selectedFile?.path ?? null}
                onSelect={handleSelectFile}
                onDelete={(path) => setDeleteTarget(path)}
              />
            ))
          )}
        </div>
      </Card>

      {/* Editor */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        {selectedFile ? (
          <>
            <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
              <span className="text-sm font-mono text-muted-foreground">{selectedFile.path}</span>
              <div className="flex-1" />
              <Button size="sm" onClick={saveFile} disabled={saving} className="gap-1.5">
                {saving ? <LoadingSpinner size={12} /> : null}
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="flex-1 font-mono text-sm resize-none rounded-none border-0 focus-visible:ring-0"
              spellCheck={false}
            />
          </>
        ) : (
          <EmptyState
            title="Select a file"
            description="Choose a file from the tree to view or edit it."
            icon={<FileText className="w-12 h-12 text-muted-foreground" />}
          />
        )}
      </Card>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete this file?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => deleteTarget ? deleteFile(deleteTarget) : Promise.resolve()}
      />
    </div>
  );
}
