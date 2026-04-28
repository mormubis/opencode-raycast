import { useCachedPromise } from "@raycast/utils";
import { Project, Session, SessionStatus, Todo } from "@opencode-ai/sdk/v2/client";
import { getClients } from "./clients";

export type { Project, Session, SessionStatus, Todo };

export type MessageWithParts = {
  info: {
    id: string;
    sessionID: string;
    role: "user" | "assistant";
    time: { created: number };
  };
  parts: Array<{
    id: string;
    type: string;
    text?: string;
  }>;
};

export function useProjects() {
  return useCachedPromise(async () => {
    const clients = await getClients();
    if (clients.length === 0) return [];

    const results = await Promise.allSettled(clients.map(({ client }) => client.project.list()));

    const projects: Project[] = [];
    for (const result of results) {
      if (result.status === "fulfilled" && result.value.data) {
        projects.push(...result.value.data);
      }
    }
    return projects;
  });
}

export function useSessions() {
  return useCachedPromise(async () => {
    const clients = await getClients();
    if (clients.length === 0) return [];

    const results = await Promise.allSettled(clients.map(({ client }) => client.session.list()));

    const seen = new Set<string>();
    const sessions: Session[] = [];

    for (const result of results) {
      if (result.status === "fulfilled" && result.value.data) {
        for (const session of result.value.data) {
          if (!seen.has(session.id)) {
            seen.add(session.id);
            sessions.push(session);
          }
        }
      }
    }

    return sessions.sort((a, b) => b.time.updated - a.time.updated);
  });
}

export function useSessionStatus() {
  return useCachedPromise(async () => {
    const clients = await getClients();
    if (clients.length === 0) return {} as Record<string, SessionStatus>;

    const results = await Promise.allSettled(clients.map(({ client }) => client.session.status()));

    const statusMap: Record<string, SessionStatus> = {};
    for (const result of results) {
      if (result.status === "fulfilled" && result.value.data) {
        Object.assign(statusMap, result.value.data);
      }
    }
    return statusMap;
  });
}

export function useSessionTodos(sessionId: string) {
  return useCachedPromise(
    async (id: string) => {
      const clients = await getClients();
      if (clients.length === 0) return [] as Todo[];

      const results = await Promise.allSettled(clients.map(({ client }) => client.session.todo({ sessionID: id })));

      for (const result of results) {
        if (result.status === "fulfilled" && result.value.data) {
          return result.value.data;
        }
      }
      return [] as Todo[];
    },
    [sessionId],
  );
}

export function useSessionMessages(sessionId: string) {
  return useCachedPromise(
    async (id: string) => {
      const clients = await getClients();
      if (clients.length === 0) return [] as MessageWithParts[];

      const results = await Promise.allSettled(
        clients.map(({ client }) => client.session.messages({ sessionID: id, limit: 10 })),
      );

      for (const result of results) {
        if (result.status === "fulfilled" && result.value.data) {
          return result.value.data as MessageWithParts[];
        }
      }
      return [] as MessageWithParts[];
    },
    [sessionId],
  );
}
