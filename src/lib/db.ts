import { execSync } from "child_process";
import { homedir } from "os";
import { join } from "path";

const DB_PATH = join(homedir(), ".local", "share", "opencode", "opencode.db");

/**
 * Find session IDs currently open in OpenCode TUI instances
 * by parsing process arguments.
 */
export function getOpenSessionIds(): Set<string> {
  try {
    const output = execSync("ps aux", { encoding: "utf-8" });
    const ids = new Set<string>();
    for (const line of output.split("\n")) {
      if (!line.includes("opencode")) continue;
      // Match -s <id> or --session <id> or --session=<id>
      const match = line.match(/(?:-s|--session)[=\s]+(\S+)/);
      if (match) {
        ids.add(match[1]);
      }
    }
    return ids;
  } catch {
    return new Set();
  }
}

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
 * Search sessions by message content (text and tool inputs).
 * Slower than title search since it scans part.data JSON, but finds
 * conversations the title search misses.
 */
export function searchSessionsByContent(keyword: string, limit = 30): DbSession[] {
  const escaped = keyword.replace(/'/g, "''").toLowerCase();
  const output = query(
    `SELECT DISTINCT s.id, s.project_id, s.title, s.directory, s.time_created, s.time_updated FROM part p JOIN message m ON p.message_id = m.id JOIN session s ON m.session_id = s.id WHERE s.time_archived IS NULL AND (lower(json_extract(p.data, '$.text')) LIKE '%${escaped}%' OR lower(json_extract(p.data, '$.input')) LIKE '%${escaped}%') ORDER BY s.time_updated DESC LIMIT ${limit}`,
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
