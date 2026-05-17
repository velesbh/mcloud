import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { getLocale } from "next-intl/server";
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
import { CheckCircle2, ArrowRight, Zap, Shield, Globe, Terminal, HardDrive, Package } from "lucide-react";

/* ── Types ────────────────────────────────────────────────────────────── */

/* ── Ground strip ─────────────────────────────────────────────────────── */
function GroundStrip() {
  const grassShades = ["#5a9a2e", "#5a9a2e", "#5a9a2e", "#6db535", "#4a7a1e", "#5a9a2e"];
  const dirtShades  = ["#866043", "#7a5538", "#866043", "#9a7055", "#866043", "#7a5538"];
  return (
    <div className="w-full flex items-end overflow-hidden select-none" aria-hidden>
      {Array.from({ length: 64 }).map((_, i) => (
        <div key={i} className="flex-1 flex flex-col" style={{ minWidth: 0 }}>
          <div className="h-3" style={{ background: grassShades[i % grassShades.length] }} />
          <div className="h-5" style={{ background: dirtShades[(i + 1) % dirtShades.length] }} />
        </div>
      ))}
    </div>
  );
}

/* ── Stat pillar ──────────────────────────────────────────────────────── */
function StatPillar({ Icon, value, label }: { Icon: React.ComponentType<{ size?: number }>; value: string; label: string }) {
  return (
    <div
      className="flex flex-col items-center gap-2 px-6 py-4 border-2 select-none min-w-[100px]"
      style={{
        borderColor: "rgba(90,154,46,0.7)",
        background: "rgba(20,32,20,0.55)",
        boxShadow: "inset -3px -4px 0 0 rgba(0,0,0,0.45), inset 3px 3px 0 0 rgba(255,255,255,0.07)",
      }}
    >
      <Icon size={32} />
      <span className="font-minecraft text-primary text-base leading-none">{value}</span>
      <span className="text-[10px] text-slate-300 uppercase tracking-wider">{label}</span>
    </div>
  );
}

/* ── Step card ────────────────────────────────────────────────────────── */
function StepCard({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <div
      className="relative flex flex-col gap-3 border-2 border-border p-6"
      style={{ borderRadius: 0, boxShadow: "3px 3px 0 rgba(0,0,0,0.25)" }}
    >
      <div
        className="font-minecraft text-[11px] w-8 h-8 flex items-center justify-center border-2"
        style={{ background: "#5a9a2e", borderColor: "#4a7a1e", color: "#fff", borderRadius: 0, boxShadow: "2px 2px 0 rgba(0,0,0,0.35)" }}
      >
        {num}
      </div>
      <h3 className="font-minecraft text-[11px] leading-relaxed">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}

/* ── Feature card ─────────────────────────────────────────────────────── */
function FeatureCard({ Icon, title, body, accent = false }: { Icon: React.ComponentType<{ size?: number }>; title: string; body: string; accent?: boolean }) {
  return (
    <div
      className={`border-2 p-5 transition-colors group hover:border-primary/60 ${accent ? "border-primary/40" : "border-border"}`}
      style={{ borderRadius: 0, boxShadow: "2px 2px 0 rgba(0,0,0,0.2)" }}
    >
      <div className="mb-4 group-hover:translate-y-[-2px] transition-transform">
        <Icon size={40} />
      </div>
      <h3 className="font-minecraft text-[11px] mb-2 leading-relaxed">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}

const features = [
  { Icon: LightningIcon, title: "Instant Setup", body: "Pick a version, name your world, click Create. You're in the game before you could find a tutorial on YouTube." },
  { Icon: Terminal,      title: "Live Console", body: "Run commands and watch output stream in real time. Type, hit enter, done — right in your browser." },
  { Icon: HardDrive,     title: "File Manager", body: "Browse, edit configs, upload jars — all from a pixel-perfect file browser. Zero SFTP.", accent: true },
  { Icon: Package,       title: "Mods & Plugins", body: "Hooked into Modrinth. Search a name, click install. Supports Forge, Fabric, Paper, and more." },
  { Icon: Shield,        title: "Automatic Backups", body: "Snapshot your world on demand or let us do it. Restore in a single click when things go sideways." },
  { Icon: Globe,         title: "Regional Nodes", body: "Low-latency nodes close to your players. Pick the region, we do the routing." },
];

const steps = [
  { num: "01", title: "Create an account", body: "Sign up in 30 seconds — no credit card, no long form." },
  { num: "02", title: "Spawn a server",     body: "Choose Java or Bedrock, pick a version, pick a loader. Done." },
  { num: "03", title: "Play with friends",  body: "Share the IP shown on your dashboard. That's it." },
];

const freeTierPerks = [
  "1 Minecraft server",
  "1 GB RAM included",
  "5 GB world storage",
  "Live console + file editor",
  "Unlimited Modrinth installs",
  "Manual backups & restores",
];

/* ── Page ─────────────────────────────────────────────────────────────── */
export default async function LandingPage() {
  let isSignedIn = false;
  try {
    const { userId } = await auth();
    isSignedIn = !!userId;
  } catch {
    // Middleware not available (local dev without proper Clerk setup)
  }
  const locale = await getLocale();

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ─── Nav ──────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 border-b-2 border-border"
        style={{ background: "hsl(var(--background)/0.92)", backdropFilter: "blur(8px)" }}
      >
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <MCloudLogo size={28} />
            <MCloudWordmark />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isSignedIn ? (
              <Link href={`/${locale}/dashboard`}>
                <Button size="sm" className="font-minecraft text-[10px] gap-1.5 pixel-border-green" style={{ background: "#5a9a2e", color: "#fff" }}>
                  Dashboard <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href={`/${locale}/sign-in`}>
                  <Button variant="ghost" size="sm" className="font-minecraft text-[10px]">Sign in</Button>
                </Link>
                <Link href={`/${locale}/sign-up`}>
                  <Button size="sm" className="font-minecraft text-[10px] gap-1.5 pixel-border-green" style={{ background: "#5a9a2e", color: "#fff" }}>
                    <PickaxeIcon size={14} /> Play free
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ─── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Sky */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg,#0d1f36 0%,#112944 25%,#0a1e38 55%,hsl(var(--background)) 100%)" }}
        />
        <div className="absolute inset-0 bg-pixel-grid opacity-40" aria-hidden />

        {/* Stars */}
        <div className="absolute inset-0" aria-hidden>
          {[
            { t:"4%",  l:"6%",  s:2, o:0.9 }, { t:"11%", l:"20%", s:3, o:0.7 },
            { t:"6%",  l:"38%", s:2, o:0.95 }, { t:"14%", l:"60%", s:2, o:0.6 },
            { t:"8%",  l:"76%", s:3, o:0.8 }, { t:"19%", l:"89%", s:2, o:0.5 },
            { t:"24%", l:"13%", s:2, o:0.7 }, { t:"29%", l:"51%", s:2, o:0.4 },
            { t:"32%", l:"70%", s:3, o:0.85 }, { t:"3%", l:"92%", s:2, o:0.6 },
            { t:"18%", l:"44%", s:2, o:0.55 }, { t:"27%", l:"82%", s:2, o:0.7 },
          ].map((s, i) => (
            <div key={i} className="absolute bg-white" style={{ top: s.t, left: s.l, width: s.s, height: s.s, opacity: s.o }} />
          ))}
        </div>

        {/* Moon */}
        <div
          className="absolute"
          style={{
            top: "6%", right: "12%",
            width: 36, height: 36,
            background: "#f5f0d8",
            boxShadow: "inset -6px -6px 0 0 #d4c98a, 0 0 20px rgba(245,240,216,0.15)",
          }}
          aria-hidden
        />

        <div className="relative max-w-6xl mx-auto px-4 pt-20 pb-10">
          {/* Floating block */}
          <div className="flex justify-center mb-8">
            <div style={{ animation: "mc-bounce 3s ease-in-out infinite" }}>
              <GrassBlock size={72} />
            </div>
          </div>

          <div className="text-center">
            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 mb-6 px-3 py-2 border-2 text-xs font-minecraft"
              style={{ borderColor: "#5a9a2e", background: "rgba(90,154,46,0.15)", color: "#a8e060" }}
            >
              <GamepadIcon size={14} /> Free tier · no credit card ever
            </div>

            {/* Title */}
            <h1 className="font-minecraft text-2xl sm:text-4xl md:text-5xl leading-[1.6] mb-6 text-white">
              Minecraft hosting<br />
              <span style={{ color: "#5a9a2e" }}>that just works.</span>
            </h1>

            <p className="text-sm sm:text-base text-slate-300 max-w-lg mx-auto mb-10 leading-relaxed">
              Spawn a server in under 60 seconds. Install mods with one click.
              Live console, file editor, automatic backups — all in the browser.
              No SSH. No config files. No stress.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-14">
              {isSignedIn ? (
                <Link href={`/${locale}/dashboard`}>
                  <Button
                    size="lg"
                    className="w-full sm:w-auto font-minecraft text-[11px] gap-2 px-8 py-5 pixel-border-green"
                    style={{ background: "#5a9a2e", color: "#fff", borderRadius: 0 }}
                  >
                    Go to Dashboard <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href={`/${locale}/sign-up`}>
                    <Button
                      size="lg"
                      className="w-full sm:w-auto font-minecraft text-[11px] gap-2 px-8 py-5 pixel-border-green"
                      style={{ background: "#5a9a2e", color: "#fff", borderRadius: 0 }}
                    >
                      <PickaxeIcon size={14} /> Spawn a server — it's free
                    </Button>
                  </Link>
                  <Link href={`/${locale}/sign-in`}>
                    <Button
                      size="lg"
                      variant="outline"
                      className="w-full sm:w-auto font-minecraft text-[11px] px-8 py-5 border-2"
                      style={{ borderColor: "#5a9a2e", color: "#5a9a2e", borderRadius: 0 }}
                    >
                      Sign in
                    </Button>
                  </Link>
                </>
              )}
            </div>

            {/* Stats */}
            <div className="flex flex-wrap justify-center gap-3">
              <StatPillar Icon={DiamondBlock}  value="1 GB"  label="Free RAM" />
              <StatPillar Icon={ChestBlock}    value="5 GB"  label="Storage" />
              <StatPillar Icon={StoneBlock}    value="Any"   label="Version" />
              <StatPillar Icon={LightningIcon} value="24/7"  label="Online" />
              <StatPillar Icon={GoldBlock}     value="Free"  label="Forever" />
            </div>
          </div>
        </div>

        <GroundStrip />
      </section>

      {/* ─── How it works ─────────────────────────────────────────────── */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-2 mb-3">
              <PickaxeIcon size={18} />
              <h2 className="font-minecraft text-base sm:text-lg">Three steps to playing</h2>
              <PickaxeIcon size={18} className="-scale-x-100" />
            </div>
            <p className="text-sm text-muted-foreground">No manual required.</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            {steps.map((s) => (
              <StepCard key={s.num} {...s} />
            ))}
          </div>
        </div>
      </section>

      <GroundStrip />

      {/* ─── Features ─────────────────────────────────────────────────── */}
      <section className="relative">
        <div className="absolute inset-0 bg-stone opacity-30" aria-hidden />
        <div className="relative max-w-6xl mx-auto px-4 py-20">
          <div className="text-center mb-14">
            <div className="flex items-center justify-center gap-2 mb-3">
              <ServerBlock size={20} />
              <h2 className="font-minecraft text-base sm:text-lg">Everything you need</h2>
              <ServerBlock size={20} />
            </div>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              All the tools. None of the ops headache.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f) => (
              <FeatureCard key={f.title} Icon={f.Icon} title={f.title} body={f.body} accent={f.accent} />
            ))}
          </div>
        </div>
      </section>

      <GroundStrip />

      {/* ─── Free tier chest ──────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-pixel-grid">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <div className="inline-block" style={{ animation: "mc-bounce 4s ease-in-out infinite" }}>
              <ChestBlock size={56} />
            </div>
            <h2 className="font-minecraft text-base mt-4 mb-2">Free Tier Loot</h2>
            <p className="text-sm text-muted-foreground">
              Open the chest. Take what's inside. No credit card required — ever.
            </p>
          </div>

          <div
            className="border-2 border-border overflow-hidden"
            style={{
              borderRadius: 0,
              boxShadow: "inset -3px -4px 0 0 rgba(0,0,0,0.35), inset 3px 3px 0 0 rgba(255,255,255,0.05), 4px 4px 0 rgba(0,0,0,0.25)",
              background: "hsl(var(--card))",
            }}
          >
            <div
              className="flex items-center justify-between gap-3 px-4 py-3 border-b-2 border-border"
              style={{ background: "#7a5538" }}
            >
              <div className="flex items-center gap-2 text-white">
                <DirtBlock size={20} />
                <span className="font-minecraft text-[10px]">free.chest</span>
              </div>
              <span className="font-minecraft text-[10px] text-amber-100">$0 / month</span>
            </div>

            <div className="p-6">
              <ul className="space-y-3 mb-7">
                {freeTierPerks.map((perk) => (
                  <li key={perk} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" strokeWidth={2.5} />
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>

              {isSignedIn ? (
                <Link href={`/${locale}/dashboard`} className="block">
                  <Button
                    className="w-full font-minecraft text-[11px] py-5 gap-2 pixel-border-green"
                    style={{ background: "#5a9a2e", color: "#fff", borderRadius: 0 }}
                  >
                    Go to Dashboard <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              ) : (
                <Link href={`/${locale}/sign-up`} className="block">
                  <Button
                    className="w-full font-minecraft text-[11px] py-5 gap-2 pixel-border-green"
                    style={{ background: "#5a9a2e", color: "#fff", borderRadius: 0 }}
                  >
                    <PickaxeIcon size={14} /> Claim it free
                  </Button>
                </Link>
              )}

              <p className="text-[10px] text-muted-foreground text-center mt-3">
                Hibernates after 7d idle · Deleted after 30d inactivity · Upgrade anytime
              </p>
            </div>
          </div>
        </div>
      </section>

      <GroundStrip />

      {/* ─── Bottom CTA ───────────────────────────────────────────────── */}
      {!isSignedIn && (
        <section
          className="py-20 px-4 text-center"
          style={{ background: "linear-gradient(180deg, hsl(var(--background)) 0%, #0d1f36 100%)" }}
        >
          <div className="max-w-xl mx-auto">
            <div className="flex justify-center mb-6">
              <div style={{ animation: "mc-bounce 3.5s ease-in-out infinite" }}>
                <GrassBlock size={56} />
              </div>
            </div>
            <h2 className="font-minecraft text-base sm:text-xl text-white mb-4 leading-[1.8]">
              Ready to build?
            </h2>
            <p className="text-sm text-slate-300 mb-8 leading-relaxed">
              Your server is a few clicks away. Free forever, upgrade when you need more.
            </p>
            <Link href={`/${locale}/sign-up`}>
              <Button
                size="lg"
                className="font-minecraft text-[11px] gap-2 px-10 py-5 pixel-border-green"
                style={{ background: "#5a9a2e", color: "#fff", borderRadius: 0 }}
              >
                <PickaxeIcon size={16} /> Start for free
              </Button>
            </Link>
          </div>
        </section>
      )}

      {/* ─── Footer ───────────────────────────────────────────────────── */}
      <footer className="py-8 border-t-2 border-border" style={{ background: "#0a0e14" }}>
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <MCloudLogo size={22} />
            <span className="font-minecraft text-[9px] text-slate-400">© 2026 Enzonic LLC</span>
          </div>
          <div className="flex items-center gap-2 text-slate-500">
            <StarIcon size={14} />
            <span className="font-minecraft text-[9px]">Made in Kentucky</span>
          </div>
          <div className="flex gap-5">
            {[
              { href: `/${locale}/privacy`, label: "Privacy" },
              { href: `/${locale}/terms`,   label: "Terms" },
              { href: `/${locale}/aup`,     label: "AUP" },
            ].map((l) => (
              <Link key={l.href} href={l.href} className="font-minecraft text-[9px] text-slate-500 hover:text-primary transition-colors">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
