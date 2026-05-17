"use client";
import { useState, useEffect } from "react";
import { Package } from "lucide-react";
import { ModpackBrowser, type PickedModpack } from "@/components/server/ModpackBrowser";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { createServerSchema, type CreateServerInput } from "@/lib/validations/server";
import {
  MC_JAVA_VERSIONS,
  MC_BEDROCK_VERSIONS,
  JAVA_LOADERS,
  BEDROCK_LOADERS,
  FREE_TIER,
} from "@/lib/constants";
import { LoadingSpinner } from "@/components/shared/MinecraftLoader";
import { useQuery } from "@tanstack/react-query";
import type { Region } from "@/lib/supabase/types";
import { useFreeTierLimits } from "@/hooks/useFreeTierLimits";
import Link from "next/link";
import {
  GrassBlock, DirtBlock, RedstoneBlock, StoneBlock,
  DiamondBlock, PickaxeIcon, CompassIcon, StarIcon,
} from "@/components/pixel/Block";
import { PixelSlider } from "@/components/pixel/PixelPanel";
import type { ComponentType } from "react";

const STEPS = ["Name & Edition", "Version & Loader", "Region & Resources"];

type Template = {
  id: string;
  label: string;
  Icon: ComponentType<{ size?: number }>;
  desc: string;
  edition: "java" | "bedrock";
  loader: CreateServerInput["loader"];
  game_version: string;
};

const TEMPLATES: Template[] = [
  {
    id: "vanilla-smp",
    label: "Vanilla",
    Icon: GrassBlock,
    desc: "Classic survival",
    edition: "java",
    loader: "vanilla",
    game_version: "1.21.4",
  },
  {
    id: "paper-plugins",
    label: "Paper",
    Icon: StoneBlock,
    desc: "Plugin-ready",
    edition: "java",
    loader: "paper",
    game_version: "1.21.4",
  },
  {
    id: "fabric-mods",
    label: "Fabric",
    Icon: RedstoneBlock,
    desc: "Light mods",
    edition: "java",
    loader: "fabric",
    game_version: "1.21.4",
  },
  {
    id: "bedrock",
    label: "Bedrock",
    Icon: DiamondBlock,
    desc: "Cross-platform",
    edition: "bedrock",
    loader: "bedrock",
    game_version: "1.21.50",
  },
];

export function CreateServerWizard() {
  const locale = useLocale();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [edition, setEdition] = useState<"java" | "bedrock">("java");
  const [modpackOpen, setModpackOpen] = useState(false);
  const [picked, setPicked] = useState<PickedModpack | null>(null);
  const { maxRamMb, maxDiskMb, maxCpuPercent, planName, planKey } = useFreeTierLimits();

  const form = useForm<CreateServerInput>({
    resolver: zodResolver(createServerSchema),
    defaultValues: {
      name: "",
      edition: "java",
      game_version: "1.21.4",
      loader: "paper",
      ram_mb: 512,
      disk_mb: 1024,
      cpu_percent: 25,
      max_players: 20,
    },
  });

  // Sync slider defaults/clamps when plan quota loads asynchronously
  useEffect(() => {
    const cur = form.getValues();
    // Set to plan max if current value is below a reasonable threshold (i.e. still at stub default)
    // or clamp if it exceeds the loaded quota
    const newRam = Math.min(Math.max(cur.ram_mb, 512), maxRamMb);
    const newDisk = Math.min(Math.max(cur.disk_mb, 1024), maxDiskMb);
    const newCpu = Math.min(Math.max(cur.cpu_percent, 25), maxCpuPercent);
    // If the quota just loaded and defaults look like stubs, push to a sensible starting value
    const ramDefault = Math.min(maxRamMb, 1024);
    const diskDefault = Math.min(maxDiskMb, 5120);
    const cpuDefault = Math.min(maxCpuPercent, 100);
    if (cur.ram_mb <= 512) form.setValue("ram_mb", ramDefault, { shouldValidate: false });
    else if (newRam !== cur.ram_mb) form.setValue("ram_mb", newRam, { shouldValidate: false });
    if (cur.disk_mb <= 1024) form.setValue("disk_mb", diskDefault, { shouldValidate: false });
    else if (newDisk !== cur.disk_mb) form.setValue("disk_mb", newDisk, { shouldValidate: false });
    if (cur.cpu_percent <= 25) form.setValue("cpu_percent", cpuDefault, { shouldValidate: false });
    else if (newCpu !== cur.cpu_percent) form.setValue("cpu_percent", newCpu, { shouldValidate: false });
  }, [maxRamMb, maxDiskMb, maxCpuPercent]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: regions = [] } = useQuery<Region[]>({
    queryKey: ["regions"],
    queryFn: () => fetch("/api/regions").then((r) => r.json()),
  });

  const versions = edition === "java" ? MC_JAVA_VERSIONS : MC_BEDROCK_VERSIONS;
  const loaders = edition === "java" ? JAVA_LOADERS : BEDROCK_LOADERS;

  async function onSubmit(data: CreateServerInput) {
    setLoading(true);
    try {
      const payload = picked
        ? { ...data, modpack_url: picked.download_url, modpack_name: picked.title }
        : data;
      const res = await fetch("/api/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) {
        if (result.error === "serverLimit") {
          toast.error("You've reached your server limit on the free tier.");
        } else {
          toast.error("Failed to create server");
        }
        return;
      }
      toast.success("Server created!");
      router.push(`/${locale}/servers/${result.id}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleNext() {
    if (step === 0) {
      const ok = await form.trigger(["name", "edition"]);
      if (!ok) return;
    } else if (step === 1) {
      const ok = await form.trigger(["game_version", "loader"]);
      if (!ok) return;
    }
    setStep((s) => s + 1);
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                i < step
                  ? "bg-primary border-primary text-primary-foreground"
                  : i === step
                  ? "border-primary text-primary"
                  : "border-border text-muted-foreground"
              )}
            >
              {i < step ? "✓" : i + 1}
            </div>
            <span
              className={cn(
                "text-sm font-medium hidden sm:block transition-colors",
                i === step ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {s}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 rounded transition-colors",
                  i < step ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        ))}
      </div>

      <div>
        <AnimatePresence mode="wait">
          {/* Step 1: Name & Edition */}
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-xl font-bold mb-1">Name your server</h2>
                <p className="text-sm text-muted-foreground">What should we call it?</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Server Name</Label>
                <Input
                  id="name"
                  placeholder="My Awesome Server"
                  {...form.register("name")}
                  autoFocus
                  className="text-lg h-12"
                />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="flex items-center justify-between">
                  <span>Quick start</span>
                  <span className="text-[10px] text-muted-foreground font-normal">tap to pre-fill</span>
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TEMPLATES.map((t) => {
                    const active =
                      form.watch("edition") === t.edition &&
                      form.watch("loader") === t.loader &&
                      form.watch("game_version") === t.game_version;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setEdition(t.edition);
                          form.setValue("edition", t.edition);
                          form.setValue("loader", t.loader);
                          form.setValue("game_version", t.game_version);
                        }}
                        className={cn(
                          "flex flex-col items-start gap-1 rounded-md border-2 p-2.5 text-left transition-all",
                          active
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40"
                        )}
                      >
                        <t.Icon size={26} />
                        <span className="font-minecraft text-[9px] leading-tight">{t.label}</span>
                        <span className="text-[10px] text-muted-foreground leading-tight">
                          {t.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Modpack browser entry */}
              <div className="space-y-2">
                <Label className="flex items-center justify-between">
                  <span>Or install a modpack</span>
                  <span className="text-[10px] text-muted-foreground font-normal">auto-fills version + loader</span>
                </Label>
                {picked ? (
                  <div
                    className="flex items-center gap-3 p-3 border-2 border-primary bg-primary/5"
                    style={{ borderRadius: 0 }}
                  >
                    {picked.icon_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={picked.icon_url} alt="" className="w-10 h-10" style={{ imageRendering: "pixelated" }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-minecraft text-[11px] text-primary truncate">{picked.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        v{picked.version_number} · MC {picked.game_version} · {picked.loader}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPicked(null)}
                      className="text-xs text-muted-foreground hover:text-destructive"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setModpackOpen(true)}
                    className="w-full p-3 flex items-center gap-3 border-2 border-dashed border-border hover:border-primary/40 transition-colors"
                    style={{ borderRadius: 0 }}
                  >
                    <Package className="w-5 h-5 text-primary" />
                    <span className="text-sm flex-1 text-left">Browse Modrinth modpacks</span>
                    <span className="text-[10px] text-muted-foreground font-minecraft uppercase">FTB Skies · ATM10 · Fabulously Optimized · ...</span>
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <Label>Edition</Label>
                <div className="grid grid-cols-2 gap-3">
                  {(["java", "bedrock"] as const).map((ed) => (
                    <Card
                      key={ed}
                      className={cn(
                        "p-4 cursor-pointer transition-all border-2",
                        edition === ed
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40"
                      )}
                      onClick={() => {
                        setEdition(ed);
                        form.setValue("edition", ed);
                        form.setValue(
                          "loader",
                          ed === "java" ? "paper" : "bedrock"
                        );
                        form.setValue(
                          "game_version",
                          ed === "java" ? "1.21.4" : "1.21.50"
                        );
                      }}
                    >
                      <div className="flex items-center gap-2 font-semibold text-sm">
                        {ed === "java" ? <DirtBlock size={18} /> : <DiamondBlock size={18} />}
                        {ed === "java" ? "Java Edition" : "Bedrock Edition"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {ed === "java"
                          ? "PC, Mac, Linux — Full mod support"
                          : "Mobile, Console, Windows 10+"}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 2: Version & Loader */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-xl font-bold mb-1">Pick your version</h2>
                <p className="text-sm text-muted-foreground">Choose the Minecraft version and server software.</p>
              </div>

              <div className="space-y-2">
                <Label>Minecraft Version</Label>
                <Select
                  defaultValue={form.getValues("game_version")}
                  onValueChange={(v) => form.setValue("game_version", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {versions.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Server Software</Label>
                <div className="grid grid-cols-2 gap-2">
                  {loaders.map((loader) => (
                    <Card
                      key={loader.id}
                      className={cn(
                        "p-3 cursor-pointer transition-all border-2",
                        form.watch("loader") === loader.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40"
                      )}
                      onClick={() => form.setValue("loader", loader.id as CreateServerInput["loader"])}
                    >
                      <div className="font-semibold text-sm">{loader.label}</div>
                      <div className="text-xs text-muted-foreground">{loader.desc}</div>
                    </Card>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3: Region & Resources */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-xl font-bold mb-1">Almost ready!</h2>
                <p className="text-sm text-muted-foreground">Choose a region for your server.</p>
              </div>

              {regions.length > 0 && (
                <div className="space-y-2">
                  <Label>Region</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {regions.map((region) => (
                      <Card
                        key={region.id}
                        className={cn(
                          "p-3 cursor-pointer transition-all border-2",
                          form.watch("region_id") === region.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40"
                        )}
                        onClick={() => form.setValue("region_id", region.id)}
                      >
                        <div className="flex items-center gap-2">
                          {region.flag_emoji ? (
                            <span className="text-base">{region.flag_emoji}</span>
                          ) : (
                            <CompassIcon size={16} />
                          )}
                          <div className="font-minecraft text-[9px]">{region.name}</div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              <div
                className="p-4 space-y-5"
                style={{ border: "2px solid hsl(var(--border))", background: "rgba(0,0,0,0.2)" }}
              >
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-2">
                    <StarIcon size={14} />
                    <span className="font-minecraft text-[10px] uppercase">Resources</span>
                  </p>
                  {!planKey && (
                    <Link
                      href={`/${locale}/upgrade`}
                      className="text-xs text-primary hover:underline font-minecraft uppercase"
                    >
                      Upgrade for more →
                    </Link>
                  )}
                </div>
                <PixelSlider
                  label="RAM"
                  value={form.watch("ram_mb")}
                  min={512}
                  max={maxRamMb}
                  step={512}
                  onChange={(v) => form.setValue("ram_mb", v)}
                  format={(v) => v >= 1024 ? `${(v / 1024).toFixed(v % 1024 === 0 ? 0 : 1)} GB` : `${v} MB`}
                />
                <PixelSlider
                  label="Disk"
                  value={form.watch("disk_mb")}
                  min={1024}
                  max={maxDiskMb}
                  step={1024}
                  onChange={(v) => form.setValue("disk_mb", v)}
                  format={(v) => v >= 1024 ? `${(v / 1024).toFixed(v % 1024 === 0 ? 0 : 1)} GB` : `${v} MB`}
                />
                <PixelSlider
                  label="CPU"
                  value={form.watch("cpu_percent")}
                  min={25}
                  max={maxCpuPercent}
                  step={25}
                  onChange={(v) => form.setValue("cpu_percent", v)}
                  format={(v) => v >= 100 ? `${(v / 100).toFixed(v % 100 === 0 ? 0 : 1)} cores` : `${v}%`}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-between mt-8">
          <Button
            type="button"
            variant="outline"
            onClick={() => (step === 0 ? router.back() : setStep((s) => s - 1))}
          >
            Back
          </Button>

          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={handleNext}>
              Next →
            </Button>
          ) : (
            <Button
              type="button"
              disabled={loading}
              className="gap-2"
              onClick={() => form.handleSubmit(onSubmit)()}
            >
              {loading && <LoadingSpinner size={14} />}
              {loading ? "Creating..." : "Create Server"}
            </Button>
          )}
        </div>
      </div>

      {modpackOpen && (
        <ModpackBrowser
          onPick={(mp) => {
            setPicked(mp);
            setEdition("java");
            form.setValue("edition", "java");
            form.setValue("loader", (mp.loader === "fabric" || mp.loader === "forge" || mp.loader === "neoforge" || mp.loader === "quilt" ? mp.loader : "fabric") as CreateServerInput["loader"]);
            form.setValue("game_version", mp.game_version);
            if (!form.getValues("name")) form.setValue("name", mp.title.slice(0, 32));
            setModpackOpen(false);
          }}
          onClose={() => setModpackOpen(false)}
        />
      )}
    </div>
  );
}
