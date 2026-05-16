import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { randomUUID } from "node:crypto";

const FILE_OP_REPLY_EVENTS = [
  "list-result", "read-result", "write-result", "mkdir-result", "delete-result",
  "rename-result", "import-result", "url-import-result", "export-result",
  "zip-result", "unzip-result",
];
const WORLD_OP_REPLY_EVENTS = [
  "list-result", "set-active-result", "delete-result", "rename-result",
  "import-result", "export-result",
];

/**
 * Generic dispatch: sends a `{event}` payload on `node:{nodeId}` and waits
 * for a matching opId reply on `{replyPrefix}:{serverId}`.
 */
async function dispatch(
  nodeId: string,
  serverId: string,
  event: string,
  replyPrefix: string,
  replyEvents: string[],
  args: Record<string, unknown>,
  timeoutMs: number
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  const opId = randomUUID();
  const admin = createAdminSupabaseClient();
  const replyChannel = admin.channel(`${replyPrefix}:${serverId}`, {
    config: { broadcast: { self: false, ack: false } },
  });

  const resultPromise = new Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }>(
    (resolve) => {
      for (const ev of [...replyEvents, "error"]) {
        replyChannel.on("broadcast", { event: ev }, (msg) => {
          const p = msg.payload as { opId?: string; error?: string };
          if (p?.opId !== opId) return;
          if (ev === "error") resolve({ ok: false, error: p.error ?? "unknown" });
          else resolve({ ok: true, data: p as Record<string, unknown> });
        });
      }
    }
  );

  await new Promise<void>((resolve) => {
    replyChannel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        const cmdChannel = admin.channel(`node:${nodeId}`);
        await new Promise<void>((cmdResolve) => {
          cmdChannel.subscribe(async (s) => {
            if (s === "SUBSCRIBED") {
              await cmdChannel.send({
                type: "broadcast",
                event,
                payload: { op: args.op, opId, serverId, ...args },
              });
              cmdResolve();
            }
          });
          setTimeout(cmdResolve, 2000);
        });
        void admin.removeChannel(cmdChannel);
        resolve();
      }
    });
  });

  const timeoutPromise = new Promise<{ ok: false; error: string }>((resolve) =>
    setTimeout(() => resolve({ ok: false, error: "timeout — is the daemon running?" }), timeoutMs)
  );

  const result = await Promise.race([resultPromise, timeoutPromise]);
  void admin.removeChannel(replyChannel);
  return result;
}

export function dispatchFileOp(
  nodeId: string, serverId: string, op: string,
  args: Record<string, unknown>, timeoutMs = 30_000
) {
  return dispatch(nodeId, serverId, "file-op", "fileops", FILE_OP_REPLY_EVENTS, { op, ...args }, timeoutMs);
}

export function dispatchWorldOp(
  nodeId: string, serverId: string, op: string,
  args: Record<string, unknown>, timeoutMs = 60_000
) {
  return dispatch(nodeId, serverId, "world-op", "world", WORLD_OP_REPLY_EVENTS, { op, ...args }, timeoutMs);
}
