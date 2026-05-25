"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { LoadingSpinner } from "@/components/shared/MinecraftLoader";
import { MC_JAVA_VERSIONS, MC_BEDROCK_VERSIONS, JAVA_LOADERS } from "@/lib/constants";
import { formatMb } from "@/lib/utils";
import type { Node } from "@/lib/supabase/types";

export default function AdminCreateServerPage() {
  const router = useRouter();
  const locale = useLocale();

  const [name, setName] = useState("");
  const [ownerClerkUserId, setOwnerClerkUserId] = useState("");
  const [nodeId, setNodeId] = useState<string>("");      // "" => auto
  const [edition, setEdition] = useState<"java" | "bedrock">("java");
  const [gameVersion, setGameVersion] = useState<string>(MC_JAVA_VERSIONS[0]);
  const [loader, setLoader] = useState<string>("vanilla");
  const [ramMb, setRamMb] = useState(2048);
  const [diskMb, setDiskMb] = useState(10240);
  const [cpuPercent, setCpuPercent] = useState(200);
  const [maxPlayers, setMaxPlayers] = useState(20);
  const [motd, setMotd] = useState("");
  const [isPremium, setIsPremium] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const { data: nodes = [] } = useQuery<(Node & { last_seen_at: string | null })[]>({
    queryKey: ["nodes"],
    queryFn: () => fetch("/api/nodes").then((r) => r.json()),
  });

  const versionList = edition === "bedrock" ? MC_BEDROCK_VERSIONS : MC_JAVA_VERSIONS;
  const loaderList = edition === "bedrock"
    ? [{ id: "bedrock", label: "Bedrock", desc: "Official Bedrock server" }]
    : JAVA_LOADERS;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !ownerClerkUserId.trim()) {
      toast.error("Server name and owner Clerk user ID are required");
      return;
    }
    setSubmitting(true);
    setStatus("idle");
    setErrorMsg("");
    try {
      const res = await fetch("/api/admin/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          owner_clerk_user_id: ownerClerkUserId.trim(),
          node_id: nodeId || undefined,
          edition,
          game_version: gameVersion,
          loader,
          ram_mb: ramMb,
          disk_mb: diskMb,
          cpu_percent: cpuPercent,
          max_players: maxPlayers,
          motd: motd.trim() || undefined,
          is_premium: isPremium,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.message ?? data.error ?? "Create failed");
        return;
      }
      setStatus("done");
      toast.success(`Server "${name}" created${isPremium ? " (premium)" : ""}`);
      setTimeout(() => router.push(`/${locale}/admin/servers`), 1200);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Create Server"
        description="Provision a new server for any user with arbitrary resources. All quotas, stock checks, and premium reservations are bypassed."
      />

      {status === "done" && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>Server created! Redirecting…</span>
        </div>
      )}
      {status === "error" && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-semibold">Server Details</h3>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Server name <span className="text-destructive">*</span></Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Server" required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Owner Clerk User ID <span className="text-destructive">*</span></Label>
              <Input
                value={ownerClerkUserId}
                onChange={(e) => setOwnerClerkUserId(e.target.value)}
                placeholder="user_2abc123…"
                className="font-mono text-sm"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                The Clerk user ID (starts with <code>user_</code>) that will own this server. A profile row will be auto-created if missing.
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">MOTD (optional)</Label>
              <Input value={motd} onChange={(e) => setMotd(e.target.value)} placeholder="A Minecraft Server" maxLength={64} />
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-semibold">Edition &amp; Version</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Edition</Label>
              <Select value={edition} onValueChange={(v: "java" | "bedrock") => {
                setEdition(v);
                setGameVersion(v === "bedrock" ? MC_BEDROCK_VERSIONS[0] : MC_JAVA_VERSIONS[0]);
                setLoader(v === "bedrock" ? "bedrock" : "vanilla");
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="java">Java</SelectItem>
                  <SelectItem value="bedrock">Bedrock</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Version</Label>
              <Select value={gameVersion} onValueChange={setGameVersion}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {versionList.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Loader</Label>
              <Select value={loader} onValueChange={setLoader}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {loaderList.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.label} <span className="text-muted-foreground">— {l.desc}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-semibold">Node Placement</h3>
          <div className="space-y-1">
            <Label className="text-xs">Target node</Label>
            <Select value={nodeId || "__auto"} onValueChange={(v) => setNodeId(v === "__auto" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Auto-pick any available node" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__auto">Auto-pick (any node with a free port)</SelectItem>
                {nodes.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.name}{n.status !== "online" && ` (${n.status})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-semibold">Resources <span className="text-muted-foreground font-normal text-xs">— no caps</span></h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">RAM (MB)</Label>
              <Input type="number" min={128} step={256} value={ramMb} onChange={(e) => setRamMb(parseInt(e.target.value) || 0)} />
              <p className="text-[10px] text-muted-foreground">{formatMb(ramMb)}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Disk (MB)</Label>
              <Input type="number" min={512} step={512} value={diskMb} onChange={(e) => setDiskMb(parseInt(e.target.value) || 0)} />
              <p className="text-[10px] text-muted-foreground">{formatMb(diskMb)}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CPU (%)</Label>
              <Input type="number" min={10} step={25} value={cpuPercent} onChange={(e) => setCpuPercent(parseInt(e.target.value) || 0)} />
              <p className="text-[10px] text-muted-foreground">100% = 1 core</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max players</Label>
              <Input type="number" min={1} max={10000} value={maxPlayers} onChange={(e) => setMaxPlayers(parseInt(e.target.value) || 1)} />
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label className="flex items-center gap-1.5 text-sm font-semibold">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Premium server
              </Label>
              <p className="text-xs text-muted-foreground max-w-md">
                Premium servers are exempt from the idle-hibernation sweep. They stay assigned to their node and allocation forever, regardless of the owner&apos;s plan tier.
              </p>
            </div>
            <Switch checked={isPremium} onCheckedChange={setIsPremium} />
          </div>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={submitting || status === "done"} className="gap-2 min-w-32">
            {submitting && <LoadingSpinner size={14} />}
            {status === "done" ? "Done!" : submitting ? "Creating…" : "Create Server"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push(`/${locale}/admin/servers`)}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
