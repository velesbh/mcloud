"use client";
import { motion } from "motion/react";
import { GrassBlock, DirtBlock, StoneBlock, ChestBlock, PickaxeIcon } from "@/components/pixel/Block";

/**
 * Pixel-art status overlay shown when a server is transitioning.
 *
 * - "starting"  → blocks marching + loading bar
 * - "stopping"  → blocks fading/sinking
 * - "restarting"→ pickaxe swing animation
 * - "installing"→ chest unpacking with falling blocks
 */
export function StatusOverlay({
  status,
}: {
  status: "starting" | "stopping" | "restarting" | "installing";
}) {
  if (status === "installing") return <InstallingAnim />;
  if (status === "starting") return <StartingAnim />;
  if (status === "stopping") return <StoppingAnim />;
  if (status === "restarting") return <RestartingAnim />;
  return null;
}

/* ── Starting ─────────────────────────────────────────────── */
const START_BLOCKS = [GrassBlock, DirtBlock, StoneBlock, GrassBlock, DirtBlock, StoneBlock, GrassBlock];

function StartingAnim() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-8">
      {/* Marching pixel-art blocks */}
      <div className="flex items-end gap-0.5">
        {START_BLOCKS.map((Block, i) => (
          <motion.div
            key={i}
            animate={{ y: [0, -10, 0], scaleY: [1, 1.1, 1] }}
            transition={{
              duration: 0.65,
              repeat: Infinity,
              delay: i * 0.09,
              ease: "easeInOut",
            }}
          >
            <Block size={26} />
          </motion.div>
        ))}
      </div>

      {/* Chunky pixel progress bar */}
      <div
        className="relative overflow-hidden"
        style={{
          width: 200,
          height: 12,
          background: "#1a1a1a",
          border: "2px solid #3a3a3a",
        }}
      >
        <motion.div
          className="absolute inset-y-0 left-0"
          style={{
            width: "60%",
            background: "linear-gradient(90deg, #3e7a1a, #5a9a2e, #6db535, #5a9a2e, #3e7a1a)",
            backgroundSize: "200% 100%",
          }}
          animate={{ x: ["-100%", "200%"] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
        />
      </div>

      <div className="text-center space-y-0.5">
        <p className="font-minecraft text-[11px] uppercase tracking-wider text-primary">
          Starting server<DotPulse />
        </p>
        <p className="text-[10px] text-muted-foreground font-minecraft">
          This may take up to 60 seconds
        </p>
      </div>
    </div>
  );
}

/* ── Stopping ─────────────────────────────────────────────── */
function StoppingAnim() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-6">
      <div className="flex items-end gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            animate={{ opacity: [1, 0.15, 1], y: [0, 4, 0] }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              delay: i * 0.18,
              ease: "easeInOut",
            }}
          >
            <DirtBlock size={28} />
          </motion.div>
        ))}
      </div>
      <p className="font-minecraft text-[11px] uppercase tracking-wider text-amber-400">
        Saving &amp; shutting down<DotPulse />
      </p>
    </div>
  );
}

/* ── Restarting ───────────────────────────────────────────── */
function RestartingAnim() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-6">
      <motion.div
        animate={{ rotate: [0, -30, 30, 0] }}
        transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "70% 70%" }}
      >
        <PickaxeIcon size={48} />
      </motion.div>
      <p className="font-minecraft text-[11px] uppercase tracking-wider text-sky-400">
        Restarting server<DotPulse />
      </p>
    </div>
  );
}

/* ── Installing ───────────────────────────────────────────── */
function InstallingAnim() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-6">
      <div className="relative h-28 w-36 flex items-end justify-center">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{ left: `${20 + i * 18}%`, top: 0 }}
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: [0, 56], opacity: [1, 1, 0] }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.3,
              ease: "easeIn",
            }}
          >
            <StoneBlock size={14} />
          </motion.div>
        ))}
        <motion.div
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 0.55, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-0"
        >
          <ChestBlock size={52} />
        </motion.div>
      </div>
      <div className="text-center space-y-1">
        <p className="font-minecraft text-[11px] uppercase tracking-wider text-amber-400">
          Installing modpack<DotPulse />
        </p>
        <p className="text-[10px] text-muted-foreground">
          Downloading mods &amp; applying overrides
        </p>
      </div>
    </div>
  );
}

/* ── Shared helpers ───────────────────────────────────────── */
function DotPulse() {
  return (
    <span className="inline-block ml-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block w-1.5 h-1.5 mx-0.5 align-middle"
          style={{ background: "currentColor" }}
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </span>
  );
}
