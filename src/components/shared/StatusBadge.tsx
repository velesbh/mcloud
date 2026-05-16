import { cn, getStatusDotColor } from "@/lib/utils";
import { SERVER_STATUS_LABELS } from "@/lib/constants";

interface StatusBadgeProps {
  status: string;
  className?: string;
  showDot?: boolean;
}

const STYLES: Record<string, string> = {
  running:    "bg-green-500/10 text-green-400 border-green-500/40",
  starting:   "bg-yellow-500/10 text-yellow-400 border-yellow-500/40",
  restarting: "bg-yellow-500/10 text-yellow-400 border-yellow-500/40",
  stopping:   "bg-yellow-500/10 text-yellow-400 border-yellow-500/40",
  offline:    "bg-zinc-500/10 text-zinc-400 border-zinc-500/40",
  error:      "bg-red-500/10 text-red-400 border-red-500/40",
  suspended:  "bg-orange-500/10 text-orange-400 border-orange-500/40",
  creating:   "bg-blue-500/10 text-blue-400 border-blue-500/40",
  hibernated: "bg-amber-700/15 text-amber-300 border-amber-700/40",
};

export function StatusBadge({ status, className, showDot = true }: StatusBadgeProps) {
  const dotColor = getStatusDotColor(status);
  const label = SERVER_STATUS_LABELS[status] ?? status;
  const isAnimated = status === "starting" || status === "stopping" || status === "restarting";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-minecraft text-[9px] px-2 py-1 border",
        STYLES[status] ?? "bg-zinc-500/10 text-zinc-400 border-zinc-500/40",
        className
      )}
      style={{ borderRadius: 0 }}
    >
      {showDot && (
        <span
          className={cn("w-1.5 h-1.5 shrink-0", dotColor, isAnimated && "animate-pulse")}
        />
      )}
      {label}
    </span>
  );
}
