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
  Boxes,
} from "lucide-react";

const adminNav = [
  { key: "overview",    href: "/admin",             icon: LayoutDashboard, label: "Overview", exact: true },
  { key: "stock",       href: "/admin/stock",       icon: Boxes,           label: "Stock" },
  { key: "servers",     href: "/admin/servers",     icon: Server,          label: "Servers" },
  { key: "nodes",       href: "/admin/nodes",       icon: Network,         label: "Nodes" },
  { key: "regions",     href: "/admin/regions",     icon: Globe,           label: "Regions" },
  { key: "allocations", href: "/admin/allocations", icon: Layers,          label: "Allocations" },
  { key: "users",       href: "/admin/users",       icon: Users,           label: "Users" },
  { key: "billing",     href: "/admin/billing",     icon: CreditCard,      label: "Billing" },
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
    <aside className="w-64 flex flex-col h-full bg-[hsl(var(--sidebar-background))] border-r border-[hsl(var(--sidebar-border))]">
      {/* Brand */}
      <div className="h-16 flex items-center px-5 gap-3">
        <MCloudLogo size={28} />
        <div className="flex flex-col leading-tight">
          <MCloudWordmark />
          <span className="text-pixel text-primary uppercase">Admin</span>
        </div>
      </div>

      <nav className="flex-1 px-3 pt-2 pb-4 space-y-0.5 overflow-y-auto">
        {adminNav.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.key}
              href={`${base}${item.href}`}
              className={cn(
                "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                active
                  ? "bg-primary/12 text-primary"
                  : "text-[hsl(var(--sidebar-foreground))] hover:bg-foreground/5"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-primary" />
              )}
              <item.icon className="w-5 h-5 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-[hsl(var(--sidebar-border))]">
        <Link
          href={`/${locale}/dashboard`}
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>
      </div>
    </aside>
  );
}
