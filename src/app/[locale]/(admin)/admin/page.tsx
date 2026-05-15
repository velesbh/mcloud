import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { Server, Network, Users, Activity } from "lucide-react";

export default async function AdminOverviewPage() {
  const supabase = createAdminSupabaseClient();

  const [
    { count: totalServers },
    { count: runningServers },
    { count: totalUsers },
    { count: totalNodes },
  ] = await Promise.all([
    supabase.from("servers").select("*", { count: "exact", head: true }),
    supabase
      .from("servers")
      .select("*", { count: "exact", head: true })
      .eq("status", "running"),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("nodes").select("*", { count: "exact", head: true }),
  ]);

  const metrics = [
    { label: "Total Servers", value: totalServers ?? 0, icon: Server, color: "text-primary" },
    { label: "Running", value: runningServers ?? 0, icon: Activity, color: "text-green-500" },
    { label: "Users", value: totalUsers ?? 0, icon: Users, color: "text-blue-500" },
    { label: "Nodes", value: totalNodes ?? 0, icon: Network, color: "text-purple-500" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Admin Overview" description="System metrics and status." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label} className="p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center ${m.color}`}>
              <m.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{m.value}</p>
              <p className="text-xs text-muted-foreground">{m.label}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
