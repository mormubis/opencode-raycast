import { useCachedPromise } from "@raycast/utils";
import { Project, Session, SessionStatus, Todo } from "@opencode-ai/sdk/v2/client";
import { getClient } from "./clients";

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
    const client = await getClient();
    const result = await client.project.list();
    return result.data ?? [];
  });
}

export function useSessions() {
  return useCachedPromise(async () => {
    const client = await getClient();
    const result = await client.session.list();
    const sessions = result.data ?? [];
    return sessions.sort((a: Session, b: Session) => b.time.updated - a.time.updated);
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
