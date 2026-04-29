# OpenCode

Manage [OpenCode](https://opencode.ai) projects and sessions from Raycast.

## Features

- **Search Projects** — browse all your OpenCode projects with session counts, open them in iTerm2, or drill into their sessions grouped by folder
- **Search Sessions** — find conversations by title or message content using a multi-word scored search, see which sessions are active or open in a terminal
- **Focus running sessions** — if a session is already open in iTerm2, selecting it brings that tab to the front instead of opening a new one

## Requirements

- [OpenCode](https://opencode.ai) installed (`brew install anomalyco/tap/opencode`)
- [iTerm2](https://iterm2.com) as your terminal
- At least one OpenCode session in the database (run `opencode` once in any project)

## How it works

The extension reads from OpenCode's shared SQLite database to list projects and sessions across all your workspaces. It starts a lightweight OpenCode server via the SDK for API access (todos, messages, status). Session liveness is detected by scanning running processes and checking recent database activity.
