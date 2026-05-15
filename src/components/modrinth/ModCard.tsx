"use client";
import { motion } from "motion/react";
import Image from "next/image";
import { Download, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ModrinthProject } from "@/lib/modrinth/types";
import { LoadingSpinner } from "@/components/shared/MinecraftLoader";

interface ModCardProps {
  project: ModrinthProject;
  installed?: boolean;
  installing?: boolean;
  onInstall?: () => void;
  onUninstall?: () => void;
}

export function ModCard({
  project,
  installed,
  installing,
  onInstall,
  onUninstall,
}: ModCardProps) {
  return (
    <Card className="p-4 flex gap-3">
      <div className="w-12 h-12 rounded-md overflow-hidden bg-muted shrink-0 flex items-center justify-center">
        {project.icon_url ? (
          <Image
            src={project.icon_url}
            alt={project.title}
            width={48}
            height={48}
            className="w-full h-full object-cover"
            unoptimized
          />
        ) : (
          <Package className="w-6 h-6 text-muted-foreground" />
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="font-semibold text-sm truncate">{project.title}</h4>
            <p className="text-xs text-muted-foreground">by {project.author}</p>
          </div>
          <Badge variant="outline" className="text-xs shrink-0 capitalize">
            {project.project_type}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">{project.description}</p>
        <div className="flex items-center gap-3 pt-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Download className="w-3 h-3" />
            {project.downloads.toLocaleString()}
          </span>
          <div className="flex-1" />
          {installed ? (
            <motion.div whileTap={{ scale: 0.96 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 px-2 text-destructive hover:text-destructive"
                onClick={onUninstall}
              >
                Uninstall
              </Button>
            </motion.div>
          ) : (
            <motion.div whileTap={{ scale: 0.96 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
              <Button
                size="sm"
                className="text-xs h-7 px-2 gap-1"
                onClick={onInstall}
                disabled={installing}
              >
                {installing ? <LoadingSpinner size={10} /> : <Download className="w-3 h-3" />}
                Install
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </Card>
  );
}
