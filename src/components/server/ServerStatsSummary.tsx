"use client";
import { motion } from "motion/react";
import { Server, Activity, MemoryStick, HardDrive } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatMb } from "@/lib/utils";
import type { Server as ServerType } from "@/lib/supabase/types";

type Quotas = {
  max_ram_mb: number;
  max_disk_mb: number;
  max_servers: number;
};

interface Props {
  servers: ServerType[];
  quotas?: Quotas;
}

export function ServerStatsSummary({ servers, quotas }: Props) {
  const running = servers.filter((s) => s.status === "running").length;
  const ramUsed = servers.reduce((sum, s) => sum + s.ram_mb, 0);
  const diskUsed = servers.reduce((sum, s) => sum + s.disk_mb, 0);

  const tiles = [
    {
      label: "Servers",
      value: servers.length.toString(),
      suffix: quotas ? `/ ${quotas.max_servers}` : "",
      icon: Server,
      color: "text-foreground",
      bg: "bg-muted",
    },
    {
      label: "Running",
      value: running.toString(),
      suffix: servers.length ? `/ ${servers.length}` : "",
      icon: Activity,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "RAM allocated",
      value: formatMb(ramUsed),
      suffix: quotas ? `/ ${formatMb(quotas.max_ram_mb)}` : "",
      icon: MemoryStick,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: "Disk allocated",
      value: formatMb(diskUsed),
      suffix: quotas ? `/ ${formatMb(quotas.max_disk_mb)}` : "",
      icon: HardDrive,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {tiles.map((t, i) => (
        <motion.div
          key={t.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
        >
          <Card className="p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-md flex items-center justify-center ${t.bg} ${t.color}`}>
              <t.icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{t.label}</p>
              <p className="text-base font-semibold truncate">
                {t.value}
                {t.suffix && <span className="text-xs text-muted-foreground font-normal ml-1">{t.suffix}</span>}
              </p>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
