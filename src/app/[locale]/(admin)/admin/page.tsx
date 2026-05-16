import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  ServerBlock,
  GrassBlock,
  UserHead,
  StoneBlock,
  DirtBlock,
} from "@/components/pixel/Block";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const supabase = createAdminSupabaseClient();

  const [
    { count: totalServers },
    { count: runningServers },
    { count: hibernatedServers },
    { count: totalUsers },
    { count: totalNodes },
  ] = await Promise.all([
    supabase.from("servers").select("*", { count: "exact", head: true }),
    supabase.from("servers").select("*", { count: "exact", head: true }).eq("status", "running"),
    supabase.from("servers").select("*", { count: "exact", head: true }).eq("status", "hibernated"),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("nodes").select("*", { count: "exact", head: true }),
  ]);

  const metrics = [
    { label: "Total Servers",  value: totalServers ?? 0,      Icon: ServerBlock },
    { label: "Running",        value: runningServers ?? 0,    Icon: GrassBlock },
    { label: "Hibernated",     value: hibernatedServers ?? 0, Icon: DirtBlock },
    { label: "Users",          value: totalUsers ?? 0,        Icon: UserHead },
    { label: "Nodes",          value: totalNodes ?? 0,        Icon: StoneBlock },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Admin Overview" description="System metrics and status." />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map((m) => (
          <Card
            key={m.label}
            className="p-4 flex items-center gap-4"
            style={{
              borderRadius: 0,
              border: "2px solid hsl(var(--border))",
              boxShadow:
                "inset 2px 2px 0 rgba(255,255,255,0.03), 3px 3px 0 rgba(0,0,0,0.2)",
            }}
          >
            <m.Icon size={36} />
            <div>
              <p className="font-minecraft text-base leading-none mb-1">{m.value}</p>
              <p className="font-minecraft text-[9px] text-muted-foreground uppercase tracking-wider">
                {m.label}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
