import { Action, ActionPanel, Color, Icon, List } from "@raycast/api";
import { DbSession, Project, useAllSessions, useProjects, useSessionCounts } from "./lib/hooks";
import { openOpenCode, resumeSession } from "./lib/terminal";
import { formatTime } from "./search-sessions";

function projectName(project: Project): string {
  if (project.name) return project.name;
  const parts = project.worktree.replace(/\/$/, "").split("/");
  return parts[parts.length - 1] || project.worktree;
}

function ProjectSessions({ project }: { project: Project }) {
  const { data: allSessions = [] } = useAllSessions();
  const projectSessions = allSessions.filter((s) => s.projectId === project.id);

  return (
    <List navigationTitle={`Sessions — ${projectName(project)}`} searchBarPlaceholder="Search sessions...">
      {projectSessions.length === 0 ? (
        <List.EmptyView title="No Sessions" description="No sessions found for this project." icon={Icon.Message} />
      ) : (
        projectSessions.map((session) => <DbSessionListItem key={session.id} session={session} />)
      )}
    </List>
  );
}

function DbSessionListItem({ session }: { session: DbSession }) {
  return (
    <List.Item
      title={session.title}
      subtitle={session.directory}
      icon={Icon.Message}
      accessories={[{ text: formatTime(session.timeUpdated) }]}
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
                  <Action title="Open in iTerm" icon={Icon.Terminal} onAction={() => openOpenCode(project.worktree)} />
                  <Action.Push
                    title="View Sessions"
                    icon={Icon.Message}
                    target={<ProjectSessions project={project} />}
                  />
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
