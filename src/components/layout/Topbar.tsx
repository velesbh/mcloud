"use client";
import { UserButton } from "@clerk/nextjs";
import { ThemeToggle } from "./ThemeToggle";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { PlanBadge } from "./PlanBadge";
import { MCloudLogo, MCloudWordmark } from "./MCloudLogo";
import { Button } from "@/components/ui/button";
import { PanelLeft } from "lucide-react";
import Link from "next/link";
import { useLocale } from "next-intl";

interface TopbarProps {
  onToggleSidebar?: () => void;
}

export function Topbar({ onToggleSidebar }: TopbarProps) {
  const locale = useLocale();

  return (
    <header className="h-14 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-40 flex items-center px-4 gap-3">
      {onToggleSidebar && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 lg:hidden"
          onClick={onToggleSidebar}
        >
          <PanelLeft className="w-4 h-4" />
        </Button>
      )}

      <Link href={`/${locale}`} className="flex items-center gap-2 mr-4">
        <MCloudLogo size={28} />
        <MCloudWordmark />
      </Link>

      <div className="flex-1" />

      <div className="flex items-center gap-1">
        <PlanBadge />
        <LocaleSwitcher />
        <ThemeToggle />
        <div className="ml-1">
          <UserButton
            appearance={{
              elements: {
                avatarBox: "w-8 h-8",
              },
            }}
          />
        </div>
      </div>
    </header>
  );
}
