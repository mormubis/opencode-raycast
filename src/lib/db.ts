import { execSync } from "child_process";
import { homedir } from "os";
import { join } from "path";

const DB_PATH = join(homedir(), ".local", "share", "opencode", "opencode.db");

/**
 * Find session IDs currently open in OpenCode TUI instances
 * by parsing process arguments.
 */
export type SessionLiveness = "active" | "open" | "closed";

export interface OpenSession {
  id: string;
  liveness: SessionLiveness;
}

/**
 * Detect which sessions are open in a terminal and whether they're actively working.
 * - "active": open in terminal AND (updated in last 60s OR has in_progress todos)
 * - "open": open in terminal but idle
 * - Sessions not in the result are closed.
 */
export function getOpenSessions(): OpenSession[] {
  // 1. Find session IDs from process list
  const processIds: string[] = [];
  try {
    const output = execSync("ps aux", { encoding: "utf-8" });
    for (const line of output.split("\n")) {
      if (!line.includes("opencode")) continue;
      const match = line.match(/(?:-s|--session)[=\s]+(\S+)/);
      if (match && !processIds.includes(match[1])) {
        processIds.push(match[1]);
      }
    }
  } catch {
    return [];
  }

  if (processIds.length === 0) return [];

  // 2. Check which are recently active (updated in last 60s) or have in_progress todos
  const cutoff = Date.now() - 60_000;
  const quoted = processIds.map((id) => `'${id}'`).join(",");

  const recentlyUpdated = new Set<string>();
  try {
    const output = execSync(
      `sqlite3 "${DB_PATH}" "SELECT id FROM session WHERE id IN (${quoted}) AND time_updated > ${cutoff}"`,
      { encoding: "utf-8" },
    );
    for (const line of output.trim().split("\n")) {
      if (line) recentlyUpdated.add(line);
    }
  } catch {
    // ignore
  }

  const hasTodos = new Set<string>();
  try {
    const output = execSync(
      `sqlite3 "${DB_PATH}" "SELECT DISTINCT session_id FROM todo WHERE session_id IN (${quoted}) AND status = 'in_progress'"`,
      { encoding: "utf-8" },
    );
    for (const line of output.trim().split("\n")) {
      if (line) hasTodos.add(line);
    }
  } catch {
    // ignore
  }

  return processIds.map((id) => ({
    id,
    liveness: recentlyUpdated.has(id) || hasTodos.has(id) ? "active" : "open",
  }));
}

function query(sql: string): string {
  try {
    return execSync(`sqlite3 "${DB_PATH}"`, {
      encoding: "utf-8",
      input: sql,
      timeout: 10_000,
    });
  } catch {
    return "";
  }
}

/**
 * Count sessions per project directly from the shared SQLite database.
 * The API scopes sessions to the current project, but the DB has all of them.
 */
export function getSessionCountsByProject(): Record<string, number> {
  const output = query(
    "SELECT project_id, COUNT(*) FROM session WHERE time_archived IS NULL AND parent_id IS NULL GROUP BY project_id",
  );
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
    `SELECT id, project_id, title, directory, time_created, time_updated FROM session WHERE time_archived IS NULL AND parent_id IS NULL ORDER BY time_updated DESC LIMIT ${limit}`,
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
 * List sessions for a specific project.
 */
export function getProjectSessions(projectId: string, limit = 200): DbSession[] {
  const escaped = projectId.replace(/'/g, "''");
  const output = query(
    `SELECT id, project_id, title, directory, time_created, time_updated FROM session WHERE time_archived IS NULL AND parent_id IS NULL AND project_id = '${escaped}' ORDER BY time_updated DESC LIMIT ${limit}`,
  );
  const sessions: DbSession[] = [];
  for (const line of output.trim().split("\n")) {
    if (!line) continue;
    const [id, pid, title, directory, timeCreated, timeUpdated] = line.split("|");
    sessions.push({
      id,
      projectId: pid,
      title: title || "Untitled",
      directory,
      timeCreated: parseInt(timeCreated, 10),
      timeUpdated: parseInt(timeUpdated, 10),
    });
  }
  return sessions;
}

function parseSessionRows(output: string): DbSession[] {
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
 * Search sessions using the same strategy as the recover-opencode-conversation skill:
 * 1. Title search (fast, matches session names)
 * 2. Content search (slower, scans message text and tool inputs)
 * Results are merged and deduplicated, title matches first.
 */
export function searchSessions(keyword: string, limit = 30): DbSession[] {
  const escaped = keyword.replace(/'/g, "''").toLowerCase();
  const base =
    "SELECT id, project_id, title, directory, time_created, time_updated FROM session WHERE time_archived IS NULL AND parent_id IS NULL";

  // 1. Title search (fast)
  const titleResults = parseSessionRows(
    query(`${base} AND lower(title) LIKE '%${escaped}%' ORDER BY time_updated DESC LIMIT ${limit}`),
  );

  // 2. Content search — text and tool inputs (slower, deeper)
  const contentResults = parseSessionRows(
    query(
      `SELECT DISTINCT s.id, s.project_id, s.title, s.directory, s.time_created, s.time_updated FROM part p JOIN message m ON p.message_id = m.id JOIN session s ON m.session_id = s.id WHERE s.time_archived IS NULL AND s.parent_id IS NULL AND (lower(json_extract(p.data, '$.text')) LIKE '%${escaped}%' OR lower(json_extract(p.data, '$.input')) LIKE '%${escaped}%') ORDER BY s.time_updated DESC LIMIT ${limit}`,
    ),
  );

  // Merge: title matches first, then content matches (deduplicated)
  const seen = new Set<string>();
  const merged: DbSession[] = [];
  for (const s of [...titleResults, ...contentResults]) {
    if (!seen.has(s.id)) {
      seen.add(s.id);
      merged.push(s);
    }
  }
  return merged.slice(0, limit);
}
