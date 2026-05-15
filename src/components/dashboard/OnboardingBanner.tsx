"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { Sparkles, Plus, Package, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "next-intl";

export function OnboardingBanner({ atLimit }: { atLimit: boolean }) {
  const locale = useLocale();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-6"
    >
      <div className="absolute right-0 top-0 -mr-12 -mt-12 w-48 h-48 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

      <div className="relative flex items-start gap-4">
        <div className="hidden sm:flex w-12 h-12 rounded-md bg-primary/10 text-primary items-center justify-center shrink-0">
          <Sparkles className="w-6 h-6" />
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold mb-1">Welcome to MCloud</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Spin up your first Minecraft server in under a minute. Then explore mods, manage files, and watch the console live.
          </p>

          <div className="grid sm:grid-cols-3 gap-2 mb-5 text-xs">
            <FeatureChip icon={Package} text="Mods & plugins from Modrinth" />
            <FeatureChip icon={Terminal} text="Live web console" />
            <FeatureChip icon={Sparkles} text="One-click backups" />
          </div>

          {!atLimit && (
            <Link href={`/${locale}/servers/new`}>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Create your first server
              </Button>
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function FeatureChip({ icon: Icon, text }: { icon: typeof Sparkles; text: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
      <span className="truncate">{text}</span>
    </div>
  );
}
