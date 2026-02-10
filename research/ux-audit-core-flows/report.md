# OpenWork UI/UX Core-Flow Audit (Docker + Chrome MCP)

Date: 2026-02-09

This is a hands-on UI/UX pass over OpenWork's web UI using the Docker dev stack and Chrome MCP.

## Environment

- Repo (openwork-enterprise) SHA: `31c62f99dae63abbf114c311e857c7574966b2d1`
- Submodule (`_repos/openwork`) SHA: `8f65b6a7e08f3eae4e1433bdc5a4dcb5436e8de3` (`openwrk-v0.11.44`)
- Docker context: `colima` (server `28.4.0`)
- Dev stack:
  - Web UI: `http://localhost:56626`
  - OpenWork server: `http://localhost:56625`
  - Compose project: `openwork-dev-9e408af9`

## Core Flows Tried

- Start a Docker dev stack (`packaging/docker/dev-up.sh`) and open `/session`
- Create sessions ("New task") and send messages
- Open model picker and change model
- Navigate: Automations / Skills / Plugins / Apps / Settings
- Add a suggested plugin (opencode-scheduler) and reload engine
- Trigger the "Automate your browser" quickstart

## Setup Quirks (Non-UI, but blocks the UX audit)

1) `packaging/docker/dev-up.sh` requires Docker Compose v2 (`docker compose`).

- Symptom: `unknown shorthand flag: 'p' in -p` and/or `docker: unknown command: docker compose`
- Fix (Homebrew install + Docker CLI plugin discovery):
  - `brew install docker-compose`
  - Add to `~/.docker/config.json`:
    - `"cliPluginsExtraDirs": ["/opt/homebrew/lib/docker/cli-plugins"]`

2) Nested submodule pin in `_repos/openwork` breaks recursive submodule update.

- Symptom: `git submodule update --init --recursive` fails with `No url found for submodule path '_repos/openwork/opencode' in .gitmodules`
- Fix direction: either remove the nested gitlink from `_repos/openwork` or add a top-level `.gitmodules` entry for `_repos/openwork/opencode` (with URL) so recursive update can work.

## Findings (UI/UX)

The items below are intentionally written as "issue tickets": repro + impact + fix direction + evidence.

### 1) Runs get stuck in "Responding" / "Thinking" with no clear error or escape hatch

- Repro:
  - Open `/session` and send a message.
  - Observe the run status stays at "Responding" / "Thinking".
- Impact:
  - From the user's POV this looks like the app is frozen.
  - No visible timeout, no surfaced error, no "Cancel run" CTA.
- Fix direction:
  - Add a "Cancel" action for in-flight runs.
  - Add a timeout UX (e.g., "Still working..." then "Something went wrong" with retry).
  - Surface provider/tool errors inline (and/or link to logs in developer mode).
- Evidence:
  - `research/ux-audit-core-flows/media/01-session-responding-stuck.png`
  - `research/ux-audit-core-flows/media/03-task-list-notification-mixed-with-session.png`

### 2) Notifications appear as sessions/tasks in the left rail (mixed information architecture)

- Repro:
  - After interacting via Chrome MCP, the left rail showed an item labeled "Chrome MCP greeting notification" alongside normal sessions.
- Impact:
  - The core mental model is "tasks/sessions"; notifications mixed into the same list feels noisy and confusing.
  - It is unclear whether clicking it opens a task, a log, or a system notice.
- Fix direction:
  - Separate notifications into their own surface (bell icon / inbox / toast history).
  - If they must appear in the rail, visually distinguish with an icon + section header (and never masquerade as a session).
- Evidence:
  - `research/ux-audit-core-flows/media/03-task-list-notification-mixed-with-session.png`

### 3) Web UI repeatedly calls `http://127.0.0.1:4096/*` and spams ERR_CONNECTION_REFUSED

- Repro:
  - Open the app in the browser while connected to the Docker "remote" server.
  - Console/network shows repeated requests to `127.0.0.1:4096` failing.
- Impact:
  - Noisy console, harder debugging.
  - Likely breaks features that are accidentally wired to a local OpenCode endpoint in "remote" mode.
- Fix direction:
  - Ensure remote mode never targets `127.0.0.1` for OpenCode APIs; route everything through OpenWork server.
  - Add a single visible status indicator when a dependency is unavailable (instead of silent retry loops).
- Evidence:
  - Observed via Chrome DevTools network/console (reqs to `127.0.0.1:4096/global/health` and `/event`).

### 4) Skills page: "Install skill creator" CTA does nothing and provides no feedback

- Repro:
  - Go to `Skills`.
  - Click "Install skill creator".
  - Nothing changes (no toast, no install progress, no error).
- Impact:
  - High confusion: this is the recommended next step on an empty skills state.
- Fix direction:
  - If remote workspaces cannot install skills, disable the button and explain why + how to enable.
  - If it should work remotely, implement a server-side install endpoint and show progress + success toast.
- Evidence:
  - `research/ux-audit-core-flows/media/02-skills-empty-recommended.png`

### 5) Send button enabled with empty input (allows sending a blank message)

- Repro:
  - Create a new session via an entry point (e.g., clicking an Automation template).
  - Observe "Send" appears enabled even when the input is empty.
  - Click Send; UI shows "Sending" despite no user message.
- Impact:
  - Creates ghost runs / wasted compute.
  - Looks buggy and undermines trust.
- Fix direction:
  - Disable Send if `trim(input) === ""` (everywhere).
  - Add server-side validation to reject empty prompts.
  - If an entry point is meant to prefill text, actually prefill + focus the cursor.
- Evidence:
  - `research/ux-audit-core-flows/media/05-send-enabled-when-empty-sent-empty.png`

### 6) "Automate your browser" quickstart triggers an "Invalid Tool" error

- Repro:
  - In a new session, click "Automate your browser".
  - The assistant posts setup guidance, then an "Invalid Tool" error appears.
- Impact:
  - This is a headline feature; failing immediately is a credibility hit.
  - The run remains in a "Responding" state after the error, compounding confusion.
- Fix direction:
  - Align the quickstart agent/prompt with the actual tool manifest available in OpenWork.
  - When an invalid tool call happens, convert to a user-facing error with a clear next step (instead of leaving the run hanging).
  - Add an integration test for this button: click -> first successful response -> no tool errors.
- Evidence:
  - `research/ux-audit-core-flows/media/06-browser-automation-invalid-tool-error.png`

### 7) Unexpected floating "Connect Notion MCP" CTA appears outside the Apps page

- Repro:
  - After opening the model picker / returning to a session, a "Connect Notion MCP" floating button appeared.
- Impact:
  - Feels like an ad or random interruption; breaks focus on the active task.
- Fix direction:
  - Only show MCP connection prompts contextually (when the user tries to use Notion, or within Apps).
  - If it must appear, make it dismissible and non-sticky.
- Evidence:
  - `research/ux-audit-core-flows/media/01-session-responding-stuck.png`
  - `research/ux-audit-core-flows/media/06-browser-automation-invalid-tool-error.png`

### 8) Settings > Advanced exposes destructive reset actions with confusing copy in web/remote mode

- Repro:
  - Go to Settings -> Advanced.
  - Observe "Reset onboarding" and "Reset app data" actions.
- Impact:
  - "restarts the app" is ambiguous in web mode (what restarts: browser tab? remote server? desktop app?).
  - Risky actions are easy to bump into while exploring.
- Fix direction:
  - Hide/disable desktop-only reset actions in web UI.
  - Ensure confirmation UX is explicit (visible input field for typing `RESET`, plus modal confirmation).
- Evidence:
  - `research/ux-audit-core-flows/media/07-settings-advanced-reset-actions.png`

## Media Index

- `research/ux-audit-core-flows/media/01-session-responding-stuck.png`
- `research/ux-audit-core-flows/media/02-skills-empty-recommended.png`
- `research/ux-audit-core-flows/media/03-task-list-notification-mixed-with-session.png`
- `research/ux-audit-core-flows/media/04-plugins-add-opencode-scheduler-reload.png`
- `research/ux-audit-core-flows/media/05-send-enabled-when-empty-sent-empty.png`
- `research/ux-audit-core-flows/media/06-browser-automation-invalid-tool-error.png`
- `research/ux-audit-core-flows/media/07-settings-advanced-reset-actions.png`
