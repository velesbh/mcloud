import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { StoneBlock, ServerBlock } from "@/components/pixel/Block";

export const dynamic = "force-dynamic";

function pct(used: number, allowed: number) {
  if (allowed <= 0) return 0;
  return Math.min(100, Math.round((used / allowed) * 100));
}

function fmtGb(mb: number) {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
}

function Bar({ used, allowed, total, label }: { used: number; allowed: number; total: number; label: string }) {
  const usedPct  = pct(used, allowed);
  const physicalPct = pct(total, allowed);
  return (
    <div>
      <div className="flex justify-between text-[10px] font-minecraft mb-1">
        <span>{label}</span>
        <span className={usedPct >= 90 ? "text-destructive" : "text-muted-foreground"}>
          {fmtGb(used)} / {fmtGb(allowed)}
        </span>
      </div>
      <div
        className="h-3 border relative overflow-hidden"
        style={{
          borderColor: "hsl(var(--border))",
          background: "hsl(var(--muted))",
          borderRadius: 0,
        }}
      >
        {/* Physical capacity marker — line where 100% physical sits inside the overallocated bar */}
        <div
          className="absolute top-0 bottom-0 border-r-2 border-dashed border-slate-500/60"
          style={{ left: `${physicalPct}%`, width: 0 }}
        />
        <div
          className="h-full transition-all"
          style={{
            width: `${usedPct}%`,
            background:
              usedPct >= 90 ? "#cf2424" : usedPct >= 75 ? "#e8c93a" : "#5a9a2e",
          }}
        />
      </div>
    </div>
  );
}

export default async function StockPage() {
  const supabase = createAdminSupabaseClient();
  const { data: stock = [] } = await supabase
    .from("node_stock")
    .select("*")
    .order("free_ram_mb", { ascending: false });

  // Also pull hibernated count for the header chip
  const { count: hibernatedCount } = await supabase
    .from("servers")
    .select("*", { count: "exact", head: true })
    .eq("status", "hibernated");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stock"
        description="Live node capacity, accounting for the overallocation factor configured per node."
      />

      <div className="flex flex-wrap items-center gap-3">
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 border-2"
          style={{ borderColor: "hsl(var(--border))", borderRadius: 0 }}
        >
          <ServerBlock size={16} />
          <span className="font-minecraft text-[10px]">
            {(stock ?? []).length} nodes
          </span>
        </div>
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 border-2"
          style={{ borderColor: "#7a5538", borderRadius: 0, background: "rgba(122,85,56,0.1)" }}
        >
          <StoneBlock size={16} />
          <span className="font-minecraft text-[10px] text-amber-300">
            {hibernatedCount ?? 0} hibernated
          </span>
        </div>
      </div>

      {(stock ?? []).length === 0 ? (
        <Card
          className="p-12 text-center"
          style={{ borderRadius: 0, border: "2px solid hsl(var(--border))" }}
        >
          <ServerBlock size={48} className="mx-auto mb-3 opacity-40" />
          <p className="font-minecraft text-[10px] mb-1">No nodes yet</p>
          <p className="text-sm text-muted-foreground">Add a node in the Nodes tab.</p>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {(stock ?? []).map((n: any) => {
            const online =
              n.last_seen_at &&
              Date.now() - new Date(n.last_seen_at).getTime() < 60_000;
            return (
              <Card
                key={n.id}
                className="p-5 space-y-4"
                style={{
                  borderRadius: 0,
                  border: "2px solid hsl(var(--border))",
                  boxShadow:
                    "inset 2px 2px 0 rgba(255,255,255,0.03), 3px 3px 0 rgba(0,0,0,0.18)",
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ServerBlock size={28} />
                    <div className="min-w-0">
                      <p className="font-minecraft text-[11px] truncate">{n.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        overalloc {n.overallocation_percent}% · {n.running_count ?? 0} running
                      </p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 font-minecraft text-[9px] px-2 py-1 border ${
                      online
                        ? "border-green-500/40 bg-green-500/10 text-green-400"
                        : "border-zinc-500/40 bg-zinc-500/10 text-zinc-400"
                    }`}
                    style={{ borderRadius: 0 }}
                  >
                    <span className={`w-1.5 h-1.5 ${online ? "bg-green-500" : "bg-zinc-500"}`} />
                    {online ? "Live" : "Offline"}
                  </span>
                </div>

                <Bar
                  label="RAM"
                  used={n.used_ram_mb}
                  allowed={n.allowed_ram_mb}
                  total={n.total_ram_mb}
                />
                <Bar
                  label="CPU"
                  used={n.used_cpu}
                  allowed={n.allowed_cpu}
                  total={n.total_cpu}
                />
                <Bar
                  label="Disk"
                  used={n.used_disk_mb}
                  allowed={n.allowed_disk_mb}
                  total={n.total_disk_mb}
                />

                <p className="text-[10px] text-muted-foreground pt-1 border-t border-border">
                  Free: {fmtGb(n.free_ram_mb)} RAM · {n.free_cpu}% CPU · {fmtGb(n.free_disk_mb)} disk
                </p>
              </Card>
            );
          })}
        </div>
      )}

      <Card
        className="p-4 text-xs text-muted-foreground"
        style={{ borderRadius: 0, border: "2px solid hsl(var(--border))" }}
      >
        <p className="font-minecraft text-[10px] mb-2">How overallocation works</p>
        <p className="leading-relaxed">
          Each node has a physical capacity and an{" "}
          <span className="text-foreground font-semibold">overallocation_percent</span>. The view
          enforces a hard ceiling at <em>physical × overallocation%</em>. The dashed line on each
          bar marks where 100% of physical RAM sits — anything past that is overcommitted.
          Set per-node in the Nodes tab.
        </p>
      </Card>
    </div>
  );
}
