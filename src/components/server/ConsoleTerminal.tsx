"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useSupabaseClient } from "@/lib/supabase/client";
import { Maximize2, Minimize2, Trash2, ChevronRight, ArrowDown } from "lucide-react";
import { PixelButton } from "@/components/pixel/PixelPanel";
import { LoadingSpinner } from "@/components/shared/MinecraftLoader";
import { cn } from "@/lib/utils";

interface ConsoleTerminalProps {
  serverId: string;
}

// Common Minecraft server commands for autocomplete
const COMMAND_HINTS = [
  "help", "list", "stop", "save-all", "save-on", "save-off",
  "op ", "deop ", "kick ", "ban ", "pardon ", "whitelist ",
  "say ", "tell ", "tellraw ", "msg ", "me ",
  "give ", "summon ", "kill ", "tp ", "teleport ",
  "gamemode ", "difficulty ", "weather ", "time ", "seed",
  "spawnpoint ", "setworldspawn", "worldborder ", "gamerule ",
  "effect ", "enchant ", "clear ", "fill ", "setblock ", "clone ",
  "execute ", "function ", "playsound ", "particle ",
];

export function ConsoleTerminal({ serverId }: ConsoleTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<import("@xterm/xterm").Terminal | null>(null);
  const fitRef = useRef<import("@xterm/addon-fit").FitAddon | null>(null);
  const [connected, setConnected] = useState(false);
  const [input, setInput] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = useSupabaseClient();

  // Smart auto-scroll: true while the user is pinned to the bottom.
  // Set to false the moment they scroll up; set back to true when they
  // manually scroll back down (or click the jump button).
  const autoScrollRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);

  // Command history — persisted to localStorage
  const historyKey = `mcloud-console-history-${serverId}`;
  const historyRef = useRef<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);
  const [draftInput, setDraftInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(historyKey);
      if (raw) historyRef.current = JSON.parse(raw);
    } catch {}
  }, [historyKey]);

  function pushHistory(cmd: string) {
    historyRef.current = [...historyRef.current.filter((c) => c !== cmd), cmd].slice(-50);
    try { localStorage.setItem(historyKey, JSON.stringify(historyRef.current)); } catch {}
    setHistoryIdx(-1);
  }

  useEffect(() => {
    let term: import("@xterm/xterm").Terminal;
    let observer: ResizeObserver | null = null;
    let cleanup: (() => void) | null = null;

    async function init() {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");

      term = new Terminal({
        theme: {
          background: "#0a0a0a",
          foreground: "#d4d4d4",
          cursor: "#5a9a2e",
          selectionBackground: "rgba(90,154,46,0.3)",
          black: "#1a1a1a",
          green: "#5a9a2e",
          yellow: "#e8c93a",
          red: "#d92424",
          cyan: "#38bdf8",
          white: "#e5e5e5",
          brightGreen: "#6db535",
          brightBlack: "#3f3f3f",
        },
        fontFamily: '"Geist Mono", "Fira Code", Consolas, monospace',
        fontSize: 12,
        lineHeight: 1.4,
        cursorBlink: true,
        convertEol: true,
        scrollback: 5000,
        disableStdin: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      fitRef.current = fitAddon;

      if (containerRef.current) {
        term.open(containerRef.current);
        fitAddon.fit();
      }
      termRef.current = term;

      observer = new ResizeObserver(() => { try { fitAddon.fit(); } catch {} });
      if (containerRef.current) observer.observe(containerRef.current);

      // Track whether the user is scrolled to the bottom.
      // xterm fires onScroll with the new viewportY (lines from top).
      // We're "at bottom" when viewportY + visible rows >= total buffer lines.
      term.onScroll(() => {
        const buf = term.buffer.active;
        const isAtBottom = buf.viewportY + term.rows >= buf.length;
        autoScrollRef.current = isAtBottom;
        setAtBottom(isAtBottom);
      });

      function colorLine(line: string, source: string) {
        let color = "\x1b[0m";
        if (source === "user") color = "\x1b[32m";
        else if (source === "system") color = "\x1b[36m";
        else if (line.includes("ERROR") || line.includes("Exception")) color = "\x1b[31m";
        else if (line.includes("WARN")) color = "\x1b[33m";
        term.writeln(`${color}${line}\x1b[0m`);
        // Only scroll when the user is already pinned to the bottom — if they've
        // scrolled up to read history we leave the viewport exactly where it is.
        if (autoScrollRef.current) {
          term.scrollToBottom();
        }
      }

      // Load existing logs then snap to bottom (initial load always scrolls down)
      try {
        const res = await fetch(`/api/servers/${serverId}/console`);
        const events = await res.json();
        for (const event of events) {
          colorLine(event.line, event.source);
        }
        term.scrollToBottom();
        autoScrollRef.current = true;
        setAtBottom(true);
      } catch {}

      // Broadcast (fast)
      const broadcastChannel = supabase
        .channel(`console:${serverId}`, { config: { broadcast: { self: false } } })
        .on("broadcast", { event: "line" }, (msg) => {
          const { line, source } = msg.payload as { line: string; source: string };
          colorLine(line, source);
        })
        .subscribe((status) => { if (status === "SUBSCRIBED") setConnected(true); });

      // DB fallback
      const dbChannel = supabase
        .channel(`console-db-${serverId}`)
        .on("postgres_changes", {
          event: "INSERT", schema: "mcloud", table: "console_events",
          filter: `server_id=eq.${serverId}`,
        }, (payload) => {
          const { line, source } = payload.new as { line: string; source: string };
          colorLine(line, source);
        })
        .subscribe();

      setConnected(true);

      cleanup = () => {
        broadcastChannel.unsubscribe();
        dbChannel.unsubscribe();
        term.dispose();
      };
    }

    void init();
    return () => {
      observer?.disconnect();
      cleanup?.();
    };
  }, [serverId, supabase]);

  // Refit terminal when fullscreen toggles
  useEffect(() => {
    const t = setTimeout(() => { try { fitRef.current?.fit(); } catch {} }, 50);
    return () => clearTimeout(t);
  }, [fullscreen]);

  const onInputChange = useCallback((v: string) => {
    setInput(v);
    setHistoryIdx(-1);
    if (!v.trim()) { setSuggestions([]); return; }
    const lower = v.toLowerCase();
    setSuggestions(COMMAND_HINTS.filter((c) => c.startsWith(lower)).slice(0, 5));
  }, []);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const hist = historyRef.current;
      if (!hist.length) return;
      const next = historyIdx === -1 ? hist.length - 1 : Math.max(0, historyIdx - 1);
      if (historyIdx === -1) setDraftInput(input);
      setHistoryIdx(next);
      setInput(hist[next]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIdx === -1) return;
      const hist = historyRef.current;
      const next = historyIdx + 1;
      if (next >= hist.length) { setInput(draftInput); setHistoryIdx(-1); }
      else { setInput(hist[next]); setHistoryIdx(next); }
    } else if (e.key === "Tab" && suggestions.length) {
      e.preventDefault();
      setInput(suggestions[0]);
      setSuggestions([]);
    } else if (e.key === "Escape") {
      setSuggestions([]);
    }
  }

  function jumpToBottom() {
    termRef.current?.scrollToBottom();
    autoScrollRef.current = true;
    setAtBottom(true);
  }

  async function sendCommand(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    const cmd = input.trim();
    setInput(""); setSuggestions([]);
    pushHistory(cmd);
    if (termRef.current) {
      // Sending a command always snaps back to the bottom
      autoScrollRef.current = true;
      setAtBottom(true);
      termRef.current.writeln(`\x1b[32m> ${cmd}\x1b[0m`);
      termRef.current.scrollToBottom();
    }
    await fetch(`/api/servers/${serverId}/console`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: cmd }),
    });
    inputRef.current?.focus();
  }

  function clearTerm() {
    termRef.current?.clear();
    autoScrollRef.current = true;
    setAtBottom(true);
  }

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden",
        fullscreen ? "fixed inset-0 z-50" : "h-[calc(100vh-220px)] min-h-[400px]",
      )}
      style={{
        background: "#0a0a0a",
        border: "2px solid hsl(var(--border))",
        borderRadius: 0,
        boxShadow: fullscreen ? "none" : "inset 1px 1px 0 rgba(255,255,255,0.04), 3px 3px 0 rgba(0,0,0,0.3)",
      }}
    >
      {/* Status bar — pixel-art chrome */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 border-b-2 border-border"
        style={{ background: "rgba(0,0,0,0.5)" }}
      >
        <div className={cn("w-2 h-2", connected ? "bg-primary" : "bg-zinc-600")}
          style={{ boxShadow: connected ? "0 0 4px #5a9a2e" : "none" }} />
        <span className="text-[10px] text-zinc-400 font-minecraft uppercase">
          {connected ? "Connected" : "Connecting"}
        </span>
        {!connected && <LoadingSpinner size={10} className="text-zinc-400" />}
        <div className="flex-1" />
        <PixelButton size="sm" variant="ghost" onClick={clearTerm}>
          <Trash2 className="w-3 h-3" />
          Clear
        </PixelButton>
        <PixelButton size="sm" variant="ghost" onClick={() => setFullscreen((v) => !v)}>
          {fullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          {fullscreen ? "Exit" : "Full"}
        </PixelButton>
      </div>

      {/* Terminal + floating jump-to-bottom button */}
      <div className="relative flex-1 min-h-0">
        <div ref={containerRef} className="absolute inset-0 p-2 overflow-hidden" />

        {/* Appears only when the user has scrolled up — click to snap back */}
        {!atBottom && (
          <button
            type="button"
            onClick={jumpToBottom}
            className="absolute bottom-3 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-minecraft uppercase transition-opacity"
            style={{
              background: "rgba(10,10,10,0.92)",
              border: "2px solid #5a9a2e",
              borderRadius: 0,
              color: "#5a9a2e",
              boxShadow: "0 0 8px rgba(90,154,46,0.35), 2px 2px 0 rgba(0,0,0,0.5)",
            }}
          >
            <ArrowDown className="w-3 h-3" />
            Jump to bottom
          </button>
        )}
      </div>

      {/* Suggestion bar */}
      {suggestions.length > 0 && (
        <div
          className="flex items-center gap-1 px-3 py-1.5 border-t border-border/40 overflow-x-auto"
          style={{ background: "rgba(0,0,0,0.4)" }}
        >
          <span className="text-[10px] text-muted-foreground font-minecraft uppercase mr-1">Tab:</span>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { setInput(s); setSuggestions([]); inputRef.current?.focus(); }}
              className="px-2 py-0.5 text-[11px] font-mono text-primary border border-primary/40 hover:bg-primary/10"
              style={{ borderRadius: 0 }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input — Minecraft chat-style */}
      <form
        onSubmit={sendCommand}
        className="flex items-center gap-2 px-3 py-2 border-t-2 border-border"
        style={{ background: "rgba(0,0,0,0.5)" }}
      >
        <ChevronRight className="w-4 h-4 text-primary shrink-0" />
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a command — ↑↓ history, Tab autocomplete"
          className="flex-1 bg-transparent text-sm font-mono text-zinc-100 placeholder:text-zinc-600 outline-none"
          autoComplete="off"
          spellCheck={false}
        />
        <span className="text-[10px] text-muted-foreground font-minecraft">
          {historyRef.current.length > 0 && `${historyRef.current.length}H`}
        </span>
      </form>
    </div>
  );
}
