import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * PixelPanel — a Minecraft-style "stone-bordered" container.
 * Uses chunky 2px borders, no rounding, and a subtle bevel
 * so it reads as a pixel-art panel without needing tile images.
 */
export function PixelPanel({
  children,
  className,
  variant = "stone",
  title,
  icon,
}: {
  children: ReactNode;
  className?: string;
  variant?: "stone" | "wood" | "ore" | "dark";
  title?: string;
  icon?: ReactNode;
}) {
  const palettes = {
    stone: {
      bg: "hsl(var(--card))",
      border: "hsl(var(--border))",
      highlight: "rgba(255,255,255,0.04)",
      shadow: "rgba(0,0,0,0.3)",
    },
    wood: {
      bg: "#3a2818",
      border: "#7a5538",
      highlight: "rgba(154,112,85,0.2)",
      shadow: "rgba(0,0,0,0.4)",
    },
    ore: {
      bg: "rgba(58,154,46,0.06)",
      border: "#5a9a2e",
      highlight: "rgba(90,154,46,0.15)",
      shadow: "rgba(0,0,0,0.3)",
    },
    dark: {
      bg: "rgba(0,0,0,0.45)",
      border: "#3a3a3a",
      highlight: "rgba(255,255,255,0.03)",
      shadow: "rgba(0,0,0,0.5)",
    },
  };
  const p = palettes[variant];

  return (
    <div
      className={cn("relative", className)}
      style={{
        background: p.bg,
        border: `2px solid ${p.border}`,
        borderRadius: 0,
        boxShadow: `inset 1px 1px 0 ${p.highlight}, 3px 3px 0 ${p.shadow}`,
      }}
    >
      {(title || icon) && (
        <div
          className="flex items-center gap-2 px-3 py-2 font-minecraft text-[10px] uppercase tracking-wider"
          style={{ borderBottom: `2px solid ${p.border}`, color: "hsl(var(--muted-foreground))" }}
        >
          {icon}
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * Pixel-art button — chunky, no rounding, has a "pressed" bevel.
 */
export function PixelButton({
  children,
  onClick,
  disabled,
  variant = "default",
  size = "md",
  className,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "green" | "red" | "amber" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  type?: "button" | "submit";
}) {
  const variants = {
    default: { bg: "#3a3a3a", border: "#7d7d7d", text: "#e0e0e0", glow: "#9a9a9a" },
    green:   { bg: "#5a9a2e", border: "#4a7a1e", text: "#ffffff", glow: "#6db535" },
    red:     { bg: "#a31616", border: "#6e0d0d", text: "#ffffff", glow: "#d92424" },
    amber:   { bg: "#b6951e", border: "#7a6210", text: "#ffffff", glow: "#e8c93a" },
    ghost:   { bg: "transparent", border: "#3a3a3a", text: "#9a9a9a", glow: "#5a5a5a" },
  };
  const v = variants[variant];

  const sizes = {
    sm: "text-[8px] px-2 py-1 gap-1",
    md: "text-[10px] px-3 py-1.5 gap-1.5",
    lg: "text-[11px] px-4 py-2.5 gap-2",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "font-minecraft uppercase inline-flex items-center justify-center transition-all active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed",
        sizes[size],
        className
      )}
      style={{
        background: v.bg,
        color: v.text,
        border: `2px solid ${v.border}`,
        borderRadius: 0,
        boxShadow: `inset 1px 1px 0 ${v.glow}, 2px 2px 0 rgba(0,0,0,0.4)`,
      }}
    >
      {children}
    </button>
  );
}

/**
 * PixelSlider — Minecraft-style range input with pixel tracks and a square thumb.
 * Renders the fill as a CSS variable trick so it works without JS.
 */
export function PixelSlider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  format,
  className,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  label?: string;
  format?: (v: number) => string;
  className?: string;
}) {
  const pct = Math.round(((value - min) / (max - min)) * 100);
  const display = format ? format(value) : String(value);

  return (
    <div className={cn("space-y-1.5", className)}>
      {(label || format) && (
        <div className="flex items-center justify-between">
          {label && (
            <span className="text-[10px] font-minecraft uppercase text-muted-foreground">
              {label}
            </span>
          )}
          <span
            className="font-mono text-xs text-foreground px-1.5 py-0.5"
            style={{ background: "rgba(0,0,0,0.35)", border: "1px solid #3a3a3a" }}
          >
            {display}
          </span>
        </div>
      )}
      <div className="relative h-5 flex items-center">
        {/* Track background */}
        <div
          className="absolute inset-x-0 h-3"
          style={{ background: "#1a1a1a", border: "2px solid #3a3a3a" }}
        />
        {/* Fill */}
        <div
          className="absolute h-3 left-0"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, #3e7a1a, #5a9a2e)",
            border: "2px solid #2d5e10",
            borderRight: "none",
            pointerEvents: "none",
          }}
        />
        {/* Native range for interaction — visually hidden but handles all mouse/touch events */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-x-0 w-full opacity-0 cursor-pointer h-5"
          style={{ zIndex: 2 }}
        />
        {/* Pixel thumb indicator */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: `calc(${pct}% - 7px)`,
            width: 14,
            height: 20,
            background: "#c6c6c6",
            border: "2px solid #1a1a1a",
            boxShadow: "inset 1px 1px 0 rgba(255,255,255,0.4)",
            zIndex: 1,
          }}
        />
      </div>
    </div>
  );
}
