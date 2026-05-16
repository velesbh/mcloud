"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { MCloudLogo } from "./MCloudLogo";
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
    <aside
      className="w-60 flex flex-col h-full"
      style={{
        background: "hsl(var(--sidebar-background))",
        borderRight: "2px solid hsl(var(--sidebar-border))",
      }}
    >
      <div
        className="h-14 flex items-center px-4 gap-2.5 border-b-2"
        style={{
          borderColor: "hsl(var(--sidebar-border))",
          background: "#7a5538",
          boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.3)",
        }}
      >
        <MCloudLogo size={24} />
        <span className="font-minecraft text-[10px] text-white">Admin Panel</span>
      </div>

      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {adminNav.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.key}
              href={`${base}${item.href}`}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors",
                active
                  ? "text-white"
                  : "text-[hsl(var(--sidebar-foreground))] hover:text-foreground"
              )}
              style={
                active
                  ? {
                      background: "#7a5538",
                      boxShadow:
                        "inset -2px -3px 0 rgba(0,0,0,0.4), inset 2px 2px 0 rgba(255,255,255,0.1)",
                      borderRadius: 0,
                    }
                  : { borderRadius: 0 }
              }
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="font-minecraft text-[10px]">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div
        className="p-2 border-t-2"
        style={{ borderColor: "hsl(var(--sidebar-border))" }}
      >
        <Link
          href={`/${locale}/dashboard`}
          className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-minecraft text-[9px]">Back to Dashboard</span>
        </Link>
      </div>
    </aside>
  );
}
