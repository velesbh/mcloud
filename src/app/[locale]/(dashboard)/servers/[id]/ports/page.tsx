"use client";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { Network, Plus, Copy, X, Star, AlertTriangle } from "lucide-react";
import { PixelPanel, PixelButton } from "@/components/pixel/PixelPanel";
import { LoadingSpinner } from "@/components/shared/MinecraftLoader";
import { toast } from "sonner";

interface Alloc { id: string; ip: string; local_ip: string; port: number; server_id: string | null; }

interface PortData {
  here: Alloc[];
  elsewhere: Alloc[];
  free_on_node: number;
  quota: { max: number; used: number };
  primary_allocation_id: string | null;
}

export default function PortsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, refetch } = useQuery<PortData>({
    queryKey: ["ports", id],
    queryFn: async () => {
      const res = await fetch(`/api/servers/${id}/ports`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load ports");
      return json as PortData;
    },
    refetchInterval: 5_000,
    staleTime: 0,
  });

  async function claim() {
    const res = await fetch(`/api/servers/${id}/ports`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "claim" }),
    });
    const out = await res.json();
    if (res.ok) {
      toast.success(`Claimed ${out.claimed.ip}:${out.claimed.port}`);
      await refetch();
    } else {
      toast.error(out.message ?? out.error ?? "Failed");
    }
  }

  async function release(allocId: string) {
    const res = await fetch(`/api/servers/${id}/ports`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allocation_id: allocId }),
    });
    const out = await res.json();
    if (res.ok) {
      toast.success("Port released");
      await refetch();
    } else {
      toast.error(out.error ?? "Failed");
    }
  }

  function copy(s: string) { navigator.clipboard.writeText(s); toast.success("Copied"); }

  if (isLoading) return <div className="flex justify-center py-20"><LoadingSpinner size={28} /></div>;
  if (!data) return null;

  const atQuota = data.quota.used >= data.quota.max;
  const noFree = data.free_on_node === 0;

  return (
    <div className="space-y-4">
      <PixelPanel variant="dark" className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Network className="w-8 h-8 text-primary" />
            <div>
              <h2 className="font-minecraft text-[12px] uppercase">Port Manager</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Using {data.quota.used} / {data.quota.max} ports ·
                {" "}{data.free_on_node} free on this node
              </p>
            </div>
          </div>
          <PixelButton variant="green" onClick={claim} disabled={atQuota || noFree}>
            <Plus className="w-3.5 h-3.5" />
            Claim Port
          </PixelButton>
        </div>
        {atQuota && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            You've reached your port quota. Upgrade plan for more.
          </div>
        )}
        {noFree && !atQuota && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            No free ports on this node. Ask your admin to add allocations.
          </div>
        )}
      </PixelPanel>

      {/* This server's ports */}
      <PixelPanel variant="ore" title="On this server" icon={<Network className="w-3 h-3" />} className="p-0 overflow-hidden">
        {data.here.length === 0 ? (
          <p className="p-6 text-center text-xs text-muted-foreground font-minecraft">No ports claimed</p>
        ) : (
          <div>
            {data.here.map((a) => {
              const isPrimary = a.id === data.primary_allocation_id;
              const addr = `${a.ip}:${a.port}`;
              return (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3 border-b border-border/30 last:border-0">
                  {isPrimary && <Star className="w-3.5 h-3.5 text-amber-400" />}
                  <div className="flex-1">
                    <code className="font-mono text-sm">{addr}</code>
                    <p className="text-[10px] text-muted-foreground font-minecraft uppercase mt-0.5">
                      Bind: {a.local_ip} {isPrimary && "· Primary (Minecraft port)"}
                    </p>
                  </div>
                  <button
                    onClick={() => copy(addr)}
                    className="p-1 text-muted-foreground hover:text-primary"
                    title="Copy"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {!isPrimary && (
                    <button
                      onClick={() => release(a.id)}
                      className="p-1 text-muted-foreground hover:text-destructive"
                      title="Release"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </PixelPanel>

      {/* Other server's ports (read-only) */}
      {data.elsewhere.length > 0 && (
        <PixelPanel variant="stone" title="Your other servers on this node" className="p-0 overflow-hidden">
          {data.elsewhere.map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-4 py-3 border-b border-border/30 last:border-0 opacity-70">
              <code className="font-mono text-sm flex-1">{a.ip}:{a.port}</code>
              <span className="text-[10px] text-muted-foreground font-minecraft uppercase">In use</span>
            </div>
          ))}
        </PixelPanel>
      )}

      <p className="text-[10px] text-muted-foreground text-center font-minecraft">
        Use claimed ports for plugins like Dynmap (8123), Geyser bridges, or web maps.
      </p>
    </div>
  );
}
