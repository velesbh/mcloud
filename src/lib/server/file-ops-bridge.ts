import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { randomUUID } from "node:crypto";

/**
 * Send a file-op request to the daemon for `nodeId` and wait for the
 * matching `opId` reply on `fileops:{serverId}` channel.
 *
 * Returns the result payload on success, or `{ error }` on timeout / failure.
 */
export async function dispatchFileOp(
  nodeId: string,
  serverId: string,
  op: string,
  args: Record<string, unknown>,
  timeoutMs = 30_000
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  const opId = randomUUID();
  const admin = createAdminSupabaseClient();

  // Subscribe to the reply channel first
  const replyChannel = admin.channel(`fileops:${serverId}`, {
    config: { broadcast: { self: false, ack: false } },
  });

  const resultPromise = new Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }>(
    (resolve) => {
      const matchers = ["list-result", "read-result", "write-result", "mkdir-result", "delete-result", "rename-result", "import-result", "url-import-result", "export-result", "zip-result", "unzip-result", "error"];
      for (const event of matchers) {
        replyChannel.on("broadcast", { event }, (msg) => {
          const p = msg.payload as { opId?: string; error?: string };
          if (p?.opId !== opId) return;
          if (event === "error") {
            resolve({ ok: false, error: p.error ?? "unknown" });
          } else {
            resolve({ ok: true, data: p as Record<string, unknown> });
          }
        });
      }
    }
  );

  // Open subscription then send the request
  await new Promise<void>((resolve) => {
    replyChannel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        const cmdChannel = admin.channel(`node:${nodeId}`);
        await new Promise<void>((cmdResolve) => {
          cmdChannel.subscribe(async (s) => {
            if (s === "SUBSCRIBED") {
              await cmdChannel.send({
                type: "broadcast",
                event: "file-op",
                payload: { op, opId, serverId, ...args },
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

  // Wait for the daemon's reply (or timeout)
  const timeoutPromise = new Promise<{ ok: false; error: string }>((resolve) =>
    setTimeout(() => resolve({ ok: false, error: "timeout — is the daemon running?" }), timeoutMs)
  );

  const result = await Promise.race([resultPromise, timeoutPromise]);
  void admin.removeChannel(replyChannel);
  return result;
}
