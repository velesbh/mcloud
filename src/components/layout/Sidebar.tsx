"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { MCloudLogo, MCloudWordmark } from "./MCloudLogo";
import {
  GrassBlock,
  ServerBlock,
  StarIcon,
  UserHead,
  ShieldIcon,
} from "@/components/pixel/Block";
import { useAdmin } from "@/hooks/useAdmin";
import type { ComponentType } from "react";

interface NavItem {
  key: string;
  href: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
  exact?: boolean;
}

const navItems: NavItem[] = [
  { key: "dashboard", href: "/dashboard", Icon: GrassBlock, exact: true },
  { key: "servers",   href: "/servers",   Icon: ServerBlock },
  { key: "upgrade",   href: "/upgrade",   Icon: StarIcon },
  { key: "account",   href: "/account",   Icon: UserHead },
];

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("nav");
  const isAdmin = useAdmin();
  const base = `/${locale}`;

  function isActive(href: string, exact?: boolean) {
    const full = `${base}${href}`;
    if (exact) return pathname === full;
    return pathname.startsWith(full);
  }

  return (
    <aside className="w-64 flex flex-col h-full bg-[hsl(var(--sidebar-background))] border-r border-[hsl(var(--sidebar-border))]">
      {/* Brand */}
      <div className="h-16 flex items-center px-5 gap-3">
        <MCloudLogo size={28} />
        <MCloudWordmark />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 pt-2 pb-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.key}
              href={`${base}${item.href}`}
              onClick={onClose}
              className={cn(
                "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium select-none transition-all",
                active
                  ? "bg-primary/12 text-primary"
                  : "text-[hsl(var(--sidebar-foreground))] hover:bg-foreground/5"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-primary" />
              )}
              <item.Icon size={20} />
              <span>{t(item.key)}</span>
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <div className="pt-5 pb-1 px-3">
              <p className="text-pixel text-muted-foreground/70 uppercase">Admin</p>
            </div>
            <Link
              href={`${base}/admin`}
              onClick={onClose}
              className={cn(
                "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                pathname.startsWith(`${base}/admin`)
                  ? "bg-primary/12 text-primary"
                  : "text-[hsl(var(--sidebar-foreground))] hover:bg-foreground/5"
              )}
            >
              {pathname.startsWith(`${base}/admin`) && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-primary" />
              )}
              <ShieldIcon size={20} />
              <span>{t("admin")}</span>
            </Link>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-[hsl(var(--sidebar-border))]">
        <p className="text-pixel text-muted-foreground/60">© 2026 Enzonic</p>
      </div>
    </aside>
  );
}
