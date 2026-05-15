import { cn, formatMb } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

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
    percent > 90
      ? "bg-red-500"
      : percent > 70
      ? "bg-yellow-500"
      : "bg-green-500";

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex justify-between items-center text-xs text-muted-foreground">
        <span className="font-medium">{label}</span>
        <span>
          {fmt(used)} / {fmt(total)}
        </span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
