import { execSync } from "child_process";
import { runAppleScript } from "@raycast/utils";

function escapeAppleScriptString(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Find the TTY of an opencode process running a specific session ID.
 */
function findTtyForSession(sessionId: string): string | null {
  try {
    const output = execSync("ps aux", { encoding: "utf-8" });
    for (const line of output.split("\n")) {
      if (!line.includes(sessionId)) continue;
      const parts = line.trim().split(/\s+/);
      const tty = parts[6]; // TTY column in ps aux
      if (tty && tty.startsWith("s")) {
        return `/dev/tty${tty}`;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Focus the iTerm tab whose session matches the given TTY.
 */
async function focusITermByTty(tty: string): Promise<boolean> {
  const escaped = escapeAppleScriptString(tty);
  const result = await runAppleScript(`
    tell application "iTerm"
      repeat with w in windows
        tell w
          repeat with t in tabs
            tell t
              repeat with s in sessions
                tell s
                  if tty is "${escaped}" then
                    select t
                    select
                    tell w to select
                    activate
                    return "found"
                  end if
                end tell
              end repeat
            end tell
          end repeat
        end tell
      end repeat
    end tell
    return "not_found"
  `);
  return result.trim() === "found";
}

async function openInITerm(directory: string, command: string): Promise<void> {
  const escapedDir = escapeAppleScriptString(directory);
  const escapedCmd = escapeAppleScriptString(command);

  await runAppleScript(`
    tell application "iTerm"
      activate
      tell current window
        create tab with default profile
        tell current session
          write text "cd \\"${escapedDir}\\" && ${escapedCmd}"
        end tell
      end tell
    end tell
  `);
}

export async function openOpenCode(directory: string): Promise<void> {
  return openInITerm(directory, "opencode");
}

/**
 * Resume a session. If already open in iTerm, focus that tab.
 * Otherwise open a new tab.
 */
export async function resumeSession(directory: string, sessionId: string, isOpen: boolean = false): Promise<void> {
  if (isOpen) {
    const tty = findTtyForSession(sessionId);
    if (tty) {
      const focused = await focusITermByTty(tty);
      if (focused) return;
    }
  }
  return openInITerm(directory, `opencode -s ${sessionId}`);
}
