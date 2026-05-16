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
    <header className="h-16 sticky top-0 z-40 glass border-b border-border/60 flex items-center px-5 gap-3">
      {onToggleSidebar && (
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full lg:hidden"
          onClick={onToggleSidebar}
        >
          <PanelLeft className="w-4 h-4" />
        </Button>
      )}

      <Link href={`/${locale}`} className="flex items-center gap-2.5 lg:hidden">
        <MCloudLogo size={26} />
        <MCloudWordmark />
      </Link>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <PlanBadge />
        <LocaleSwitcher />
        <ThemeToggle />
        <div className="ml-1 pl-2 border-l border-border/60">
          <UserButton
            appearance={{
              elements: {
                avatarBox: "w-8 h-8 rounded-full",
              },
            }}
          />
        </div>
      </div>
    </header>
  );
}
