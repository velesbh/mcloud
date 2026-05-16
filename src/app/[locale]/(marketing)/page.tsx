import Link from "next/link";
import { MCloudLogo, MCloudWordmark } from "@/components/layout/MCloudLogo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  GrassBlock,
  DirtBlock,
  StoneBlock,
  DiamondBlock,
  GoldBlock,
  RedstoneBlock,
  ChestBlock,
  PickaxeIcon,
  ServerBlock,
  CompassIcon,
  LightningIcon,
  GamepadIcon,
  StarIcon,
} from "@/components/pixel/Block";
import { CheckCircle2 } from "lucide-react";

const features = [
  {
    Icon: LightningIcon,
    title: "Instant Servers",
    description: "Spawn a Java or Bedrock world in seconds. Any version, any loader.",
  },
  {
    Icon: ServerBlock,
    title: "Live Console",
    description: "Run commands and watch output stream in real time — like running tail -f on Mojang.",
  },
  {
    Icon: ChestBlock,
    title: "File Manager",
    description: "Browse, edit, and upload files straight from your browser. No SFTP, no nonsense.",
  },
  {
    Icon: RedstoneBlock,
    title: "Mods & Plugins",
    description: "Hooked into Modrinth. Search a name, click install, you're done.",
  },
  {
    Icon: GoldBlock,
    title: "Automatic Backups",
    description: "Snapshot your world before the bad update. Restore in a click when it all goes sideways.",
  },
  {
    Icon: CompassIcon,
    title: "Regional Nodes",
    description: "Hosted on low-latency nodes close to your players. Pick the region, we do the rest.",
  },
];

const freeTierPerks = [
  "1 Minecraft server",
  "1 GB RAM included",
  "5 GB world storage",
  "Live console + file editor",
  "Unlimited Modrinth installs",
  "Manual backups & restores",
];

/* Pixel-art grass+dirt divider strip, full width, varied for "hand made" feel */
function GroundStrip() {
  // Pre-computed deterministic variation so it looks "handmade" but stays
  // server-render stable.
  const grassShades = ["#5a9a2e", "#5a9a2e", "#5a9a2e", "#6db535", "#4a7a1e", "#5a9a2e"];
  const dirtShades  = ["#866043", "#7a5538", "#866043", "#9a7055", "#866043", "#7a5538"];
  return (
    <div className="w-full flex items-end overflow-hidden select-none" aria-hidden>
      {Array.from({ length: 48 }).map((_, i) => (
        <div key={i} className="flex-1 flex flex-col" style={{ minWidth: 0 }}>
          <div className="h-3" style={{ background: grassShades[i % grassShades.length] }} />
          <div className="h-5" style={{ background: dirtShades[(i + 1) % dirtShades.length] }} />
        </div>
      ))}
    </div>
  );
}

/* "Pillar of dirt" stat block — like a chunk excerpt */
function StatPillar({
  Icon,
  value,
  label,
}: {
  Icon: typeof GrassBlock;
  value: string;
  label: string;
}) {
  return (
    <div
      className="flex flex-col items-center gap-2 px-6 py-4 border-2 select-none"
      style={{
        borderColor: "rgba(90,154,46,0.7)",
        background: "rgba(20,32,20,0.55)",
        boxShadow:
          "inset -3px -4px 0 0 rgba(0,0,0,0.45), inset 3px 3px 0 0 rgba(255,255,255,0.07)",
      }}
    >
      <Icon size={32} />
      <span className="font-minecraft text-primary text-base leading-none">{value}</span>
      <span className="text-[10px] text-slate-300 uppercase tracking-wider">{label}</span>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ─── Nav ─── */}
      <header
        className="sticky top-0 z-50 border-b-2 border-border"
        style={{
          background: "hsl(var(--background)/0.92)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <MCloudLogo size={28} />
            <MCloudWordmark />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/sign-in">
              <Button variant="ghost" size="sm" className="font-minecraft text-[10px]">
                Sign in
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button
                size="sm"
                className="font-minecraft text-[10px] gap-1.5 pixel-border-green"
                style={{ background: "#5a9a2e", color: "#fff" }}
              >
                <PickaxeIcon size={14} /> Play free
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden">
        {/* Painted sky — gradient + grid */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg,#1a3a5c 0%, #142b48 30%, #0a1729 60%, hsl(var(--background)) 100%)",
          }}
        />
        <div className="absolute inset-0 bg-pixel-grid opacity-50" aria-hidden />

        {/* Hand-placed pixel stars (deterministic, but varied size/opacity) */}
        <div className="absolute inset-0" aria-hidden>
          {[
            { t: "5%",  l: "8%",  s: 2, o: 0.9 },
            { t: "12%", l: "23%", s: 3, o: 0.7 },
            { t: "7%",  l: "41%", s: 2, o: 0.95 },
            { t: "16%", l: "62%", s: 2, o: 0.6 },
            { t: "9%",  l: "78%", s: 3, o: 0.8 },
            { t: "20%", l: "90%", s: 2, o: 0.5 },
            { t: "26%", l: "15%", s: 2, o: 0.7 },
            { t: "30%", l: "53%", s: 2, o: 0.4 },
            { t: "33%", l: "72%", s: 3, o: 0.85 },
          ].map((s, i) => (
            <div
              key={i}
              className="absolute bg-white"
              style={{
                top: s.t, left: s.l,
                width: s.s, height: s.s,
                opacity: s.o,
                imageRendering: "pixelated",
              }}
            />
          ))}
        </div>

        <div className="relative max-w-6xl mx-auto px-4 pt-24 pb-12">
          {/* Floating block — feels alive */}
          <div className="flex justify-center mb-10">
            <div style={{ animation: "mc-bounce 3s ease-in-out infinite" }}>
              <GrassBlock size={64} />
            </div>
          </div>

          <div className="text-center">
            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 mb-7 px-3 py-2 border-2 text-xs font-minecraft"
              style={{
                borderColor: "#5a9a2e",
                background: "rgba(90,154,46,0.18)",
                color: "#a8e060",
              }}
            >
              <GamepadIcon size={14} /> Free tier · no credit card
            </div>

            {/* Hero title */}
            <h1 className="font-minecraft text-xl sm:text-3xl md:text-4xl leading-[1.7] mb-8 text-white">
              <span className="block">Host Minecraft</span>
              <span style={{ color: "#5a9a2e", display: "block", marginTop: "0.1em" }}>
                servers, easy.
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto mb-10 leading-relaxed">
              MCloud is hosting that respects your time. Mods install in a click.
              Backups happen on their own. The console is right there, in the browser.
              You play. We handle the boring parts.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-16">
              <Link href="/sign-up">
                <Button
                  size="lg"
                  className="w-full sm:w-auto font-minecraft text-[11px] gap-2 px-7 py-5 pixel-border-green"
                  style={{ background: "#5a9a2e", color: "#fff", borderRadius: 0 }}
                >
                  <PickaxeIcon size={14} /> Spawn a server
                </Button>
              </Link>
              <Link href="/sign-in">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto font-minecraft text-[11px] px-7 py-5 border-2"
                  style={{ borderColor: "#5a9a2e", color: "#5a9a2e", borderRadius: 0 }}
                >
                  I have an account
                </Button>
              </Link>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              <StatPillar Icon={DiamondBlock} value="1 GB"  label="Free RAM" />
              <StatPillar Icon={ChestBlock}   value="5 GB"  label="Storage" />
              <StatPillar Icon={StoneBlock}   value="Any"   label="Version" />
              <StatPillar Icon={LightningIcon} value="24/7" label="Online" />
            </div>
          </div>
        </div>

        <GroundStrip />
      </section>

      {/* ─── Features ─── */}
      <section className="relative">
        {/* Subtle dirt texture wash */}
        <div className="absolute inset-0 bg-stone opacity-40" aria-hidden />
        <div className="relative max-w-6xl mx-auto px-4 py-20">
          <div className="text-center mb-14">
            <div className="flex items-center justify-center gap-2 mb-3">
              <PickaxeIcon size={18} />
              <h2 className="font-minecraft text-base sm:text-lg">Everything you need</h2>
              <PickaxeIcon size={18} className="-scale-x-100" />
            </div>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              All the tools to run a server, none of the ops headache.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="border-2 border-border p-5 transition-colors group hover:border-primary/60"
                style={{
                  borderRadius: 0,
                  // tiny inconsistencies make it feel less AI-perfect
                  boxShadow:
                    i % 2 === 0
                      ? "inset 2px 2px 0 rgba(255,255,255,0.04), 2px 2px 0 rgba(0,0,0,0.2)"
                      : "inset 1px 2px 0 rgba(255,255,255,0.03), 3px 3px 0 rgba(0,0,0,0.18)",
                }}
              >
                <div className="mb-4 group-hover:translate-y-[-2px] transition-transform">
                  <f.Icon size={40} />
                </div>
                <h3 className="font-minecraft text-[11px] mb-2 leading-relaxed">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <GroundStrip />

      {/* ─── Free tier (chest) ─── */}
      <section className="py-20 px-4 bg-pixel-grid">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-6">
            <div className="inline-block" style={{ animation: "mc-bounce 4s ease-in-out infinite" }}>
              <ChestBlock size={48} />
            </div>
            <h2 className="font-minecraft text-base mt-3 mb-1">Free Tier Loot</h2>
            <p className="text-xs text-muted-foreground">
              Open the chest. Take what's inside. No credit card.
            </p>
          </div>

          <div
            className="border-2 border-border overflow-hidden"
            style={{
              borderRadius: 0,
              boxShadow:
                "inset -3px -4px 0 0 rgba(0,0,0,0.35), inset 3px 3px 0 0 rgba(255,255,255,0.05), 4px 4px 0 rgba(0,0,0,0.25)",
              background: "hsl(var(--card))",
            }}
          >
            {/* Lid */}
            <div
              className="flex items-center justify-between gap-3 px-4 py-2.5 border-b-2 border-border"
              style={{ background: "#7a5538" }}
            >
              <div className="flex items-center gap-2 text-white">
                <DirtBlock size={20} />
                <span className="font-minecraft text-[10px]">free.chest</span>
              </div>
              <span className="font-minecraft text-[10px] text-amber-100">$0/mo</span>
            </div>

            <div className="p-6">
              <ul className="space-y-2.5 mb-6">
                {freeTierPerks.map((perk) => (
                  <li key={perk} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" strokeWidth={2.5} />
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>

              <Link href="/sign-up" className="block">
                <Button
                  className="w-full font-minecraft text-[11px] py-5 gap-2 pixel-border-green"
                  style={{ background: "#5a9a2e", color: "#fff", borderRadius: 0 }}
                >
                  <PickaxeIcon size={14} /> Claim it
                </Button>
              </Link>
              <p className="text-[10px] text-muted-foreground text-center mt-3">
                Hibernates after 7d idle · Deleted after 30d · Upgrade anytime
              </p>
            </div>
          </div>
        </div>
      </section>

      <GroundStrip />

      {/* ─── Footer ─── */}
      <footer className="py-8" style={{ background: "#0a0e14" }}>
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <MCloudLogo size={22} />
            <span className="font-minecraft text-[9px] text-slate-400">
              © 2026 Enzonic LLC
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-500">
            <StarIcon size={14} />
            <span className="font-minecraft text-[9px]">Made in Kentucky</span>
          </div>
          <div className="flex gap-5">
            {[
              { href: "/en/privacy", label: "Privacy" },
              { href: "/en/terms",   label: "Terms" },
              { href: "/en/aup",     label: "AUP" },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="font-minecraft text-[9px] text-slate-500 hover:text-primary transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
