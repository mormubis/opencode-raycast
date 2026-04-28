import { execSync } from "child_process";
import { createOpencode, OpencodeClient } from "@opencode-ai/sdk/v2";

let instance: { client: OpencodeClient; server: { url: string; close(): void } } | null = null;
let initializing: Promise<OpencodeClient> | null = null;

/**
 * Ensure Homebrew paths are in PATH so `opencode` binary is found.
 * Raycast's Node.js environment has a minimal PATH.
 */
function ensurePath(): void {
  const current = process.env.PATH ?? "";
  const extraPaths = ["/opt/homebrew/bin", "/usr/local/bin"];

  // Also try to get the user's shell PATH
  try {
    const shellPath = execSync("zsh -ilc 'echo $PATH'", { encoding: "utf-8" }).trim();
    if (shellPath) {
      process.env.PATH = `${shellPath}:${current}`;
      return;
    }
  } catch {
    // Fallback to known paths
  }

  for (const p of extraPaths) {
    if (!current.includes(p)) {
      process.env.PATH = `${p}:${current}`;
    }
  }
}

/**
 * Get an SDK client backed by a managed OpenCode server.
 * Starts the server once and reuses it across all hook calls.
 */
export async function getClient(): Promise<OpencodeClient> {
  if (instance) return instance.client;

  // Prevent multiple concurrent server startups
  if (!initializing) {
    initializing = (async () => {
      ensurePath();
      instance = await createOpencode();
      return instance.client;
    })();
  }

  const client = await initializing;
  return client;
}
