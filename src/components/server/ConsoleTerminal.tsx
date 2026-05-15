"use client";
import { useEffect, useRef, useState } from "react";
import { useSupabaseClient } from "@/lib/supabase/client";
import { LoadingSpinner } from "@/components/shared/MinecraftLoader";

interface ConsoleTerminalProps {
  serverId: string;
}

export function ConsoleTerminal({ serverId }: ConsoleTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<import("@xterm/xterm").Terminal | null>(null);
  const [connected, setConnected] = useState(false);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = useSupabaseClient();

  useEffect(() => {
    let term: import("@xterm/xterm").Terminal;

    async function init() {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");

      term = new Terminal({
        theme: {
          background: "hsl(0 0% 5%)",
          foreground: "hsl(0 0% 90%)",
          cursor: "#22c55e",
          selectionBackground: "rgba(34,197,94,0.3)",
          black: "#1a1a1a",
          green: "#22c55e",
          yellow: "#facc15",
          red: "#ef4444",
          cyan: "#22d3ee",
          white: "#e5e5e5",
          brightGreen: "#4ade80",
          brightBlack: "#3f3f3f",
        },
        fontFamily: '"Geist Mono", "Fira Code", Consolas, monospace',
        fontSize: 13,
        lineHeight: 1.5,
        cursorBlink: false,
        convertEol: true,
        scrollback: 1000,
        disableStdin: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      if (containerRef.current) {
        term.open(containerRef.current);
        fitAddon.fit();
      }
      termRef.current = term;

      const observer = new ResizeObserver(() => fitAddon.fit());
      if (containerRef.current) observer.observe(containerRef.current);

      // Load existing logs
      try {
        const res = await fetch(`/api/servers/${serverId}/console`);
        const events = await res.json();
        for (const event of events) {
          const color =
            event.source === "user"
              ? "\x1b[32m"
              : event.source === "system"
              ? "\x1b[36m"
              : "\x1b[0m";
          term.writeln(`${color}${event.line}\x1b[0m`);
        }
      } catch {}

      // Subscribe to realtime
      const channel = supabase
        .channel(`console-${serverId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "console_events",
            filter: `server_id=eq.${serverId}`,
          },
          (payload) => {
            const { line, source } = payload.new as { line: string; source: string };
            const color =
              source === "user"
                ? "\x1b[32m"
                : source === "system"
                ? "\x1b[36m"
                : "\x1b[0m";
            term.writeln(`${color}${line}\x1b[0m`);
          }
        )
        .subscribe();

      setConnected(true);

      return () => {
        observer.disconnect();
        channel.unsubscribe();
        term.dispose();
      };
    }

    const cleanup = init();
    return () => {
      cleanup.then((fn) => fn?.());
    };
  }, [serverId, supabase]);

  async function sendCommand(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    const cmd = input.trim();
    setInput("");
    await fetch(`/api/servers/${serverId}/console`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: cmd }),
    });
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-col h-full rounded-lg border border-border overflow-hidden bg-[hsl(0_0%_5%)]">
      {/* Status bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-[hsl(0_0%_7%)]">
        <div
          className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-zinc-500"}`}
        />
        <span className="text-xs text-zinc-400 font-mono">
          {connected ? "Connected" : "Connecting..."}
        </span>
        {!connected && <LoadingSpinner size={12} className="text-zinc-400" />}
      </div>

      {/* Terminal */}
      <div
        ref={containerRef}
        className="flex-1 min-h-[300px] p-2"
        style={{ height: "calc(100% - 84px)" }}
      />

      {/* Input */}
      <form
        onSubmit={sendCommand}
        className="flex items-center gap-2 p-2 border-t border-border/50 bg-[hsl(0_0%_7%)]"
      >
        <span className="text-green-500 font-mono text-sm shrink-0">&gt;</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a command and press Enter..."
          className="flex-1 bg-transparent text-sm font-mono text-zinc-200 placeholder:text-zinc-600 outline-none"
          autoComplete="off"
          spellCheck={false}
        />
      </form>
    </div>
  );
}
