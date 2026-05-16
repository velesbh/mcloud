"use client";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Terminal, FolderOpen, Package, Archive, Settings, LayoutDashboard, ChevronLeft, BarChart3, Globe, Network } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { use } from "react";

const tabs = [
  { key: "overview", label: "Overview", icon: LayoutDashboard, href: "" },
  { key: "analytics", label: "Analytics", icon: BarChart3, href: "/analytics" },
  { key: "console", label: "Console", icon: Terminal, href: "/console" },
  { key: "files", label: "Files", icon: FolderOpen, href: "/files" },
  { key: "worlds", label: "Worlds", icon: Globe, href: "/worlds" },
  { key: "mods", label: "Mods", icon: Package, href: "/mods" },
  { key: "ports", label: "Ports", icon: Network, href: "/ports" },
  { key: "backups", label: "Backups", icon: Archive, href: "/backups" },
  { key: "settings", label: "Settings", icon: Settings, href: "/settings" },
];

export default function ServerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const locale = useLocale();
  const pathname = usePathname();
  const base = `/${locale}/servers/${id}`;

  const { data: server } = useQuery({
    queryKey: ["server", id],
    queryFn: () => fetch(`/api/servers/${id}`).then((r) => r.json()),
  });

  function isActive(href: string) {
    const full = `${base}${href}`;
    if (href === "") return pathname === full;
    return pathname.startsWith(full);
  }

  return (
    <div className="space-y-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4">
        <Link
          href={`/${locale}`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Servers
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium text-foreground">
          {server?.name ?? "Loading..."}
        </span>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto pb-0">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={`${base}${tab.href}`}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
              isActive(tab.href)
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </Link>
        ))}
      </div>

      {children}
    </div>
  );
}
