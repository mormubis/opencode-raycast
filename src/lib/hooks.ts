import { useCachedPromise } from "@raycast/utils";
import { Project, Session, SessionStatus, Todo } from "@opencode-ai/sdk/v2/client";
import { getClient } from "./clients";
import { getSessionCountsByProject, getRecentSessions, DbSession } from "./db";

export type { Project, Session, SessionStatus, Todo, DbSession };

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
    const client = await getClient();
    const result = await client.project.list();
    return result.data ?? [];
  });
}

/**
 * Session counts per project from SQLite (cross-project, not scoped).
 */
export function useSessionCounts() {
  return useCachedPromise(async () => {
    return getSessionCountsByProject();
  });
}

/**
 * Recent sessions across ALL projects from SQLite.
 */
export function useAllSessions() {
  return useCachedPromise(async () => {
    return getRecentSessions(100);
  });
}

export function useSessionStatus() {
  return useCachedPromise(async () => {
    const client = await getClient();
    const result = await client.session.status();
    return (result.data ?? {}) as Record<string, SessionStatus>;
  });
}

export function useSessionTodos(sessionId: string) {
  return useCachedPromise(
    async (id: string) => {
      const client = await getClient();
      const result = await client.session.todo({ sessionID: id });
      return result.data ?? ([] as Todo[]);
    },
    [sessionId],
  );
}

export function useSessionMessages(sessionId: string) {
  return useCachedPromise(
    async (id: string) => {
      const client = await getClient();
      const result = await client.session.messages({ sessionID: id, limit: 10 });
      return (result.data ?? []) as MessageWithParts[];
    },
    [sessionId],
  );
}
