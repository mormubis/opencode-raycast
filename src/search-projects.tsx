import { Action, ActionPanel, Color, Icon, List } from "@raycast/api";
import { OpenSession, Project, useAllSessions, useOpenSessions, useProjects, useSessionCounts } from "./lib/hooks";
import { openOpenCode, resumeSession } from "./lib/terminal";
import { formatTime, livenessTag } from "./search-sessions";

function projectName(project: Project): string {
  if (project.name) return project.name;
  const parts = project.worktree.replace(/\/$/, "").split("/");
  return parts[parts.length - 1] || project.worktree;
}

function getLiveness(openSessions: OpenSession[], sessionId: string): OpenSession["liveness"] | undefined {
  const found = openSessions.find((o) => o.id === sessionId);
  return found?.liveness;
}

function ProjectSessions({ project }: { project: Project }) {
  const { data: allSessions = [] } = useAllSessions();
  const { data: rawOpen } = useOpenSessions();
  const openSessions: OpenSession[] = Array.isArray(rawOpen) ? rawOpen : [];

  const projectSessions = allSessions.filter((s) => s.projectId === project.id);

  return (
    <List navigationTitle={`Sessions — ${projectName(project)}`} searchBarPlaceholder="Search sessions...">
      {projectSessions.length === 0 ? (
        <List.EmptyView title="No Sessions" description="No sessions found for this project." icon={Icon.Message} />
      ) : (
        projectSessions.map((session) => {
          const liveness = getLiveness(openSessions, session.id);
          const accessories: List.Item.Accessory[] = [];
          const tag = livenessTag(liveness);
          if (tag) accessories.push(tag);
          accessories.push({ text: formatTime(session.timeUpdated) });

          return (
            <List.Item
              key={session.id}
              title={session.title}
              subtitle={session.directory}
              icon={Icon.Message}
              accessories={accessories}
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
        })
      )}
    </List>
  );
}

export default function SearchProjects() {
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { data: sessionCounts = {} } = useSessionCounts();

  return (
    <List isLoading={projectsLoading} searchBarPlaceholder="Search projects...">
      {projects.length === 0 && !projectsLoading ? (
        <List.EmptyView
          title="No OpenCode Servers Found"
          description="Start OpenCode in a terminal to see projects here."
          icon={Icon.Folder}
        />
      ) : (
        projects.map((project) => {
          const count = sessionCounts[project.id] ?? 0;
          const accessories: List.Item.Accessory[] = [];
          if (count > 0) {
            accessories.push({
              tag: { value: `${count} sessions`, color: Color.SecondaryText },
            });
          }

          return (
            <List.Item
              key={project.id}
              title={projectName(project)}
              subtitle={project.worktree}
              icon={Icon.Folder}
              accessories={accessories}
              actions={
                <ActionPanel>
                  <Action.Push
                    title="View Sessions"
                    icon={Icon.Message}
                    target={<ProjectSessions project={project} />}
                  />
                  <Action title="Open in iTerm" icon={Icon.Terminal} onAction={() => openOpenCode(project.worktree)} />
                  <Action.CopyToClipboard
                    title="Copy Path"
                    content={project.worktree}
                    shortcut={{ modifiers: ["cmd"], key: "." }}
                  />
                </ActionPanel>
              }
            />
          );
        })
      )}
    </List>
  );
}
