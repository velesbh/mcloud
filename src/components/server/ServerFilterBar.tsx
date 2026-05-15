"use client";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FilterStatus = "all" | "running" | "offline";

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  status: FilterStatus;
  onStatusChange: (s: FilterStatus) => void;
  counts: { all: number; running: number; offline: number };
}

const STATUSES: { key: FilterStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "running", label: "Running" },
  { key: "offline", label: "Offline" },
];

export function ServerFilterBar({
  query,
  onQueryChange,
  status,
  onStatusChange,
  counts,
}: Props) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search servers..."
          className="pl-9 pr-9 h-9"
        />
        {query && (
          <button
            onClick={() => onQueryChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 border border-border rounded-md p-0.5">
        {STATUSES.map((s) => (
          <Button
            key={s.key}
            size="sm"
            variant="ghost"
            onClick={() => onStatusChange(s.key)}
            className={cn(
              "h-7 px-3 text-xs font-medium gap-1.5 hover:bg-muted",
              status === s.key && "bg-muted text-foreground"
            )}
          >
            {s.label}
            <span
              className={cn(
                "text-[10px] rounded px-1 py-px",
                status === s.key
                  ? "bg-foreground/10 text-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {counts[s.key]}
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}
