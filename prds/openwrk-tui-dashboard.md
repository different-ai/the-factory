# Openwrk TUI Dashboard

Status: Draft
Owner: OpenWork

## Context

OpenWork is an open-source alternative to Claude Cowork with a mobile-first, premium UX focus and messaging surfaces (WhatsApp/Telegram) through Owpenbot. The headless host (`openwrk`) is the entry point for many users, but it currently lacks a human-friendly, interactive terminal experience. We want the default `openwrk` run to feel as polished and navigable as OpenCode's TUI while keeping logs and control accessible.

## Problem

Today, `openwrk` prints startup lines and raw logs. Users struggle to understand which services are up, how to connect, and how to navigate logs. There is no interactive status view, no quick way to copy the OpenCode attach command, and no safe way to detach while keeping services running.

## Goals

- Default `openwrk` shows an interactive dashboard with service status, ports, LAN URLs, and tokens.
- Provide a logs view with basic filtering and follow/pause controls.
- Provide a single action to copy the `opencode attach` command (no in-app attach).
- Support `detach` to keep services running while exiting the UI.
- Reuse the same OpenTUI library and visual language as OpenCode's TUI.
- Keep log-only mode via `openwrk serve` (or `--no-tui`) for scripts/CI.

## Non-goals

- Embedding OpenCode TUI inside the Openwrk UI (no iframe-like nesting).
- Replacing OpenCode TUI or duplicating its full feature set.
- Remote UI over web; this is terminal-only.

## Users and Use Cases

- Local developer running `openwrk` and needing clear service status and connection info.
- Operator running `openwrk serve` for long-running services and log streaming.
- Support/debug flows where quick log filtering and a copyable attach command matter.

## UX Overview

### Default behavior

- If stdout is a TTY: show the TUI dashboard.
- If not a TTY: fall back to log-only output.

### Views

- Overview (default): status and connection details.
- Logs: tail log buffer with filters and follow/pause.
- Help: keyboard shortcuts and commands.

### Actions

- Copy attach command: prints or copies the `opencode attach` command line.
- Detach: starts `openwrk serve` in the background, exits UI.
- Quit: shuts down services and exits.

### ASCII mock (Overview)

```
+------------------------------------------------------------------------------+
| openwrk - status                                                     v0.1.xx |
| run id: 6bd8a8fc-1e35-4190-96a4-f6496de277fa                                 |
+--------------------------------+---------------------------------------------+
| Services                       | Connect                                    |
|                                |                                            |
| o opencode        Running      | OpenWork URL (LAN)                          |
| o openwork-server Running      |   http://10.0.0.84:8797                     |
| o owpenbot        Stopped      |                                            |
|                                | OpenWork Token                              |
| Health: All green              |   dev-token                                 |
| Uptime: 00:02:31               | Host Token                                  |
|                                |   dev-host-token                            |
| Ports                          |                                            |
|   opencode: 59049              | OpenCode URL                                |
|   openwork: 8797               |   http://10.0.0.84:59049                     |
|   owpenbot health: 3005        | Opencode Password                            |
|                                |   <generated>                               |
+--------------------------------+---------------------------------------------+
| Actions: [L] Logs  [C] Copy attach command  [D] Detach  [Q] Quit             |
+------------------------------------------------------------------------------+
```

### ASCII mock (Logs)

```
+------------------------------------------------------------------------------+
| openwrk - logs                                                           [/] |
+------------------------------------------------------------------------------+
| Filters: all | opencode | openwork-server | owpenbot   level: info|warn|err   |
+------------------------------------------------------------------------------+
| 12:42:21 [openwork-server] INFO  GET /workspaces 200 12ms                     |
| 12:42:22 [opencode]        INFO  server listening on http://0.0.0.0:59049     |
| 12:42:25 [openwork-server] WARN  GET /approvals 401 1ms                       |
| 12:42:31 [owpenbot]        ERROR failed to start: missing token               |
| ...                                                                          |
+------------------------------------------------------------------------------+
| [F] Follow  [P] Pause  [/] Filter  [B] Back                                   |
+------------------------------------------------------------------------------+
```

## Interaction Details

- Copy attach command prints:
  - `OPENCODE_SERVER_PASSWORD=<pass> opencode attach http://<lan-ip>:<port> --dir <workspace>`
- Detach starts `openwrk serve` with the same ports and tokens, then exits.
- Quit sends shutdown to all child processes and exits.

## CLI Flags and Environment

- `openwrk` (default): TUI when TTY.
- `openwrk serve`: no TUI, log-only.
- `--tui` / `--no-tui`: force behavior.
- `--detach`: spawn background service and exit UI.
- `--log-format`: defaults to `pretty` for TTY, `json` for non-TTY.
- `--color` / `--no-color` or `NO_COLOR` env: controls pretty log colors.

## Technical Approach

- Implement TUI in `packages/headless` using OpenTUI.
- Split runtime into:
  - `orchestrator` (current logic: process spawn + health checks)
  - `ui` (OpenTUI views, keyboard navigation, log buffer)
- Use a shared in-memory event bus:
  - service lifecycle events (spawn, health, exit)
  - log line events (already captured by `prefixStream`)
- Log view uses a ring buffer per service with a shared filter index.

## Research: OpenTUI usage in OpenCode

OpenCode uses OpenTUI as the rendering layer with SolidJS bindings.

Key dependencies (from `_repos/opencode/packages/opencode/package.json`):
- `@opentui/core`
- `@opentui/solid`
- `opentui-spinner`
- `solid-js`

Entry point patterns:
- `tui()` in `_repos/opencode/packages/opencode/src/cli/cmd/tui/app.tsx` sets up `render()` with:
  - `targetFps: 60`, `useKittyKeyboard`, `exitOnCtrlC: false`
  - `consoleOptions` for copy-to-clipboard
- UI built with `<box>` nodes and `RGBA` colors from `@opentui/core`.

Theme system:
- Theme provider in `_repos/opencode/packages/opencode/src/cli/cmd/tui/context/theme.tsx`.
- Theme JSON files in `_repos/opencode/packages/opencode/src/cli/cmd/tui/context/theme/*.json`.
- `useRenderer()` and `useTheme()` are central for theming and selection colors.

Dialogs and overlays:
- `Dialog` component in `_repos/opencode/packages/opencode/src/cli/cmd/tui/ui/dialog.tsx`.
- Uses `useRenderer()` for selection handling and clipboard copy on selection.

Input and keyboard handling:
- `useKeyboard()` hooks (see `dialog.tsx`) to handle escape and global shortcuts.
- `renderer.console.onCopySelection` is used for clipboard integration.

Implications for Openwrk:
- We can reuse the same OpenTUI primitives (box layout, render settings, RGBA).
- We can reuse OpenCode theme JSON files or ship a minimal subset for Openwrk.
- We should match OpenCode keyboard conventions (e.g. Ctrl+X leader) where possible.

## Open Questions

- Should `detach` also enable a `--log-file` option to persist logs?
- Do we ship the full OpenCode theme list or a minimal curated subset?
- Should `openwrk` cache the last selected view between runs?

## Success Metrics

- Users can identify service status and connect details in under 10 seconds.
- Users can filter logs by service and severity without leaving the UI.
- `openwrk serve` remains unchanged for scriptability.

## Implementation Plan

1. Add OpenTUI dependencies to `packages/headless`.
2. Create a minimal TUI app with Overview + Logs + Help views.
3. Wire log buffer and service state into the UI.
4. Add `--tui`, `--no-tui`, `--detach`, and `openwrk serve` behavior.
5. Match OpenCode theme names and keyboard hints.
6. Document TUI usage in `packages/headless/README.md`.
