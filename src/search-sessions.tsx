import { useState } from "react";
import { Action, ActionPanel, Color, Detail, Icon, List } from "@raycast/api";
import {
  DbSession,
  SessionStatus,
  useAllSessions,
  useContentSearch,
  useSessionMessages,
  useSessionStatus,
  useSessionTodos,
} from "./lib/hooks";
import { resumeSession } from "./lib/terminal";

export function formatTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function statusColor(status: SessionStatus | undefined): Color {
  if (!status) return Color.SecondaryText;
  if (status.type === "busy") return Color.Green;
  if (status.type === "retry") return Color.Yellow;
  return Color.SecondaryText;
}

export function statusLabel(status: SessionStatus | undefined): string {
  if (!status) return "Idle";
  if (status.type === "busy") return "Running";
  if (status.type === "retry") return "Waiting";
  return "Idle";
}

function SessionActivity({ session }: { session: DbSession }) {
  const { data: todos = [] } = useSessionTodos(session.id);
  const { data: messages = [] } = useSessionMessages(session.id);

  const todoSection =
    todos.length > 0
      ? `## Tasks\n\n${todos
          .map((t) => {
            const icon =
              t.status === "completed"
                ? "✅"
                : t.status === "in_progress"
                  ? "🔄"
                  : t.status === "cancelled"
                    ? "❌"
                    : "⬜";
            return `${icon} ${t.content}`;
          })
          .join("\n")}`
      : "";

  const activitySection =
    messages.length > 0
      ? `## Recent Activity\n\n${messages
          .map((m) => {
            const roleIcon = m.info.role === "user" ? "👤" : "🤖";
            const textPart = m.parts.find((p) => p.type === "text");
            const text = textPart?.text ?? "";
            const truncated = text.length > 120 ? text.slice(0, 117) + "..." : text;
            return `${roleIcon} ${truncated}`;
          })
          .join("\n\n")}`
      : "";

  const markdown = [`# ${session.title}`, todoSection, activitySection].filter(Boolean).join("\n\n");

  return (
    <Detail
      markdown={markdown}
      navigationTitle={session.title}
      actions={
        <ActionPanel>
          <Action
            title="Resume in iTerm"
            icon={Icon.Terminal}
            onAction={() => resumeSession(session.directory, session.id)}
          />
          <Action.CopyToClipboard
            title="Copy Session ID"
            content={session.id}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
          />
        </ActionPanel>
      }
    />
  );
}

function SessionListItem({ session, statusMap }: { session: DbSession; statusMap: Record<string, SessionStatus> }) {
  const status = statusMap[session.id];
  return (
    <List.Item
      key={session.id}
      title={session.title}
      subtitle={session.directory}
      icon={Icon.Message}
      accessories={[
        { tag: { value: statusLabel(status), color: statusColor(status) } },
        { text: formatTime(session.timeUpdated) },
      ]}
      actions={
        <ActionPanel>
          <Action
            title="Resume in iTerm"
            icon={Icon.Terminal}
            onAction={() => resumeSession(session.directory, session.id)}
          />
          <Action.Push title="View Activity" icon={Icon.Eye} target={<SessionActivity session={session} />} />
          <Action.CopyToClipboard
            title="Copy Session ID"
            content={session.id}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
          />
        </ActionPanel>
      }
    />
  );
}

export default function SearchSessions() {
  const [mode, setMode] = useState<string>("recent");
  const [searchText, setSearchText] = useState("");

  const { data: recentSessions = [], isLoading: recentLoading } = useAllSessions();
  const { data: contentResults = [], isLoading: contentLoading } = useContentSearch(
    mode === "content" ? searchText : "",
  );
  const { data: statusMap = {} } = useSessionStatus();

  const isContent = mode === "content";
  const sessions = isContent ? contentResults : recentSessions;
  const isLoading = isContent ? contentLoading : recentLoading;
  const placeholder = isContent ? "Search conversation content (min 3 chars)..." : "Filter sessions by title...";

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder={placeholder}
      onSearchTextChange={isContent ? setSearchText : undefined}
      throttle={isContent}
      searchBarAccessory={
        <List.Dropdown tooltip="Search Mode" onChange={setMode} value={mode}>
          <List.Dropdown.Item title="Recent" value="recent" icon={Icon.Clock} />
          <List.Dropdown.Item title="Search Content" value="content" icon={Icon.MagnifyingGlass} />
        </List.Dropdown>
      }
    >
      {sessions.length === 0 && !isLoading ? (
        <List.EmptyView
          title={isContent ? "No Matches" : "No Sessions Found"}
          description={
            isContent
              ? "Try a different search term (min 3 characters)."
              : "Start OpenCode in a terminal to see sessions here."
          }
          icon={isContent ? Icon.MagnifyingGlass : Icon.Message}
        />
      ) : (
        sessions.map((session) => <SessionListItem key={session.id} session={session} statusMap={statusMap} />)
      )}
    </List>
  );
}
