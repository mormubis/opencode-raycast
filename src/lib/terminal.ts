import { runAppleScript } from "@raycast/utils";

function escapeAppleScriptString(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Try to find and focus an iTerm tab whose session is running a process
 * matching the given search string (e.g. a session ID).
 * Returns true if found and focused, false otherwise.
 */
async function focusITermTab(search: string): Promise<boolean> {
  const escaped = escapeAppleScriptString(search);
  const result = await runAppleScript(`
    tell application "iTerm"
      repeat with w in windows
        tell w
          repeat with t in tabs
            tell t
              repeat with s in sessions
                tell s
                  if tty contains "${escaped}" or name contains "${escaped}" then
                    select t
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
    const focused = await focusITermTab(sessionId);
    if (focused) return;
  }
  return openInITerm(directory, `opencode -s ${sessionId}`);
}
