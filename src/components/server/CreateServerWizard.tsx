"use client";
import { useState, useEffect } from "react";
import { Package, AlertTriangle, CheckCircle, Loader2, ServerOff, Lock, ExternalLink } from "lucide-react";
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
  MC_BEDROCK_VERSIONS,
  JAVA_LOADERS,
  BEDROCK_LOADERS,
  FREE_TIER,
} from "@/lib/constants";
import { useMcVersions } from "@/hooks/useMcVersions";
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
  const [eulaAccepted, setEulaAccepted] = useState(false);
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

  // Watch resource values for stock pre-flight
  const watchedRam = form.watch("ram_mb");
  const watchedDisk = form.watch("disk_mb");
  const watchedRegion = form.watch("region_id");

  type RegionStock = {
    available: boolean;
    reason: "noCapacity" | "noAllocations" | null;
    max_free_ram_mb: number;
    max_free_disk_mb: number;
    online_nodes: number;
  };
  type RegionStockResult = {
    any: boolean;
    regions: Record<string, RegionStock>;
  };
  type StockResult = {
    available: boolean;
    reason: "noCapacity" | "noAllocations" | null;
    fitting_nodes: number;
    online_nodes: number;
    max_free_ram_mb: number;
    max_free_disk_mb: number;
  };

  // Per-region availability — fetched whenever RAM/disk changes on step 2.
  // Powers the greyed-out region cards so users see capacity before picking.
  const { data: regionStock, isFetching: regionStockFetching } = useQuery<RegionStockResult | null>({
    queryKey: ["stock-regions", watchedRam, watchedDisk],
    queryFn: async () => {
      const params = new URLSearchParams({ ram_mb: String(watchedRam), disk_mb: String(watchedDisk) });
      const res = await fetch(`/api/stock/regions?${params}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: step === 2 && !!watchedRam && !!watchedDisk,
    staleTime: 15_000,
    retry: 1,
  });

  // If the currently-selected region becomes unavailable, clear it so the
  // user is nudged to pick an available one.
  useEffect(() => {
    if (!regionStock || !watchedRegion) return;
    const rs = regionStock.regions[watchedRegion];
    if (rs && !rs.available) {
      form.setValue("region_id", undefined as unknown as string);
    }
  }, [regionStock, watchedRegion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Overall stock check (scoped to the selected region if one is chosen)
  const { data: stock, isFetching: stockFetching, isError: stockError } = useQuery<StockResult | null>({
    queryKey: ["stock", watchedRam, watchedDisk, watchedRegion],
    queryFn: async () => {
      const params = new URLSearchParams({
        ram_mb: String(watchedRam),
        disk_mb: String(watchedDisk),
      });
      if (watchedRegion) params.set("region_id", watchedRegion);
      const res = await fetch(`/api/stock?${params}`);
      if (!res.ok) throw new Error("stock check failed");
      return res.json();
    },
    enabled: step === 2 && !!watchedRam && !!watchedDisk,
    staleTime: 15_000,
    retry: 1,
  });

  // Derived: is creation blocked right now?
  const stockUnavailable = !stockFetching && !stockError && !!stock && !stock.available;

  const watchedLoader = form.watch("loader");
  const { data: javaVersions = [], isLoading: versionsLoading } = useMcVersions(
    edition === "java" ? watchedLoader : "vanilla"
  );
  const versions = edition === "java" ? javaVersions : MC_BEDROCK_VERSIONS;
  const loaders = edition === "java" ? JAVA_LOADERS : BEDROCK_LOADERS;

  // When loader changes and current version isn't in the new list, pick the first available
  useEffect(() => {
    if (edition !== "java" || javaVersions.length === 0) return;
    const cur = form.getValues("game_version");
    if (!javaVersions.includes(cur)) {
      form.setValue("game_version", javaVersions[0], { shouldValidate: false });
    }
  }, [javaVersions]); // eslint-disable-line react-hooks/exhaustive-deps

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
          toast.error("You've reached your server limit. Upgrade your plan for more servers.");
        } else if (result.error === "outOfStock") {
          toast.error("No nodes have enough capacity right now. Try a smaller server or a different region.");
        } else if (result.error === "noAllocations") {
          toast.error("No free IP:port slots are available. Ask an admin to add allocations.");
        } else if (result.error === "premiumReserved") {
          toast.error("Remaining capacity is reserved for premium users. Upgrade or reduce resources.");
        } else if (result.error === "ramExceedsPlan") {
          toast.error(`Your plan allows up to ${result.quotas?.max_ram_mb ?? "?"} MB RAM.`);
        } else if (result.error === "diskExceedsPlan") {
          toast.error(`Your plan allows up to ${result.quotas?.max_disk_mb ?? "?"} MB disk.`);
        } else {
          toast.error(typeof result.error === "string" ? result.error : "Failed to create server");
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
                  value={form.watch("game_version")}
                  onValueChange={(v) => form.setValue("game_version", v)}
                  disabled={versionsLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={versionsLoading ? "Loading…" : "Select version"} />
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
                  <div className="flex items-center justify-between">
                    <Label>Region</Label>
                    {regionStockFetching && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-minecraft">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Checking capacity…
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {regions.map((region) => {
                      const rs = regionStock?.regions[region.id];
                      // While loading treat all as available (don't flicker)
                      const isUnavailable = !!regionStock && rs !== undefined && !rs.available;
                      const isSelected = form.watch("region_id") === region.id;

                      const unavailableLabel = rs?.reason === "noAllocations"
                        ? "No slots"
                        : rs?.reason === "noCapacity"
                          ? "Full"
                          : null;

                      return (
                        <Card
                          key={region.id}
                          className={cn(
                            "p-3 transition-all border-2 relative",
                            isUnavailable
                              ? "cursor-not-allowed opacity-50 border-border bg-muted/30 select-none"
                              : cn(
                                  "cursor-pointer",
                                  isSelected
                                    ? "border-primary bg-primary/5"
                                    : "border-border hover:border-primary/40"
                                )
                          )}
                          onClick={() => {
                            if (!isUnavailable) form.setValue("region_id", region.id);
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {region.flag_emoji ? (
                                <span className="text-base">{region.flag_emoji}</span>
                              ) : (
                                <CompassIcon size={16} />
                              )}
                              <div className="font-minecraft text-[9px] truncate">{region.name}</div>
                            </div>
                            {isUnavailable && unavailableLabel ? (
                              <span className="flex items-center gap-0.5 text-[8px] font-minecraft uppercase text-muted-foreground bg-muted px-1.5 py-0.5 shrink-0">
                                <Lock className="w-2.5 h-2.5" />
                                {unavailableLabel}
                              </span>
                            ) : isSelected ? (
                              <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" />
                            ) : null}
                          </div>
                          {/* Capacity hint under unavailable cards */}
                          {isUnavailable && rs?.max_free_ram_mb !== undefined && rs.max_free_ram_mb > 0 && rs.max_free_ram_mb < watchedRam && (
                            <p className="mt-1.5 text-[8px] font-minecraft text-muted-foreground leading-tight">
                              Max free: {rs.max_free_ram_mb >= 1024
                                ? `${(rs.max_free_ram_mb / 1024).toFixed(1)} GB RAM`
                                : `${rs.max_free_ram_mb} MB RAM`}
                            </p>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                  {/* All regions full — show a clear message */}
                  {regionStock && !regionStock.any && (
                    <div className="flex items-start gap-2 px-3 py-2.5 text-[10px] font-minecraft text-amber-400 bg-amber-500/10 border border-amber-500/20">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>
                        All regions are at capacity for these resource settings. Reduce RAM or Disk to see available regions.
                      </span>
                    </div>
                  )}
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

              {/* Minecraft EULA acceptance — required before creation */}
              <label
                className={`flex items-start gap-3 p-3 border cursor-pointer select-none transition-colors ${
                  eulaAccepted
                    ? "border-primary/40 bg-primary/5"
                    : "border-border hover:border-primary/30"
                }`}
              >
                {/* Pixel-style checkbox */}
                <div
                  className={`mt-0.5 w-4 h-4 shrink-0 border-2 flex items-center justify-center transition-colors ${
                    eulaAccepted ? "border-primary bg-primary" : "border-muted-foreground bg-background"
                  }`}
                  style={{ borderRadius: 0 }}
                >
                  {eulaAccepted && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="square" />
                    </svg>
                  )}
                </div>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={eulaAccepted}
                  onChange={(e) => setEulaAccepted(e.target.checked)}
                />
                <span className="text-[10px] font-minecraft leading-relaxed text-muted-foreground">
                  I agree to the{" "}
                  <a
                    href="https://aka.ms/MinecraftEULA"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-primary underline inline-flex items-center gap-0.5"
                  >
                    Minecraft End User License Agreement
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  . By creating this server I accept the EULA on behalf of all players.
                </span>
              </label>

              {/* Stock availability banner */}
              {stockFetching ? (
                <div className="flex items-center gap-2 p-3 border border-border text-muted-foreground text-xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Checking availability…
                </div>
              ) : stockError ? (
                <div className="flex items-center gap-2 p-3 border border-yellow-500/30 bg-yellow-500/5 text-yellow-500 text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Could not check availability. You can still try creating — you&apos;ll see an error if the node is full.</span>
                </div>
              ) : stock ? (
                stock.available ? (
                  <div className="flex items-center gap-2 p-3 border border-primary/30 bg-primary/5 text-primary text-xs">
                    <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Capacity available. Your server can be created.
                    </span>
                  </div>
                ) : stock.reason === "noCapacity" ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 p-3 border border-destructive/40 bg-destructive/5 text-destructive text-xs">
                      <ServerOff className="w-3.5 h-3.5 shrink-0" />
                      <span>No nodes have enough free capacity for these specs.</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground px-1 space-y-0.5">
                      {stock.max_free_ram_mb > 0 && stock.max_free_ram_mb < watchedRam && (
                        <p>• Max available RAM: <span className="text-foreground font-medium">{stock.max_free_ram_mb >= 1024 ? `${(stock.max_free_ram_mb / 1024).toFixed(1)} GB` : `${stock.max_free_ram_mb} MB`}</span> — reduce RAM</p>
                      )}
                      {stock.max_free_disk_mb > 0 && stock.max_free_disk_mb < watchedDisk && (
                        <p>• Max available Disk: <span className="text-foreground font-medium">{stock.max_free_disk_mb >= 1024 ? `${(stock.max_free_disk_mb / 1024).toFixed(1)} GB` : `${stock.max_free_disk_mb} MB`}</span> — reduce disk</p>
                      )}
                      {stock.online_nodes === 0 && (
                        <p>• No nodes are currently online. Contact an admin.</p>
                      )}
                      {stock.max_free_ram_mb === 0 && stock.max_free_disk_mb === 0 && stock.online_nodes > 0 && (
                        <p>• All nodes are at full capacity. An admin can increase overallocation or add a new node.</p>
                      )}
                    </div>
                  </div>
                ) : stock.reason === "noAllocations" ? (
                  <div className="flex items-center gap-2 p-3 border border-yellow-500/30 bg-yellow-500/5 text-yellow-500 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Nodes have capacity but no free IP:port slots. An admin needs to add allocations in Admin → Allocations.</span>
                  </div>
                ) : null
              ) : null}
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
              disabled={loading || stockFetching || stockUnavailable || !eulaAccepted}
              className="gap-2"
              onClick={() => form.handleSubmit(onSubmit)()}
              title={
                !eulaAccepted
                  ? "You must accept the Minecraft EULA before creating a server"
                  : stockUnavailable
                    ? stock?.reason === "noAllocations"
                      ? "No free IP:port allocations available"
                      : "No nodes have enough capacity"
                    : undefined
              }
            >
              {loading && <LoadingSpinner size={14} />}
              {loading ? "Creating..." : stockFetching ? "Checking…" : "Create Server"}
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
