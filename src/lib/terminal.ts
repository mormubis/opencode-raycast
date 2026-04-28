import { execSync } from "child_process";
import { runAppleScript } from "@raycast/utils";

function esc(str: string): string {
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
      const tty = parts[6];
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
 * Focus the iTerm2 tab whose current session matches the given TTY.
 */
async function focusITermByTty(tty: string): Promise<boolean> {
  const result = await runAppleScript(`
    tell application "iTerm2"
      tell current window
        repeat with i from 1 to (count of tabs)
          tell tab i
            tell current session
              if tty is "${esc(tty)}" then
                select
                activate application "iTerm2"
                return "found"
              end if
            end tell
          end tell
        end repeat
      end tell
    end tell
    return "not_found"
  `);
  return result.trim() === "found";
}

async function openInITerm(directory: string, command: string): Promise<void> {
  await runAppleScript(`
    tell application "iTerm2"
      activate
      tell current window
        create tab with default profile
        tell current session
          write text "cd \\"${esc(directory)}\\" && ${esc(command)}"
        end tell
      end tell
    end tell
  `);
}

export async function openOpenCode(directory: string): Promise<void> {
  return openInITerm(directory, "opencode");
}

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
