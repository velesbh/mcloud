import Link from "next/link";
import { MCloudLogo, MCloudWordmark } from "@/components/layout/MCloudLogo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Server,
  Terminal,
  FolderOpen,
  Package,
  HardDrive,
  Zap,
  Shield,
  Globe,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";

const features = [
  {
    icon: Server,
    title: "Instant Servers",
    description: "Create a Minecraft server in seconds. Java or Bedrock, any version.",
  },
  {
    icon: Terminal,
    title: "Live Console",
    description: "Run commands and watch your server's output in real time.",
  },
  {
    icon: FolderOpen,
    title: "File Manager",
    description: "Browse, edit, and upload files directly from your browser.",
  },
  {
    icon: Package,
    title: "Mods & Plugins",
    description: "Search and install from Modrinth — thousands of mods in one click.",
  },
  {
    icon: HardDrive,
    title: "Automatic Backups",
    description: "Keep your world safe. Create snapshots and restore anytime.",
  },
  {
    icon: Zap,
    title: "Always Fast",
    description: "Servers run on optimized nodes with low-latency regional hosting.",
  },
];

const freeTierPerks = [
  "1 Minecraft server",
  "1 GB RAM",
  "5 GB storage",
  "Live console access",
  "Mod & plugin installer",
  "Manual backups",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MCloudLogo size={24} />
            <MCloudWordmark />
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/sign-in">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link href="/sign-up">
              <Button size="sm" className="gap-1">
                Get started free <ChevronRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-24 pb-20 text-center">
        <Badge variant="outline" className="mb-6 text-primary border-primary/30 bg-primary/5">
          Free tier — no credit card required
        </Badge>
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6 leading-tight">
          Host Minecraft servers,{" "}
          <span className="text-primary">effortlessly.</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          MCloud is the simplest way to run a Minecraft server. Simpler than Realms — with mods, plugins, backups, and a live console.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/sign-up">
            <Button size="lg" className="w-full sm:w-auto gap-2 text-base px-8">
              Start for free <ChevronRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/sign-in">
            <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-8">
              Sign in
            </Button>
          </Link>
        </div>
      </section>

      <Separator className="max-w-6xl mx-auto" />

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold mb-3">Everything you need</h2>
          <p className="text-muted-foreground text-lg">
            All the tools to run and manage your server — in one place.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="border border-border rounded-lg p-6 hover:border-primary/40 transition-colors"
            >
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-base mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      <Separator className="max-w-6xl mx-auto" />

      {/* Free tier */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="max-w-xl mx-auto border border-border rounded-xl p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Free forever</h2>
          <p className="text-muted-foreground mb-8">
            Start hosting without spending a dime. Upgrade when you need more.
          </p>
          <ul className="space-y-3 mb-8 text-left">
            {freeTierPerks.map((perk) => (
              <li key={perk} className="flex items-center gap-3 text-sm">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                {perk}
              </li>
            ))}
          </ul>
          <Link href="/sign-up">
            <Button className="w-full gap-2">
              Create free server <ChevronRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <MCloudLogo size={18} />
            <span>© 2026 Enzonic LLC. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-1">
            <Globe className="w-3 h-3" />
            <span className="ml-1">Kentucky, USA</span>
          </div>
          <div className="flex gap-5">
            <Link href="/en/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/en/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/en/aup" className="hover:text-foreground transition-colors">AUP</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
