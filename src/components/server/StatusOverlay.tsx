"use client";
import { motion } from "motion/react";
import { GrassBlock, DirtBlock, StoneBlock, ChestBlock, PickaxeIcon } from "@/components/pixel/Block";

/**
 * Pixel-art status overlay shown when a server is transitioning.
 *
 * - "starting"  → grass blocks pulsing in a row (loading the world)
 * - "stopping"  → blocks fading out one by one
 * - "restarting"→ pickaxe swing animation
 * - "installing"→ chest unpacking with falling blocks
 */
export function StatusOverlay({ status }: { status: "starting" | "stopping" | "restarting" | "installing" }) {
  if (status === "installing") return <InstallingAnim />;
  if (status === "starting")   return <StartingAnim />;
  if (status === "stopping")   return <StoppingAnim />;
  if (status === "restarting") return <RestartingAnim />;
  return null;
}

function StartingAnim() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-6">
      <div className="flex items-end gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            initial={{ y: -8, opacity: 0.4 }}
            animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
            transition={{
              duration: 0.9,
              repeat: Infinity,
              delay: i * 0.12,
              ease: "easeInOut",
            }}
          >
            <GrassBlock size={28} />
          </motion.div>
        ))}
      </div>
      <p className="font-minecraft text-[11px] uppercase tracking-wider text-primary">
        Generating world<DotPulse />
      </p>
    </div>
  );
}

function StoppingAnim() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-6">
      <div className="flex items-end gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            animate={{ opacity: [1, 0.15, 1] }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.15,
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

function RestartingAnim() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-6">
      <motion.div
        animate={{ rotate: [0, -25, 25, 0] }}
        transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
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

function InstallingAnim() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-6">
      <div className="relative h-24 w-32 flex items-end justify-center">
        {/* Stone blocks falling out of the chest */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{ left: `${30 + i * 20}%`, top: 0 }}
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: [0, 48], opacity: [1, 1, 0] }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              delay: i * 0.35,
              ease: "easeIn",
            }}
          >
            <StoneBlock size={16} />
          </motion.div>
        ))}
        {/* Chest at the bottom */}
        <motion.div
          animate={{ y: [0, -2, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-0"
        >
          <ChestBlock size={48} />
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
