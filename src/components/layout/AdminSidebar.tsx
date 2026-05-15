"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { MCloudLogo, MCloudWordmark } from "./MCloudLogo";
import {
  LayoutDashboard,
  Server,
  Network,
  Globe,
  Layers,
  Users,
  ArrowLeft,
  CreditCard,
} from "lucide-react";

const adminNav = [
  { key: "overview", href: "/admin", icon: LayoutDashboard, label: "Overview", exact: true },
  { key: "servers", href: "/admin/servers", icon: Server, label: "Servers" },
  { key: "nodes", href: "/admin/nodes", icon: Network, label: "Nodes" },
  { key: "regions", href: "/admin/regions", icon: Globe, label: "Regions" },
  { key: "allocations", href: "/admin/allocations", icon: Layers, label: "Allocations" },
  { key: "users", href: "/admin/users", icon: Users, label: "Users" },
  { key: "billing", href: "/admin/billing", icon: CreditCard, label: "Billing" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const locale = useLocale();
  const base = `/${locale}`;

  function isActive(href: string, exact?: boolean) {
    const full = `${base}${href}`;
    if (exact) return pathname === full;
    return pathname.startsWith(full);
  }

  return (
    <aside className="w-60 flex flex-col h-full bg-[hsl(var(--sidebar-background))] border-r border-[hsl(var(--sidebar-border))]">
      <div className="h-14 flex items-center px-4 gap-2 border-b border-[hsl(var(--sidebar-border))]">
        <MCloudLogo size={24} />
        <span className="font-bold text-sm text-muted-foreground">Admin</span>
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {adminNav.map((item) => (
          <Link
            key={item.key}
            href={`${base}${item.href}`}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              isActive(item.href, item.exact)
                ? "bg-primary/10 text-primary"
                : "text-[hsl(var(--sidebar-foreground))] hover:bg-accent"
            )}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-2 border-t border-[hsl(var(--sidebar-border))]">
        <Link
          href={`/${locale}/dashboard`}
          className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>
    </aside>
  );
}
