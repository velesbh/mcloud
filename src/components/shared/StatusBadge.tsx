import { cn, getStatusDotColor } from "@/lib/utils";
import { SERVER_STATUS_LABELS } from "@/lib/constants";

interface StatusBadgeProps {
  status: string;
  className?: string;
  showDot?: boolean;
}

export function StatusBadge({ status, className, showDot = true }: StatusBadgeProps) {
  const dotColor = getStatusDotColor(status);
  const label = SERVER_STATUS_LABELS[status] ?? status;
  const isAnimated = status === "starting" || status === "stopping" || status === "restarting";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full",
        status === "running" && "bg-green-500/10 text-green-400",
        (status === "starting" || status === "restarting") && "bg-yellow-500/10 text-yellow-400",
        status === "offline" && "bg-zinc-500/10 text-zinc-400",
        status === "error" && "bg-red-500/10 text-red-400",
        status === "suspended" && "bg-orange-500/10 text-orange-400",
        status === "stopping" && "bg-yellow-500/10 text-yellow-400",
        status === "creating" && "bg-blue-500/10 text-blue-400",
        className
      )}
    >
      {showDot && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0",
            dotColor,
            isAnimated && "animate-pulse"
          )}
        />
      )}
      {label}
    </span>
  );
}
