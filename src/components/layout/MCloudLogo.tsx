import { cn } from "@/lib/utils";

/** Isometric grass block — pixel-art style */
export function MCloudLogo({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("pixelated", className)}
      aria-label="MCloud"
      style={{ imageRendering: "pixelated" }}
    >
      {/* Top face — grass */}
      <rect x="4"  y="4"  width="24" height="10" fill="#5a9a2e" />
      {/* Grass highlight pixels */}
      <rect x="6"  y="5"  width="3"  height="2"  fill="#6db535" />
      <rect x="12" y="6"  width="2"  height="2"  fill="#6db535" />
      <rect x="18" y="5"  width="4"  height="2"  fill="#6db535" />
      <rect x="23" y="6"  width="3"  height="2"  fill="#4a7a1e" />
      <rect x="6"  y="8"  width="2"  height="2"  fill="#4a7a1e" />
      <rect x="15" y="9"  width="3"  height="1"  fill="#6db535" />

      {/* Dirt side */}
      <rect x="4"  y="14" width="24" height="14" fill="#866043" />
      {/* Dirt texture */}
      <rect x="6"  y="16" width="3"  height="2"  fill="#7a5538" opacity="0.7" />
      <rect x="14" y="18" width="4"  height="2"  fill="#7a5538" opacity="0.7" />
      <rect x="8"  y="22" width="3"  height="2"  fill="#9a7055" opacity="0.4" />
      <rect x="20" y="20" width="4"  height="2"  fill="#7a5538" opacity="0.7" />
      <rect x="11" y="25" width="5"  height="2"  fill="#7a5538" opacity="0.5" />
      <rect x="22" y="24" width="3"  height="2"  fill="#9a7055" opacity="0.4" />

      {/* Grass side border */}
      <rect x="4"  y="13" width="24" height="2"  fill="#3e7a1a" />

      {/* Block edge highlights */}
      <rect x="4"  y="4"  width="1"  height="24" fill="rgba(255,255,255,0.15)" />
      <rect x="4"  y="4"  width="24" height="1"  fill="rgba(255,255,255,0.2)" />
      <rect x="27" y="4"  width="1"  height="24" fill="rgba(0,0,0,0.3)" />
      <rect x="4"  y="27" width="24" height="1"  fill="rgba(0,0,0,0.4)" />
    </svg>
  );
}

export function MCloudWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-minecraft text-sm tracking-tight text-foreground",
        className
      )}
    >
      M<span className="text-primary">Cloud</span>
    </span>
  );
}
