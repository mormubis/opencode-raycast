import { createOpencode, OpencodeClient } from "@opencode-ai/sdk/v2";

let instance: { client: OpencodeClient; server: { url: string; close(): void } } | null = null;
let initializing: Promise<OpencodeClient> | null = null;

/**
 * Get an SDK client backed by a managed OpenCode server.
 * Starts the server once and reuses it across all hook calls.
 */
export async function getClient(): Promise<OpencodeClient> {
  if (instance) return instance.client;

  // Prevent multiple concurrent server startups
  if (!initializing) {
    initializing = (async () => {
      instance = await createOpencode();
      return instance.client;
    })();
  }

  const client = await initializing;
  return client;
}
