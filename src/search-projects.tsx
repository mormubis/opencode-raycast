import { Action, ActionPanel, Color, Icon, List } from "@raycast/api";
import { Project, Session, SessionStatus, useProjects, useSessions, useSessionStatus } from "./lib/hooks";
import { openOpenCode } from "./lib/terminal";
import { SessionListItem } from "./search-sessions";

function projectName(project: Project): string {
  if (project.name) return project.name;
  const parts = project.worktree.replace(/\/$/, "").split("/");
  return parts[parts.length - 1] || project.worktree;
}

function ProjectSessions({
  project,
  sessions,
  statusMap,
}: {
  project: Project;
  sessions: Session[];
  statusMap: Record<string, SessionStatus>;
}) {
  const projectSessions = sessions.filter((s) => s.projectID === project.id);

  return (
    <List navigationTitle={`Sessions — ${projectName(project)}`} searchBarPlaceholder="Search sessions...">
      {projectSessions.length === 0 ? (
        <List.EmptyView title="No Sessions" description="No sessions found for this project." icon={Icon.Message} />
      ) : (
        projectSessions.map((session) => <SessionListItem key={session.id} session={session} statusMap={statusMap} />)
      )}
    </List>
  );
}

export default function SearchProjects() {
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { data: sessions = [] } = useSessions();
  const { data: statusMap = {} } = useSessionStatus();

  const sessionsByProject = sessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.projectID] = (acc[s.projectID] ?? 0) + 1;
    return acc;
  }, {});

  const activeByProject = sessions.reduce<Record<string, number>>((acc, s) => {
    const status = statusMap[s.id];
    if (status?.type === "busy") {
      acc[s.projectID] = (acc[s.projectID] ?? 0) + 1;
    }
    return acc;
  }, {});

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
          const activeCount = activeByProject[project.id] ?? 0;
          const totalCount = sessionsByProject[project.id] ?? 0;

          const accessories: List.Item.Accessory[] = [];
          if (activeCount > 0) {
            accessories.push({
              tag: { value: `${activeCount} active`, color: Color.Green },
            });
          } else if (totalCount > 0) {
            accessories.push({
              tag: { value: `${totalCount} sessions`, color: Color.SecondaryText },
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
                    target={<ProjectSessions project={project} sessions={sessions} statusMap={statusMap} />}
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
