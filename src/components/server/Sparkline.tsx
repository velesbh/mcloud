"use client";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface Props {
  values: number[];
  max?: number;
  className?: string;
  color?: string;
  fill?: boolean;
  height?: number;
}

// Lightweight inline SVG sparkline — no charting library dependency.
export function Sparkline({
  values,
  max,
  className,
  color = "hsl(142.1 76.2% 36.3%)",
  fill = true,
  height = 56,
}: Props) {
  const { path, area } = useMemo(() => {
    if (values.length === 0) return { path: "", area: "" };
    const width = 100;
    const m = max ?? Math.max(...values, 1);
    const step = values.length > 1 ? width / (values.length - 1) : width;
    const pts = values.map((v, i) => {
      const x = i * step;
      const y = height - (v / m) * (height - 4) - 2;
      return [x, y] as const;
    });
    const d = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(" ");
    const a = `${d} L${width},${height} L0,${height} Z`;
    return { path: d, area: a };
  }, [values, max, height]);

  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      className={cn("w-full", className)}
      preserveAspectRatio="none"
      aria-hidden
    >
      {fill && <path d={area} fill={color} fillOpacity={0.12} />}
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
