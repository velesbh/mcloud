"use client";
import { use, useEffect, useState } from "react";
import { Save, RefreshCcw, AlertTriangle, Info, Search } from "lucide-react";
import { PixelPanel, PixelButton } from "@/components/pixel/PixelPanel";
import { LoadingSpinner } from "@/components/shared/MinecraftLoader";
import { toast } from "sonner";

/**
 * server.properties editor — knows the schema for ~30 common fields,
 * renders them as toggles/dropdowns/numbers/text. Falls back to plain
 * text input for unknown fields and shows them in a separate section.
 */

type FieldType = "bool" | "int" | "string" | "select";
interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  desc?: string;
  min?: number; max?: number;
  group: "Game" | "World" | "Network" | "Players" | "Performance" | "Security";
}

const FIELD_SCHEMA: FieldSpec[] = [
  // Game
  { key: "gamemode", label: "Default gamemode", type: "select", group: "Game",
    options: [
      { value: "survival", label: "Survival" },
      { value: "creative", label: "Creative" },
      { value: "adventure", label: "Adventure" },
      { value: "spectator", label: "Spectator" },
    ],
    desc: "Game mode for new players" },
  { key: "force-gamemode", label: "Force gamemode on join", type: "bool", group: "Game",
    desc: "Override per-player gamemode" },
  { key: "difficulty", label: "Difficulty", type: "select", group: "Game",
    options: [
      { value: "peaceful", label: "Peaceful" },
      { value: "easy", label: "Easy" },
      { value: "normal", label: "Normal" },
      { value: "hard", label: "Hard" },
    ] },
  { key: "hardcore", label: "Hardcore", type: "bool", group: "Game",
    desc: "Permadeath, bans on death" },
  { key: "pvp", label: "PvP enabled", type: "bool", group: "Game" },
  { key: "allow-flight", label: "Allow flight", type: "bool", group: "Game",
    desc: "Needed for some plugins / creative gameplay" },
  { key: "spawn-monsters", label: "Spawn monsters", type: "bool", group: "Game" },
  { key: "spawn-animals", label: "Spawn animals", type: "bool", group: "Game" },
  { key: "spawn-npcs", label: "Spawn villagers (NPCs)", type: "bool", group: "Game" },

  // World
  { key: "level-name", label: "Active world folder", type: "string", group: "World",
    desc: "Change via Worlds tab — restart required" },
  { key: "level-seed", label: "World seed", type: "string", group: "World",
    desc: "Used only when generating a new world" },
  { key: "level-type", label: "World type", type: "select", group: "World",
    options: [
      { value: "minecraft:normal", label: "Normal" },
      { value: "minecraft:flat", label: "Superflat" },
      { value: "minecraft:large_biomes", label: "Large biomes" },
      { value: "minecraft:amplified", label: "Amplified" },
      { value: "minecraft:single_biome_surface", label: "Single biome" },
    ] },
  { key: "generate-structures", label: "Generate structures", type: "bool", group: "World" },
  { key: "allow-nether", label: "Allow Nether", type: "bool", group: "World" },
  { key: "spawn-protection", label: "Spawn protection radius", type: "int", group: "World",
    min: 0, max: 1024, desc: "Blocks around spawn ops can build in" },
  { key: "view-distance", label: "View distance (chunks)", type: "int", group: "World",
    min: 3, max: 32 },
  { key: "simulation-distance", label: "Simulation distance (chunks)", type: "int", group: "World",
    min: 3, max: 32, desc: "How far entities tick" },

  // Players
  { key: "max-players", label: "Max players", type: "int", group: "Players", min: 1, max: 1000 },
  { key: "motd", label: "MOTD", type: "string", group: "Players",
    desc: "Server list description" },
  { key: "white-list", label: "Whitelist enabled", type: "bool", group: "Players" },
  { key: "enforce-whitelist", label: "Enforce whitelist", type: "bool", group: "Players",
    desc: "Kick non-whitelisted players when toggled" },
  { key: "op-permission-level", label: "Default op level", type: "select", group: "Players",
    options: [
      { value: "1", label: "1 — bypass spawn protection" },
      { value: "2", label: "2 — commands /clear /difficulty etc" },
      { value: "3", label: "3 — /ban /kick /op /save-all" },
      { value: "4", label: "4 — /stop and full admin" },
    ] },
  { key: "player-idle-timeout", label: "Idle timeout (min)", type: "int", group: "Players",
    min: 0, max: 1440, desc: "0 = never kick" },

  // Network
  { key: "server-port", label: "Server port", type: "int", group: "Network",
    min: 1, max: 65535, desc: "Set via Ports tab" },
  { key: "server-ip", label: "Bind IP", type: "string", group: "Network",
    desc: "0.0.0.0 = all interfaces" },
  { key: "network-compression-threshold", label: "Network compression (bytes)", type: "int", group: "Network",
    min: -1, max: 1500, desc: "-1 disables. Lower = more CPU, less bandwidth." },
  { key: "rate-limit", label: "Packet rate-limit", type: "int", group: "Network",
    min: 0, max: 1000, desc: "0 = no limit" },
  { key: "enable-status", label: "Show in server list ping", type: "bool", group: "Network" },
  { key: "enable-query", label: "Enable GameSpy4 query", type: "bool", group: "Network" },
  { key: "query.port", label: "Query port", type: "int", group: "Network", min: 1, max: 65535 },
  { key: "enable-rcon", label: "Enable RCON", type: "bool", group: "Network",
    desc: "Remote console — set rcon.password if enabled" },
  { key: "rcon.port", label: "RCON port", type: "int", group: "Network", min: 1, max: 65535 },

  // Security
  { key: "online-mode", label: "Online mode (auth required)", type: "bool", group: "Security",
    desc: "OFF = cracked / offline mode — anyone can join with any username" },
  { key: "prevent-proxy-connections", label: "Block VPN/proxy connections", type: "bool", group: "Security" },
  { key: "enforce-secure-profile", label: "Require Mojang-signed profiles", type: "bool", group: "Security",
    desc: "Disables joining without a valid Mojang public-key signature" },

  // Performance
  { key: "max-tick-time", label: "Max tick time (ms)", type: "int", group: "Performance",
    min: -1, max: 240000, desc: "-1 = watchdog disabled" },
  { key: "max-world-size", label: "Max world size (blocks)", type: "int", group: "Performance",
    min: 1, max: 29999984 },
  { key: "entity-broadcast-range-percentage", label: "Entity broadcast range %", type: "int", group: "Performance",
    min: 10, max: 1000 },
  { key: "function-permission-level", label: "Function permission level", type: "select", group: "Performance",
    options: [
      { value: "1", label: "1" }, { value: "2", label: "2" },
      { value: "3", label: "3" }, { value: "4", label: "4" },
    ] },
];

const KNOWN_KEYS = new Set(FIELD_SCHEMA.map((f) => f.key));

function parseProperties(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1);
    out[key] = value;
  }
  return out;
}

function serializeProperties(values: Record<string, string>, originalText: string): string {
  // Preserve comments + line ordering from the original, just replace values.
  const lines = originalText.split("\n");
  const handled = new Set<string>();
  const result: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) { result.push(line); continue; }
    const eq = trimmed.indexOf("=");
    if (eq === -1) { result.push(line); continue; }
    const key = trimmed.slice(0, eq).trim();
    if (key in values) {
      result.push(`${key}=${values[key]}`);
      handled.add(key);
    } else {
      result.push(line);
    }
  }
  // Append any new keys that weren't in the file
  for (const [k, v] of Object.entries(values)) {
    if (!handled.has(k)) result.push(`${k}=${v}`);
  }
  return result.join("\n");
}

export default function PropertiesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [original, setOriginal] = useState<string>("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/servers/${id}/files/content?path=/server.properties`);
      if (res.ok) {
        const text = await res.text();
        setOriginal(text);
        setValues(parseProperties(text));
      } else {
        // No properties file yet — start blank with defaults
        setOriginal("");
        setValues({});
      }
    } catch (e) {
      toast.error(`Failed to load: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [id]);

  function set(key: string, val: string) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  async function save() {
    setSaving(true);
    try {
      const text = serializeProperties(values, original);
      const res = await fetch(`/api/servers/${id}/files/content?path=/server.properties`, {
        method: "PUT",
        headers: { "Content-Type": "text/plain" },
        body: text,
      });
      if (res.ok) {
        toast.success("Saved — restart to apply");
        setOriginal(text);
      } else {
        toast.error("Save failed");
      }
    } finally { setSaving(false); }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><LoadingSpinner size={28} /></div>;
  }

  const groups: FieldSpec["group"][] = ["Game", "World", "Players", "Network", "Security", "Performance"];
  const unknownKeys = Object.keys(values).filter((k) => !KNOWN_KEYS.has(k));
  const lower = filter.toLowerCase();
  const matchesFilter = (f: FieldSpec) =>
    !lower || f.key.toLowerCase().includes(lower) || f.label.toLowerCase().includes(lower);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <PixelPanel variant="dark" className="p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter properties..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-background border-2 border-border focus:border-primary outline-none"
              style={{ borderRadius: 0 }}
            />
          </div>
          <PixelButton onClick={load}>
            <RefreshCcw className="w-3 h-3" />
            Reload
          </PixelButton>
          <PixelButton variant="green" onClick={save} disabled={saving}>
            {saving ? <LoadingSpinner size={12} /> : <Save className="w-3 h-3" />}
            {saving ? "Saving..." : "Save"}
          </PixelButton>
        </div>
      </PixelPanel>

      <div
        className="text-xs px-3 py-2 flex items-start gap-2"
        style={{ background: "rgba(56,189,248,0.08)", border: "2px solid rgba(56,189,248,0.3)" }}
      >
        <Info className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
        <span className="text-muted-foreground">
          Changes to <code className="text-foreground">server.properties</code> take effect on the next server restart.
        </span>
      </div>

      {/* Grouped fields */}
      {groups.map((g) => {
        const fields = FIELD_SCHEMA.filter((f) => f.group === g && matchesFilter(f));
        if (fields.length === 0) return null;
        return (
          <PixelPanel key={g} variant="stone" title={g} className="p-0">
            <div className="divide-y-2 divide-border/40">
              {fields.map((f) => (
                <Field
                  key={f.key}
                  spec={f}
                  value={values[f.key] ?? ""}
                  onChange={(v) => set(f.key, v)}
                />
              ))}
            </div>
          </PixelPanel>
        );
      })}

      {/* Unknown keys — plain text input */}
      {unknownKeys.length > 0 && filter === "" && (
        <PixelPanel variant="wood" title="Other / Custom Keys" icon={<AlertTriangle className="w-3 h-3" />} className="p-0">
          <div className="divide-y-2 divide-border/40">
            {unknownKeys.map((key) => (
              <div key={key} className="flex items-center gap-3 px-4 py-3">
                <code className="text-xs font-mono text-muted-foreground flex-1 truncate">{key}</code>
                <input
                  value={values[key] ?? ""}
                  onChange={(e) => set(key, e.target.value)}
                  className="w-48 px-2 py-1 text-xs font-mono bg-background border-2 border-border focus:border-primary outline-none"
                  style={{ borderRadius: 0 }}
                />
              </div>
            ))}
          </div>
        </PixelPanel>
      )}
    </div>
  );
}

function Field({
  spec, value, onChange,
}: {
  spec: FieldSpec; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="flex-1 min-w-0">
        <label className="text-sm text-foreground block">{spec.label}</label>
        <code className="text-[10px] font-mono text-muted-foreground">{spec.key}</code>
        {spec.desc && (
          <p className="text-[10px] text-muted-foreground mt-0.5">{spec.desc}</p>
        )}
      </div>
      <div className="shrink-0 w-44">
        {spec.type === "bool" ? (
          <ToggleSwitch checked={value === "true"} onChange={(b) => onChange(b ? "true" : "false")} />
        ) : spec.type === "select" ? (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-2 py-1.5 text-xs font-mono bg-background border-2 border-border focus:border-primary outline-none"
            style={{ borderRadius: 0 }}
          >
            <option value="">—</option>
            {spec.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : spec.type === "int" ? (
          <input
            type="number" min={spec.min} max={spec.max}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-2 py-1.5 text-xs font-mono bg-background border-2 border-border focus:border-primary outline-none"
            style={{ borderRadius: 0 }}
          />
        ) : (
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-2 py-1.5 text-xs font-mono bg-background border-2 border-border focus:border-primary outline-none"
            style={{ borderRadius: 0 }}
          />
        )}
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (b: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="relative w-12 h-6 transition-colors border-2"
      style={{
        background: checked ? "#5a9a2e" : "#3a3a3a",
        borderColor: checked ? "#4a7a1e" : "#1a1a1a",
        borderRadius: 0,
      }}
    >
      <span
        className="absolute top-0.5 w-4 h-4 transition-all"
        style={{
          left: checked ? "calc(100% - 18px)" : "2px",
          background: "#e5e5e5",
          border: "1px solid #1a1a1a",
        }}
      />
    </button>
  );
}
