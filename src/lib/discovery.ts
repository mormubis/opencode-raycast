import { execSync } from "child_process";
import { createOpencodeClient } from "@opencode-ai/sdk/v2/client";

export interface DiscoveredServer {
  baseUrl: string;
  version: string;
  pid: number;
}

interface CacheEntry {
  servers: DiscoveredServer[];
  timestamp: number;
}

const CACHE_TTL_MS = 5000;
let cache: CacheEntry | null = null;

function getOpenCodePids(): Array<{ pid: number; args: string }> {
  try {
    const output = execSync("ps aux", { encoding: "utf-8" });
    const results: Array<{ pid: number; args: string }> = [];
    for (const line of output.split("\n")) {
      if (!line.includes("opencode") || line.includes("grep")) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parseInt(parts[1], 10);
      if (isNaN(pid)) continue;
      const args = parts.slice(10).join(" ");
      results.push({ pid, args });
    }
    return results;
  } catch {
    return [];
  }
}

function extractPortFromArgs(args: string): number | null {
  const match = args.match(/--port[=\s]+(\d+)/);
  if (match) return parseInt(match[1], 10);
  return null;
}

function getListeningPortFromLsof(pid: number): number | null {
  try {
    const output = execSync(`lsof -p ${pid} -iTCP -sTCP:LISTEN`, { encoding: "utf-8" });
    for (const line of output.split("\n")) {
      const match = line.match(/:(\d+)\s*\(LISTEN\)/);
      if (match) return parseInt(match[1], 10);
    }
    return null;
  } catch {
    return null;
  }
}

async function verifyServer(baseUrl: string): Promise<string | null> {
  try {
    const client = createOpencodeClient({ baseUrl });
    const result = await client.global.health();
    const data = result.data as { healthy: true; version: string } | undefined;
    if (data?.healthy) {
      return data.version;
    }
    return null;
  } catch {
    return null;
  }
}

export async function discoverServers(): Promise<DiscoveredServer[]> {
  const now = Date.now();
  if (cache && now - cache.timestamp < CACHE_TTL_MS) {
    return cache.servers;
  }

  const processes = getOpenCodePids();
  const seenPorts = new Set<number>();
  const servers: DiscoveredServer[] = [];

  for (const { pid, args } of processes) {
    let port = extractPortFromArgs(args);
    if (!port) {
      port = getListeningPortFromLsof(pid);
    }
    if (!port || seenPorts.has(port)) continue;
    seenPorts.add(port);

    const baseUrl = `http://localhost:${port}`;
    const version = await verifyServer(baseUrl);
    if (version !== null) {
      servers.push({ baseUrl, version, pid });
    }
  }

  cache = { servers, timestamp: now };
  return servers;
}

export function clearDiscoveryCache(): void {
  cache = null;
}
