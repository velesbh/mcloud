"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useLocale } from "next-intl";
import { useUser, UserProfile } from "@clerk/nextjs";
import { motion } from "motion/react";
import { Sparkles, ExternalLink, Mail, Calendar, Shield } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UsageBar } from "@/components/shared/UsageBar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatMb } from "@/lib/utils";
import { useFreeTierLimits } from "@/hooks/useFreeTierLimits";
import type { Server } from "@/lib/supabase/types";

export default function AccountPage() {
  const locale = useLocale();
  const { user } = useUser();
  const { maxServers, maxRamMb, maxDiskMb, maxCpuPercent, planName, planKey } =
    useFreeTierLimits();
  const [profileOpen, setProfileOpen] = useState(false);

  const { data: servers = [] } = useQuery<Server[]>({
    queryKey: ["servers"],
    queryFn: () => fetch("/api/servers").then((r) => r.json()),
  });

  const ramUsed = servers.reduce((s, sv) => s + sv.ram_mb, 0);
  const diskUsed = servers.reduce((s, sv) => s + sv.disk_mb, 0);

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title="Account" description="Your profile, plan, and usage." />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5 md:col-span-2">
          <div className="flex items-start gap-4">
            {user?.imageUrl && (
              <img
                src={user.imageUrl}
                alt=""
                className="w-14 h-14 rounded-md border border-border"
              />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate">
                {user?.fullName || user?.username || "MCloud user"}
              </h3>
              <div className="space-y-1 mt-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 truncate">
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{user?.primaryEmailAddress?.emailAddress}</span>
                </div>
                {user?.createdAt && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setProfileOpen(true)}>
              Edit profile
            </Button>
          </div>
        </Card>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Card className="p-5 h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Current plan</span>
                <Sparkles className="w-3.5 h-3.5 text-primary" />
              </div>
              <h3 className="font-semibold text-xl">{planName}</h3>
              {planKey ? (
                <Badge variant="outline" className="mt-2 font-mono text-[10px] border-primary/30 text-primary">
                  {planKey}
                </Badge>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">Default tier</p>
              )}
            </div>
            <Link href={`/${locale}/upgrade`}>
              <Button size="sm" variant="outline" className="w-full mt-4 gap-1.5">
                {planKey ? "Change plan" : "Upgrade"}
                <ExternalLink className="w-3 h-3" />
              </Button>
            </Link>
          </Card>
        </motion.div>
      </div>

      <Card className="p-5">
        <h3 className="font-semibold mb-1">Plan usage</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Allocated across all your servers.
        </p>
        <div className="space-y-4">
          <UsageBar label="Servers" used={servers.length} total={maxServers} unit="custom" formatValue={(n) => n.toString()} />
          <UsageBar label="RAM" used={ramUsed} total={maxRamMb} />
          <UsageBar label="Disk" used={diskUsed} total={maxDiskMb} />
        </div>
        <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground flex items-center gap-2">
          <Shield className="w-3.5 h-3.5" />
          Max CPU per server: <span className="text-foreground font-medium">{maxCpuPercent}%</span>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-3">Danger zone</h3>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-md border border-destructive/30 bg-destructive/5">
          <div>
            <p className="font-medium text-sm">Delete account</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Removes your account and all servers permanently.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-destructive/50 text-destructive hover:bg-destructive/10"
            onClick={() => setProfileOpen(true)}
          >
            Manage in profile
          </Button>
        </div>
      </Card>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-transparent border-0 shadow-none">
          <UserProfile routing="hash" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
