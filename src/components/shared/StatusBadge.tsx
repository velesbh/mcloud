import { cn } from "@/lib/utils";
import { SERVER_STATUS_LABELS } from "@/lib/constants";

interface StatusBadgeProps {
  status: string;
  className?: string;
  showDot?: boolean;
}

// Refined modern pill colors (used both dot + bg/text)
const STYLES: Record<string, { wrap: string; dot: string; pulse: boolean }> = {
  running:    { wrap: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20", dot: "bg-emerald-500", pulse: false },
  starting:   { wrap: "bg-amber-500/10  text-amber-600  dark:text-amber-400  ring-amber-500/20",  dot: "bg-amber-500",  pulse: true  },
  restarting: { wrap: "bg-amber-500/10  text-amber-600  dark:text-amber-400  ring-amber-500/20",  dot: "bg-amber-500",  pulse: true  },
  stopping:   { wrap: "bg-amber-500/10  text-amber-600  dark:text-amber-400  ring-amber-500/20",  dot: "bg-amber-500",  pulse: true  },
  offline:    { wrap: "bg-zinc-500/10   text-zinc-600   dark:text-zinc-400   ring-zinc-500/20",   dot: "bg-zinc-400",   pulse: false },
  error:      { wrap: "bg-red-500/10    text-red-600    dark:text-red-400    ring-red-500/20",    dot: "bg-red-500",    pulse: false },
  suspended:  { wrap: "bg-orange-500/10 text-orange-600 dark:text-orange-400 ring-orange-500/20", dot: "bg-orange-500", pulse: false },
  creating:   { wrap: "bg-sky-500/10    text-sky-600    dark:text-sky-400    ring-sky-500/20",    dot: "bg-sky-500",    pulse: true  },
  hibernated: { wrap: "bg-violet-500/10 text-violet-600 dark:text-violet-400 ring-violet-500/20", dot: "bg-violet-500", pulse: false },
};

export function StatusBadge({ status, className, showDot = true }: StatusBadgeProps) {
  const s = STYLES[status] ?? STYLES.offline;
  const label = SERVER_STATUS_LABELS[status] ?? status;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        s.wrap,
        className
      )}
    >
      {showDot && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          {s.pulse && (
            <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping", s.dot)} />
          )}
          <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", s.dot)} />
        </span>
      )}
      {label}
    </span>
  );
}
