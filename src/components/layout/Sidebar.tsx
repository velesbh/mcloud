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
  { key: "dashboard", href: "/dashboard", Icon: GrassBlock,  exact: true },
  { key: "servers",   href: "/servers",   Icon: ServerBlock },
  { key: "upgrade",   href: "/upgrade",   Icon: StarIcon },
  { key: "account",   href: "/account",   Icon: UserHead },
];

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const locale   = useLocale();
  const t        = useTranslations("nav");
  const isAdmin  = useAdmin();
  const base     = `/${locale}`;

  function isActive(href: string, exact?: boolean) {
    const full = `${base}${href}`;
    if (exact) return pathname === full;
    return pathname.startsWith(full);
  }

  return (
    <aside
      className="w-60 flex flex-col h-full"
      style={{
        background: "hsl(var(--sidebar-background))",
        borderRight: "2px solid hsl(var(--sidebar-border))",
      }}
    >
      {/* Header — dirt strip */}
      <div
        className="h-14 flex items-center px-4 gap-2.5 border-b-2"
        style={{
          borderColor: "hsl(var(--sidebar-border))",
          background:
            "linear-gradient(to bottom, #5a9a2e 0%, #5a9a2e 18%, #3e6a18 24%, #866043 24%, #7a5538 100%)",
          boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.3)",
        }}
      >
        <MCloudLogo size={26} />
        <MCloudWordmark className="text-white [&>span]:text-[#a8e060]" />
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.key}
              href={`${base}${item.href}`}
              onClick={onClose}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors select-none",
                active
                  ? "text-white font-semibold"
                  : "text-[hsl(var(--sidebar-foreground))] hover:text-foreground"
              )}
              style={
                active
                  ? {
                      background: "#5a9a2e",
                      boxShadow:
                        "inset -2px -3px 0 rgba(0,0,0,0.4), inset 2px 2px 0 rgba(255,255,255,0.15)",
                      borderRadius: 0,
                    }
                  : { borderRadius: 0 }
              }
            >
              <item.Icon size={18} />
              <span className="font-minecraft text-[10px]">{t(item.key)}</span>
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <div className="pt-4 pb-1 px-2">
              <div className="h-px w-full" style={{ background: "hsl(var(--sidebar-border))" }} />
              <span
                className="block mt-2 font-minecraft text-[8px] px-1 uppercase tracking-wider"
                style={{ color: "#9a7055" }}
              >
                ▸ admin
              </span>
            </div>
            <Link
              href={`${base}/admin`}
              onClick={onClose}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors",
                pathname.startsWith(`${base}/admin`)
                  ? "text-white font-semibold"
                  : "text-[hsl(var(--sidebar-foreground))] hover:text-foreground"
              )}
              style={
                pathname.startsWith(`${base}/admin`)
                  ? {
                      background: "#7a5538",
                      boxShadow:
                        "inset -2px -3px 0 rgba(0,0,0,0.4), inset 2px 2px 0 rgba(255,255,255,0.08)",
                      borderRadius: 0,
                    }
                  : { borderRadius: 0 }
              }
            >
              <ShieldIcon size={18} />
              <span className="font-minecraft text-[10px]">{t("admin")}</span>
            </Link>
          </>
        )}
      </nav>

      {/* Footer */}
      <div
        className="px-3 py-3 border-t-2 flex items-center justify-center gap-2"
        style={{ borderColor: "hsl(var(--sidebar-border))" }}
      >
        <p className="font-minecraft text-[8px] text-muted-foreground">© 2026 Enzonic</p>
      </div>
    </aside>
  );
}
