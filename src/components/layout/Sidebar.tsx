"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { MCloudLogo, MCloudWordmark } from "./MCloudLogo";
import {
  LayoutDashboard,
  Server,
  Settings,
  Shield,
  HelpCircle,
  Sparkles,
  UserCircle,
} from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";

const navItems = [
  {
    key: "dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    key: "servers",
    href: "/servers",
    icon: Server,
  },
  {
    key: "upgrade",
    href: "/upgrade",
    icon: Sparkles,
  },
  {
    key: "account",
    href: "/account",
    icon: UserCircle,
  },
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
    <aside className="w-60 flex flex-col h-full bg-[hsl(var(--sidebar-background))] border-r border-[hsl(var(--sidebar-border))]">
      <div className="h-14 flex items-center px-4 gap-2 border-b border-[hsl(var(--sidebar-border))]">
        <MCloudLogo size={28} />
        <MCloudWordmark />
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <Link
            key={item.key}
            href={`${base}${item.href}`}
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              isActive(item.href, item.exact)
                ? "bg-primary/10 text-primary"
                : "text-[hsl(var(--sidebar-foreground))] hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {t(item.key)}
          </Link>
        ))}

        {isAdmin && (
          <>
            <div className="pt-3 pb-1 px-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Admin
              </span>
            </div>
            <Link
              href={`${base}/admin`}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                pathname.startsWith(`${base}/admin`)
                  ? "bg-primary/10 text-primary"
                  : "text-[hsl(var(--sidebar-foreground))] hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Shield className="w-4 h-4 shrink-0" />
              {t("admin")}
            </Link>
          </>
        )}
      </nav>

      <div className="p-2 border-t border-[hsl(var(--sidebar-border))]">
        <p className="text-xs text-muted-foreground text-center px-2">
          © 2026 Enzonic LLC
        </p>
      </div>
    </aside>
  );
}
