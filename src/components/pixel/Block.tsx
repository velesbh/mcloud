/**
 * Pixel-art block icon set — hand-drawn 16×16 SVGs.
 *
 * Each block is a 16×16 grid of `<rect>` pixels. Drawn at integer
 * coordinates, no anti-aliasing (use shape-rendering="crispEdges"),
 * scales cleanly to any size with image-rendering: pixelated.
 *
 * Naming follows Minecraft: GrassBlock, DirtBlock, StoneBlock, etc.
 */
import { cn } from "@/lib/utils";

type BlockProps = { size?: number; className?: string };

const baseProps = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 16 16",
  xmlns: "http://www.w3.org/2000/svg",
  shapeRendering: "crispEdges" as const,
  style: { imageRendering: "pixelated" as const },
});

/* ───────── helpers ───────── */
function P({ x, y, w = 1, h = 1, c }: { x: number; y: number; w?: number; h?: number; c: string }) {
  return <rect x={x} y={y} width={w} height={h} fill={c} />;
}

/* ═════════════════════════════════════════
   GRASS BLOCK  (the classic)
   ═════════════════════════════════════════ */
export function GrassBlock({ size = 24, className }: BlockProps) {
  return (
    <svg {...baseProps(size)} className={cn(className)} aria-label="grass block">
      {/* Top grass face */}
      <P x={0}  y={0}  w={16} h={4}  c="#5a9a2e" />
      <P x={1}  y={1}  w={2}  h={1}  c="#6db535" />
      <P x={5}  y={1}  w={3}  h={1}  c="#6db535" />
      <P x={10} y={2}  w={2}  h={1}  c="#6db535" />
      <P x={13} y={1}  w={2}  h={1}  c="#4a7a1e" />
      <P x={3}  y={3}  w={1}  h={1}  c="#4a7a1e" />
      <P x={9}  y={3}  w={2}  h={1}  c="#4a7a1e" />
      {/* Grass-dirt border */}
      <P x={0}  y={4}  w={16} h={1}  c="#3e6a18" />
      {/* Dirt body */}
      <P x={0}  y={5}  w={16} h={11} c="#866043" />
      <P x={2}  y={6}  w={2}  h={1}  c="#9a7055" />
      <P x={5}  y={7}  w={1}  h={1}  c="#9a7055" />
      <P x={9}  y={6}  w={3}  h={1}  c="#9a7055" />
      <P x={13} y={8}  w={2}  h={1}  c="#9a7055" />
      <P x={1}  y={10} w={3}  h={1}  c="#7a5538" />
      <P x={6}  y={11} w={2}  h={1}  c="#7a5538" />
      <P x={11} y={12} w={3}  h={1}  c="#7a5538" />
      <P x={3}  y={14} w={2}  h={1}  c="#9a7055" />
      <P x={8}  y={14} w={4}  h={1}  c="#7a5538" />
    </svg>
  );
}

/* ═════════════════════════════════════════
   DIRT BLOCK
   ═════════════════════════════════════════ */
export function DirtBlock({ size = 24, className }: BlockProps) {
  return (
    <svg {...baseProps(size)} className={cn(className)} aria-label="dirt block">
      <P x={0}  y={0}  w={16} h={16} c="#866043" />
      <P x={1}  y={1}  w={3}  h={1}  c="#9a7055" />
      <P x={6}  y={2}  w={2}  h={1}  c="#9a7055" />
      <P x={10} y={1}  w={3}  h={1}  c="#7a5538" />
      <P x={2}  y={4}  w={1}  h={1}  c="#7a5538" />
      <P x={7}  y={5}  w={3}  h={1}  c="#7a5538" />
      <P x={12} y={4}  w={2}  h={1}  c="#9a7055" />
      <P x={3}  y={7}  w={2}  h={1}  c="#9a7055" />
      <P x={9}  y={8}  w={2}  h={1}  c="#7a5538" />
      <P x={1}  y={10} w={3}  h={1}  c="#7a5538" />
      <P x={6}  y={11} w={4}  h={1}  c="#9a7055" />
      <P x={12} y={11} w={2}  h={1}  c="#7a5538" />
      <P x={2}  y={13} w={2}  h={1}  c="#9a7055" />
      <P x={8}  y={14} w={3}  h={1}  c="#7a5538" />
    </svg>
  );
}

/* ═════════════════════════════════════════
   STONE BLOCK
   ═════════════════════════════════════════ */
export function StoneBlock({ size = 24, className }: BlockProps) {
  return (
    <svg {...baseProps(size)} className={cn(className)} aria-label="stone block">
      <P x={0}  y={0}  w={16} h={16} c="#7d7d7d" />
      <P x={1}  y={2}  w={2}  h={1}  c="#9a9a9a" />
      <P x={6}  y={1}  w={3}  h={1}  c="#9a9a9a" />
      <P x={11} y={3}  w={2}  h={1}  c="#9a9a9a" />
      <P x={3}  y={5}  w={1}  h={1}  c="#5e5e5e" />
      <P x={8}  y={6}  w={2}  h={1}  c="#5e5e5e" />
      <P x={13} y={6}  w={2}  h={1}  c="#5e5e5e" />
      <P x={2}  y={9}  w={3}  h={1}  c="#9a9a9a" />
      <P x={7}  y={10} w={1}  h={1}  c="#5e5e5e" />
      <P x={11} y={9}  w={3}  h={1}  c="#9a9a9a" />
      <P x={4}  y={12} w={2}  h={1}  c="#5e5e5e" />
      <P x={9}  y={13} w={3}  h={1}  c="#9a9a9a" />
    </svg>
  );
}

/* ═════════════════════════════════════════
   DIAMOND BLOCK
   ═════════════════════════════════════════ */
export function DiamondBlock({ size = 24, className }: BlockProps) {
  return (
    <svg {...baseProps(size)} className={cn(className)} aria-label="diamond block">
      <P x={0}  y={0}  w={16} h={16} c="#4abdc7" />
      {/* Highlights */}
      <P x={0}  y={0}  w={16} h={1}  c="#8fe7ed" />
      <P x={0}  y={0}  w={1}  h={16} c="#8fe7ed" />
      <P x={15} y={0}  w={1}  h={16} c="#2d8a93" />
      <P x={0}  y={15} w={16} h={1}  c="#2d8a93" />
      {/* Diamond facets */}
      <P x={3}  y={3}  w={2}  h={1}  c="#a5f0f5" />
      <P x={3}  y={4}  w={1}  h={1}  c="#a5f0f5" />
      <P x={11} y={4}  w={2}  h={1}  c="#a5f0f5" />
      <P x={12} y={5}  w={1}  h={1}  c="#a5f0f5" />
      <P x={6}  y={10} w={2}  h={1}  c="#2d8a93" />
      <P x={4}  y={11} w={1}  h={1}  c="#2d8a93" />
      <P x={11} y={11} w={2}  h={1}  c="#2d8a93" />
    </svg>
  );
}

/* ═════════════════════════════════════════
   GOLD BLOCK
   ═════════════════════════════════════════ */
export function GoldBlock({ size = 24, className }: BlockProps) {
  return (
    <svg {...baseProps(size)} className={cn(className)} aria-label="gold block">
      <P x={0}  y={0}  w={16} h={16} c="#e8c93a" />
      <P x={0}  y={0}  w={16} h={1}  c="#fff071" />
      <P x={0}  y={0}  w={1}  h={16} c="#fff071" />
      <P x={15} y={0}  w={1}  h={16} c="#b6951e" />
      <P x={0}  y={15} w={16} h={1}  c="#b6951e" />
      <P x={3}  y={4}  w={2}  h={1}  c="#fff071" />
      <P x={10} y={3}  w={3}  h={1}  c="#fff071" />
      <P x={5}  y={11} w={4}  h={1}  c="#b6951e" />
      <P x={11} y={10} w={2}  h={1}  c="#b6951e" />
    </svg>
  );
}

/* ═════════════════════════════════════════
   REDSTONE BLOCK
   ═════════════════════════════════════════ */
export function RedstoneBlock({ size = 24, className }: BlockProps) {
  return (
    <svg {...baseProps(size)} className={cn(className)} aria-label="redstone block">
      <P x={0}  y={0}  w={16} h={16} c="#a31616" />
      <P x={0}  y={0}  w={16} h={1}  c="#d92424" />
      <P x={0}  y={0}  w={1}  h={16} c="#d92424" />
      <P x={15} y={0}  w={1}  h={16} c="#6e0d0d" />
      <P x={0}  y={15} w={16} h={1}  c="#6e0d0d" />
      <P x={3}  y={4}  w={1}  h={1}  c="#ff5555" />
      <P x={11} y={5}  w={2}  h={1}  c="#ff5555" />
      <P x={6}  y={11} w={1}  h={1}  c="#ff5555" />
      <P x={5}  y={8}  w={1}  h={1}  c="#6e0d0d" />
      <P x={10} y={11} w={2}  h={1}  c="#6e0d0d" />
    </svg>
  );
}

/* ═════════════════════════════════════════
   CHEST (treasure / loot)
   ═════════════════════════════════════════ */
export function ChestBlock({ size = 24, className }: BlockProps) {
  return (
    <svg {...baseProps(size)} className={cn(className)} aria-label="chest">
      {/* Base wood */}
      <P x={1}  y={3}  w={14} h={12} c="#7a5538" />
      <P x={1}  y={3}  w={14} h={1}  c="#9a7055" />
      <P x={1}  y={14} w={14} h={1}  c="#4d3622" />
      <P x={1}  y={4}  w={1}  h={11} c="#9a7055" />
      <P x={14} y={4}  w={1}  h={11} c="#4d3622" />
      {/* Top lid divider */}
      <P x={1}  y={7}  w={14} h={1}  c="#4d3622" />
      <P x={1}  y={8}  w={14} h={1}  c="#9a7055" />
      {/* Latch */}
      <P x={7}  y={5}  w={2}  h={5}  c="#3a3a3a" />
      <P x={7}  y={5}  w={2}  h={1}  c="#888888" />
      <P x={7}  y={9}  w={2}  h={1}  c="#1a1a1a" />
      {/* Wood grain */}
      <P x={3}  y={5}  w={1}  h={1}  c="#4d3622" />
      <P x={11} y={6}  w={1}  h={1}  c="#4d3622" />
      <P x={4}  y={11} w={1}  h={1}  c="#4d3622" />
      <P x={12} y={12} w={1}  h={1}  c="#4d3622" />
    </svg>
  );
}

/* ═════════════════════════════════════════
   PICKAXE (action / mine)
   ═════════════════════════════════════════ */
export function PickaxeIcon({ size = 24, className }: BlockProps) {
  return (
    <svg {...baseProps(size)} className={cn(className)} aria-label="pickaxe">
      {/* Head — iron */}
      <P x={2}  y={2}  w={12} h={2}  c="#bfbfbf" />
      <P x={2}  y={2}  w={12} h={1}  c="#e0e0e0" />
      <P x={1}  y={3}  w={1}  h={1}  c="#bfbfbf" />
      <P x={14} y={3}  w={1}  h={1}  c="#bfbfbf" />
      <P x={2}  y={4}  w={12} h={1}  c="#7d7d7d" />
      {/* Handle */}
      <P x={7}  y={5}  w={2}  h={1}  c="#7a5538" />
      <P x={8}  y={6}  w={2}  h={1}  c="#7a5538" />
      <P x={9}  y={7}  w={2}  h={1}  c="#7a5538" />
      <P x={10} y={8}  w={2}  h={1}  c="#7a5538" />
      <P x={11} y={9}  w={2}  h={1}  c="#7a5538" />
      <P x={12} y={10} w={2}  h={1}  c="#7a5538" />
      <P x={13} y={11} w={2}  h={1}  c="#7a5538" />
      <P x={13} y={12} w={2}  h={1}  c="#7a5538" />
      <P x={14} y={13} w={1}  h={1}  c="#7a5538" />
      {/* Handle dark */}
      <P x={8}  y={6}  w={1}  h={1}  c="#4d3622" />
      <P x={10} y={8}  w={1}  h={1}  c="#4d3622" />
      <P x={12} y={10} w={1}  h={1}  c="#4d3622" />
    </svg>
  );
}

/* ═════════════════════════════════════════
   SWORD
   ═════════════════════════════════════════ */
export function SwordIcon({ size = 24, className }: BlockProps) {
  return (
    <svg {...baseProps(size)} className={cn(className)} aria-label="sword">
      <P x={11} y={2}  w={3}  h={1}  c="#bfbfbf" />
      <P x={11} y={3}  w={1}  h={1}  c="#bfbfbf" />
      <P x={10} y={3}  w={2}  h={2}  c="#e0e0e0" />
      <P x={10} y={4}  w={1}  h={1}  c="#bfbfbf" />
      <P x={9}  y={5}  w={2}  h={1}  c="#e0e0e0" />
      <P x={8}  y={6}  w={2}  h={1}  c="#e0e0e0" />
      <P x={7}  y={7}  w={2}  h={1}  c="#e0e0e0" />
      <P x={6}  y={8}  w={2}  h={1}  c="#e0e0e0" />
      <P x={5}  y={9}  w={2}  h={1}  c="#bfbfbf" />
      <P x={4}  y={10} w={2}  h={1}  c="#bfbfbf" />
      {/* Cross-guard */}
      <P x={3}  y={9}  w={1}  h={3}  c="#7a5538" />
      <P x={4}  y={11} w={1}  h={2}  c="#7a5538" />
      <P x={6}  y={11} w={1}  h={2}  c="#7a5538" />
      <P x={3}  y={11} w={4}  h={1}  c="#4d3622" />
      {/* Hilt */}
      <P x={2}  y={12} w={2}  h={1}  c="#4d3622" />
      <P x={1}  y={13} w={2}  h={1}  c="#4d3622" />
    </svg>
  );
}

/* ═════════════════════════════════════════
   HEART (health)
   ═════════════════════════════════════════ */
export function HeartIcon({ size = 24, className }: BlockProps) {
  return (
    <svg {...baseProps(size)} className={cn(className)} aria-label="heart">
      <P x={2}  y={2}  w={4}  h={1}  c="#d92424" />
      <P x={10} y={2}  w={4}  h={1}  c="#d92424" />
      <P x={1}  y={3}  w={6}  h={1}  c="#ff5555" />
      <P x={9}  y={3}  w={6}  h={1}  c="#ff5555" />
      <P x={2}  y={3}  w={2}  h={1}  c="#ffaaaa" />
      <P x={10} y={3}  w={2}  h={1}  c="#ffaaaa" />
      <P x={1}  y={4}  w={14} h={3}  c="#ff5555" />
      <P x={2}  y={4}  w={2}  h={1}  c="#ffaaaa" />
      <P x={1}  y={5}  w={1}  h={1}  c="#ffaaaa" />
      <P x={2}  y={7}  w={12} h={1}  c="#d92424" />
      <P x={3}  y={8}  w={10} h={1}  c="#d92424" />
      <P x={4}  y={9}  w={8}  h={1}  c="#a31616" />
      <P x={5}  y={10} w={6}  h={1}  c="#a31616" />
      <P x={6}  y={11} w={4}  h={1}  c="#6e0d0d" />
      <P x={7}  y={12} w={2}  h={1}  c="#6e0d0d" />
    </svg>
  );
}

/* ═════════════════════════════════════════
   CREEPER FACE
   ═════════════════════════════════════════ */
export function CreeperIcon({ size = 24, className }: BlockProps) {
  return (
    <svg {...baseProps(size)} className={cn(className)} aria-label="creeper">
      <P x={0}  y={0}  w={16} h={16} c="#5a9a2e" />
      <P x={1}  y={1}  w={2}  h={2}  c="#6db535" />
      <P x={13} y={2}  w={2}  h={2}  c="#4a7a1e" />
      <P x={6}  y={6}  w={1}  h={1}  c="#6db535" />
      {/* Eyes */}
      <P x={3}  y={4}  w={3}  h={3}  c="#1a1a1a" />
      <P x={10} y={4}  w={3}  h={3}  c="#1a1a1a" />
      {/* Mouth */}
      <P x={6}  y={8}  w={4}  h={2}  c="#1a1a1a" />
      <P x={5}  y={10} w={2}  h={3}  c="#1a1a1a" />
      <P x={9}  y={10} w={2}  h={3}  c="#1a1a1a" />
      <P x={6}  y={12} w={4}  h={1}  c="#1a1a1a" />
    </svg>
  );
}

/* ═════════════════════════════════════════
   SERVER (rack / computer)
   ═════════════════════════════════════════ */
export function ServerBlock({ size = 24, className }: BlockProps) {
  return (
    <svg {...baseProps(size)} className={cn(className)} aria-label="server">
      <P x={1}  y={2}  w={14} h={3}  c="#3a3a3a" />
      <P x={1}  y={2}  w={14} h={1}  c="#5a5a5a" />
      <P x={1}  y={4}  w={14} h={1}  c="#1a1a1a" />
      <P x={3}  y={3}  w={1}  h={1}  c="#5a9a2e" />
      <P x={5}  y={3}  w={1}  h={1}  c="#e8c93a" />
      <P x={1}  y={6}  w={14} h={3}  c="#3a3a3a" />
      <P x={1}  y={6}  w={14} h={1}  c="#5a5a5a" />
      <P x={1}  y={8}  w={14} h={1}  c="#1a1a1a" />
      <P x={3}  y={7}  w={1}  h={1}  c="#5a9a2e" />
      <P x={5}  y={7}  w={1}  h={1}  c="#5a9a2e" />
      <P x={1}  y={10} w={14} h={3}  c="#3a3a3a" />
      <P x={1}  y={10} w={14} h={1}  c="#5a5a5a" />
      <P x={1}  y={12} w={14} h={1}  c="#1a1a1a" />
      <P x={3}  y={11} w={1}  h={1}  c="#d92424" />
      <P x={5}  y={11} w={1}  h={1}  c="#5a9a2e" />
    </svg>
  );
}

/* ═════════════════════════════════════════
   COMPASS (region / location)
   ═════════════════════════════════════════ */
export function CompassIcon({ size = 24, className }: BlockProps) {
  return (
    <svg {...baseProps(size)} className={cn(className)} aria-label="compass">
      <P x={5}  y={2}  w={6}  h={1}  c="#7d7d7d" />
      <P x={3}  y={3}  w={2}  h={1}  c="#7d7d7d" />
      <P x={11} y={3}  w={2}  h={1}  c="#7d7d7d" />
      <P x={2}  y={5}  w={1}  h={6}  c="#7d7d7d" />
      <P x={13} y={5}  w={1}  h={6}  c="#7d7d7d" />
      <P x={3}  y={4}  w={1}  h={1}  c="#9a9a9a" />
      <P x={4}  y={3}  w={1}  h={1}  c="#9a9a9a" />
      <P x={3}  y={12} w={2}  h={1}  c="#7d7d7d" />
      <P x={11} y={12} w={2}  h={1}  c="#7d7d7d" />
      <P x={5}  y={13} w={6}  h={1}  c="#7d7d7d" />
      {/* Inside */}
      <P x={4}  y={4}  w={8}  h={9}  c="#cccccc" />
      {/* Needle */}
      <P x={7}  y={4}  w={2}  h={4}  c="#d92424" />
      <P x={7}  y={8}  w={2}  h={4}  c="#ffffff" />
      <P x={8}  y={4}  w={1}  h={4}  c="#a31616" />
    </svg>
  );
}

/* ═════════════════════════════════════════
   ENDER EYE / PORTAL (admin)
   ═════════════════════════════════════════ */
export function EnderEye({ size = 24, className }: BlockProps) {
  return (
    <svg {...baseProps(size)} className={cn(className)} aria-label="ender eye">
      <P x={3}  y={3}  w={10} h={10} c="#1a4a3a" />
      <P x={3}  y={3}  w={10} h={1}  c="#3aaa7a" />
      <P x={3}  y={3}  w={1}  h={10} c="#3aaa7a" />
      <P x={12} y={3}  w={1}  h={10} c="#0a2a1f" />
      <P x={3}  y={12} w={10} h={1}  c="#0a2a1f" />
      {/* Iris */}
      <P x={5}  y={5}  w={6}  h={6}  c="#1a1a1a" />
      <P x={6}  y={6}  w={4}  h={4}  c="#e8c93a" />
      <P x={7}  y={7}  w={2}  h={2}  c="#fff071" />
    </svg>
  );
}

/* ═════════════════════════════════════════
   LIGHTNING (action / speed)
   ═════════════════════════════════════════ */
export function LightningIcon({ size = 24, className }: BlockProps) {
  return (
    <svg {...baseProps(size)} className={cn(className)} aria-label="lightning">
      <P x={8}  y={1}  w={3}  h={1}  c="#fff071" />
      <P x={6}  y={2}  w={4}  h={1}  c="#fff071" />
      <P x={5}  y={3}  w={4}  h={1}  c="#fff071" />
      <P x={4}  y={4}  w={4}  h={1}  c="#e8c93a" />
      <P x={6}  y={5}  w={3}  h={1}  c="#e8c93a" />
      <P x={5}  y={6}  w={4}  h={1}  c="#e8c93a" />
      <P x={4}  y={7}  w={5}  h={1}  c="#fff071" />
      <P x={3}  y={8}  w={6}  h={1}  c="#fff071" />
      <P x={6}  y={9}  w={3}  h={1}  c="#e8c93a" />
      <P x={5}  y={10} w={3}  h={1}  c="#e8c93a" />
      <P x={4}  y={11} w={3}  h={1}  c="#b6951e" />
      <P x={3}  y={12} w={3}  h={1}  c="#b6951e" />
      <P x={2}  y={13} w={3}  h={1}  c="#b6951e" />
    </svg>
  );
}

/* ═════════════════════════════════════════
   TNT (warning / destructive)
   ═════════════════════════════════════════ */
export function TntBlock({ size = 24, className }: BlockProps) {
  return (
    <svg {...baseProps(size)} className={cn(className)} aria-label="tnt">
      <P x={0}  y={0}  w={16} h={16} c="#cf2424" />
      <P x={0}  y={0}  w={16} h={2}  c="#1a1a1a" />
      <P x={0}  y={14} w={16} h={2}  c="#1a1a1a" />
      <P x={0}  y={6}  w={16} h={4}  c="#f1f1f1" />
      {/* Letters */}
      <P x={2}  y={7}  w={1}  h={2}  c="#1a1a1a" />
      <P x={2}  y={7}  w={2}  h={1}  c="#1a1a1a" />
      <P x={5}  y={7}  w={2}  h={1}  c="#1a1a1a" />
      <P x={5}  y={7}  w={1}  h={2}  c="#1a1a1a" />
      <P x={8}  y={7}  w={1}  h={2}  c="#1a1a1a" />
      <P x={9}  y={7}  w={1}  h={1}  c="#1a1a1a" />
      <P x={10} y={7}  w={1}  h={2}  c="#1a1a1a" />
      {/* Fuse */}
      <P x={7}  y={0}  w={1}  h={2}  c="#7a5538" />
      <P x={8}  y={0}  w={1}  h={1}  c="#fff071" />
    </svg>
  );
}

/* ═════════════════════════════════════════
   GAMEPAD (play)
   ═════════════════════════════════════════ */
export function GamepadIcon({ size = 24, className }: BlockProps) {
  return (
    <svg {...baseProps(size)} className={cn(className)} aria-label="play">
      <P x={2}  y={4}  w={12} h={1}  c="#1a1a1a" />
      <P x={1}  y={5}  w={14} h={6}  c="#3a3a3a" />
      <P x={2}  y={11} w={12} h={1}  c="#1a1a1a" />
      {/* Dpad */}
      <P x={3}  y={6}  w={3}  h={3}  c="#5a5a5a" />
      <P x={3}  y={7}  w={3}  h={1}  c="#7d7d7d" />
      {/* Buttons */}
      <P x={10} y={6}  w={1}  h={1}  c="#d92424" />
      <P x={12} y={7}  w={1}  h={1}  c="#5a9a2e" />
      <P x={10} y={8}  w={1}  h={1}  c="#e8c93a" />
      <P x={9}  y={7}  w={1}  h={1}  c="#38bdf8" />
    </svg>
  );
}

/* ═════════════════════════════════════════
   PIXEL FOLDER
   ═════════════════════════════════════════ */
export function FolderIcon({ size = 24, className }: BlockProps) {
  return (
    <svg {...baseProps(size)} className={cn(className)} aria-label="folder">
      <P x={1}  y={4}  w={5}  h={1}  c="#b6951e" />
      <P x={1}  y={5}  w={14} h={1}  c="#e8c93a" />
      <P x={1}  y={5}  w={14} h={9}  c="#e8c93a" />
      <P x={1}  y={5}  w={1}  h={9}  c="#fff071" />
      <P x={14} y={6}  w={1}  h={8}  c="#b6951e" />
      <P x={1}  y={13} w={14} h={1}  c="#b6951e" />
    </svg>
  );
}

/* ═════════════════════════════════════════
   PIXEL "STAR" (premium / upgrade)
   ═════════════════════════════════════════ */
export function StarIcon({ size = 24, className }: BlockProps) {
  return (
    <svg {...baseProps(size)} className={cn(className)} aria-label="star">
      <P x={7}  y={1}  w={2}  h={1}  c="#fff071" />
      <P x={7}  y={2}  w={2}  h={1}  c="#e8c93a" />
      <P x={5}  y={5}  w={6}  h={1}  c="#e8c93a" />
      <P x={1}  y={6}  w={14} h={2}  c="#fff071" />
      <P x={1}  y={6}  w={14} h={1}  c="#e8c93a" />
      <P x={3}  y={8}  w={10} h={1}  c="#e8c93a" />
      <P x={4}  y={9}  w={8}  h={2}  c="#fff071" />
      <P x={5}  y={11} w={1}  h={2}  c="#e8c93a" />
      <P x={10} y={11} w={1}  h={2}  c="#e8c93a" />
      <P x={3}  y={13} w={3}  h={1}  c="#b6951e" />
      <P x={10} y={13} w={3}  h={1}  c="#b6951e" />
    </svg>
  );
}

/* ═════════════════════════════════════════
   SHIELD (admin)
   ═════════════════════════════════════════ */
export function ShieldIcon({ size = 24, className }: BlockProps) {
  return (
    <svg {...baseProps(size)} className={cn(className)} aria-label="shield">
      <P x={4}  y={2}  w={8}  h={2}  c="#bfbfbf" />
      <P x={3}  y={3}  w={10} h={6}  c="#bfbfbf" />
      <P x={3}  y={2}  w={10} h={1}  c="#e0e0e0" />
      <P x={3}  y={3}  w={1}  h={6}  c="#e0e0e0" />
      <P x={12} y={3}  w={1}  h={6}  c="#7d7d7d" />
      <P x={4}  y={9}  w={8}  h={2}  c="#bfbfbf" />
      <P x={5}  y={11} w={6}  h={1}  c="#bfbfbf" />
      <P x={6}  y={12} w={4}  h={1}  c="#7d7d7d" />
      <P x={7}  y={13} w={2}  h={1}  c="#7d7d7d" />
      {/* Cross */}
      <P x={7}  y={4}  w={2}  h={5}  c="#cf2424" />
      <P x={5}  y={5}  w={6}  h={2}  c="#cf2424" />
    </svg>
  );
}

/* ═════════════════════════════════════════
   USER (skin head)
   ═════════════════════════════════════════ */
export function UserHead({ size = 24, className }: BlockProps) {
  return (
    <svg {...baseProps(size)} className={cn(className)} aria-label="user">
      {/* Head */}
      <P x={3}  y={3}  w={10} h={10} c="#caa07a" />
      <P x={3}  y={3}  w={10} h={1}  c="#dab590" />
      <P x={3}  y={3}  w={1}  h={10} c="#dab590" />
      <P x={12} y={3}  w={1}  h={10} c="#9a7055" />
      <P x={3}  y={12} w={10} h={1}  c="#9a7055" />
      {/* Hair */}
      <P x={3}  y={3}  w={10} h={2}  c="#4d3622" />
      <P x={2}  y={4}  w={1}  h={1}  c="#4d3622" />
      <P x={13} y={4}  w={1}  h={1}  c="#4d3622" />
      {/* Eyes */}
      <P x={5}  y={6}  w={2}  h={2}  c="#1a1a1a" />
      <P x={9}  y={6}  w={2}  h={2}  c="#1a1a1a" />
      <P x={5}  y={6}  w={1}  h={1}  c="#ffffff" />
      <P x={9}  y={6}  w={1}  h={1}  c="#ffffff" />
      {/* Mouth */}
      <P x={7}  y={10} w={2}  h={1}  c="#7a5538" />
    </svg>
  );
}
