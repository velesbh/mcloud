import { cn, formatMb } from "@/lib/utils";

interface UsageBarProps {
  label: string;
  used: number;
  total: number;
  unit?: "mb" | "percent" | "custom";
  formatValue?: (val: number) => string;
  className?: string;
}

export function UsageBar({
  label,
  used,
  total,
  unit = "mb",
  formatValue,
  className,
}: UsageBarProps) {
  const percent = total > 0 ? Math.min(Math.round((used / total) * 100), 100) : 0;

  const fmt = (v: number) => {
    if (formatValue) return formatValue(v);
    if (unit === "mb") return formatMb(v);
    if (unit === "percent") return `${v}%`;
    return String(v);
  };

  const barColor =
    percent > 90 ? "bg-red-500"
    : percent > 70 ? "bg-amber-500"
    : "bg-primary";

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex justify-between items-center text-xs">
        <span className="font-medium text-foreground/80">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {fmt(used)} <span className="text-muted-foreground/60">/ {fmt(total)}</span>
        </span>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700 ease-out", barColor)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
