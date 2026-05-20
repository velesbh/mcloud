import { wcSupabase } from "./webcloud-supabase.js";
import { log } from "./logger.js";

/**
 * Per-deployment log channel.
 *
 * Build/runtime stdout+stderr is funneled through `emit()`:
 *   1. The line is broadcast on `deploy:{deploymentId}` (UI streams via
 *      Supabase Realtime — see `useDeploymentLogs.ts`).
 *   2. The line is buffered and flushed in batches to `deployment_logs` for
 *      historical viewing. Batching keeps insert volume sane during a chatty
 *      `npm install`.
 *
 * Call `close()` at the end of a deployment to flush the tail of the buffer.
 */

type LogSource = "build" | "deploy" | "system" | "error";

interface BufferedLine {
  line: string;
  source: LogSource;
}

const FLUSH_EVERY_MS = 1_000;
const FLUSH_AT_LINES = 50;

export class DeploymentLogger {
  private buf: BufferedLine[] = [];
  private timer: NodeJS.Timeout | null = null;
  private channel: ReturnType<typeof wcSupabase.channel>;
  private subscribed = false;

  constructor(public readonly deploymentId: string) {
    this.channel = wcSupabase.channel(`deploy:${deploymentId}`, {
      config: { broadcast: { self: false, ack: false } },
    });
    void this.channel.subscribe((status) => {
      if (status === "SUBSCRIBED") this.subscribed = true;
    });
  }

  emit(line: string, source: LogSource = "build") {
    // Avoid blank lines — daemons spit them out around stage transitions
    if (!line) return;
    this.buf.push({ line, source });

    // Fire-and-forget broadcast so the UI sees lines in near-real-time
    if (this.subscribed) {
      void this.channel.send({
        type: "broadcast",
        event: "line",
        payload: { line, source, ts: Date.now() },
      });
    }

    if (this.buf.length >= FLUSH_AT_LINES) {
      void this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => void this.flush(), FLUSH_EVERY_MS);
    }
  }

  async flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.buf.length) return;
    const batch = this.buf.splice(0, this.buf.length).map((b) => ({
      deployment_id: this.deploymentId,
      line: b.line,
      source: b.source,
    }));
    const { error } = await wcSupabase.from("deployment_logs").insert(batch);
    if (error) log.warn("deployment_logs insert failed", { error: error.message });
  }

  async close() {
    await this.flush();
    await wcSupabase.removeChannel(this.channel);
  }
}
