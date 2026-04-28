import { execSync } from "child_process";
import { homedir } from "os";
import { join } from "path";

const DB_PATH = join(homedir(), ".local", "share", "opencode", "opencode.db");

function query(sql: string): string {
  try {
    return execSync(`sqlite3 "${DB_PATH}" "${sql}"`, { encoding: "utf-8" });
  } catch {
    return "";
  }
}

/**
 * Count sessions per project directly from the shared SQLite database.
 * The API scopes sessions to the current project, but the DB has all of them.
 */
export function getSessionCountsByProject(): Record<string, number> {
  const output = query("SELECT project_id, COUNT(*) FROM session WHERE time_archived IS NULL GROUP BY project_id");
  const counts: Record<string, number> = {};
  for (const line of output.trim().split("\n")) {
    if (!line) continue;
    const [projectId, count] = line.split("|");
    counts[projectId] = parseInt(count, 10);
  }
  return counts;
}

export interface DbSession {
  id: string;
  projectId: string;
  title: string;
  directory: string;
  timeCreated: number;
  timeUpdated: number;
}

/**
 * List recent sessions across ALL projects from the SQLite database.
 */
export function getRecentSessions(limit = 50): DbSession[] {
  const output = query(
    `SELECT id, project_id, title, directory, time_created, time_updated FROM session WHERE time_archived IS NULL ORDER BY time_updated DESC LIMIT ${limit}`,
  );
  const sessions: DbSession[] = [];
  for (const line of output.trim().split("\n")) {
    if (!line) continue;
    const [id, projectId, title, directory, timeCreated, timeUpdated] = line.split("|");
    sessions.push({
      id,
      projectId,
      title: title || "Untitled",
      directory,
      timeCreated: parseInt(timeCreated, 10),
      timeUpdated: parseInt(timeUpdated, 10),
    });
  }
  return sessions;
}

/**
 * Get the project worktree path for a project ID.
 */
export function getProjectWorktree(projectId: string): string | null {
  const output = query(`SELECT worktree FROM project WHERE id = '${projectId}'`);
  return output.trim() || null;
}
