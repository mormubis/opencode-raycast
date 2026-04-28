import { runAppleScript } from "@raycast/utils";

function escapeAppleScriptString(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export async function openInITerm(directory: string, command: string): Promise<void> {
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

export async function resumeSession(directory: string, sessionId: string): Promise<void> {
  return openInITerm(directory, `opencode -s ${sessionId}`);
}
