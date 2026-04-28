import { createOpencodeClient, OpencodeClient } from "@opencode-ai/sdk/v2/client";
import { discoverServers, DiscoveredServer } from "./discovery";

export interface ConnectedServer {
  server: DiscoveredServer;
  client: OpencodeClient;
}

export async function getClients(): Promise<ConnectedServer[]> {
  const servers = await discoverServers();
  return servers.map((server) => ({
    server,
    client: createOpencodeClient({ baseUrl: server.baseUrl }),
  }));
}

export async function getFirstClient(): Promise<ConnectedServer | null> {
  const clients = await getClients();
  return clients.length > 0 ? clients[0] : null;
}
