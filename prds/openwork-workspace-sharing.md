---
title: Workspace sharing (access + config + bots)
description: Share a workspace by copying credentials, exporting a config bundle, or attaching Telegram/Slack/WhatsApp bots.
---

## Summary
OpenWork is a mobile-first, premium UX layer on top of OpenCode (see `_repos/openwork/AGENTS.md`).

We need a `Share...` action in the workspace `...` menu (sidebar) that lets a user share a workspace in multiple practical ways:
- `Access link / QR` (another OpenWork client connects)
- `Copy credentials` (raw OpenWork server URL + access token)
- `Share config bundle` (export/import `.openwork-workspace` archive; re-usable skills/plugins/commands)
- `Bots` (Telegram / Slack / WhatsApp via owpenbot; "share" means the bot is now an interface to this workspace)

The most important architectural question is not "invites/roles", it is **what a workspace maps to on the network**.
Today, the host can run an OpenWork server that knows about multiple workspaces, but it exposes only the *active* workspace to clients. Sharing "a workspace" must avoid collisions with "active workspace switching".

This PRD is grounded in the current codebase (OpenWork `origin/dev`) and describes the minimal changes needed to ship a useful share experience first, then the deeper runtime refactor for truly independent workspace endpoints.

## Problem statement
- Sharing is currently **server-centric and buried**: Settings already shows URL + tokens, but users expect `Share...` next to the workspace.
- Users want to share not only "a connection" but also "a workflow pack": skills, commands, plugins, MCP config.
- Users also want non-UI interfaces to the same workspace (Slack/Telegram). Today those live under owpenbot settings, not under the workspace.
- The multi-workspace runtime still has a single "active workspace" axis. If multiple people connect, "which workspace am I in?" can drift.

## Goals
- A workspace-level `Share...` modal reachable from the sidebar workspace row.
- Multiple sharing modes, all built on top of existing OpenWork/OpenCode primitives (tokens, config files, owpenbot).
- A share experience that is honest about what is being shared:
  - live access (server credentials)
  - reproducible setup (config bundle)
  - messaging interface (bot)
- Keep the system simple: **no new account system, no new invite/role model** beyond existing token + approval flows.

## Non-goals
- Building a full user/role system ("viewer/operator/admin") in OpenWork.
- Collaborative editing or multi-user conflict resolution.
- Solving NAT traversal (we can document LAN/VPN/tunnel guidance).

## Current state (mapped to real code)

### Multi-workspace UI already exists
- Workspace list + per-workspace actions live in `packages/app/src/app/components/session/sidebar.tsx`.
  - Actions today: `Edit connection`, `Test connection`, `Remove`.
  - This is the correct surface to add `Share...`.
- Workspace state + remote connection wiring lives in `packages/app/src/app/context/workspace.ts`.
  - Remote workspaces can be `remoteType: "openwork"`.
  - Connection test state is tracked per workspace (`workspaceConnectionStateById`).

### Remote connect UI already exists
- Remote connect modal: `packages/app/src/app/components/create-remote-workspace-modal.tsx`.
  - Inputs already match what we want to share: `openworkHostUrl` + `openworkToken` (+ optional directory + displayName).

### Host credentials are already shown (but only in Settings)
- Settings "OpenWork server sharing" section already displays:
  - server connect URL
  - access token (client token)
  - server token (host token)
  - `Show/Hide` + `Copy`
  - `packages/app/src/app/pages/settings.tsx` (Remote tab)
- Host info shape: `OpenworkServerInfo` in `packages/app/src/app/lib/tauri.ts`.
- Host info source: tauri command `openwork_server_info` (wired in `packages/desktop/src-tauri/src/commands/openwork_server.rs`).
- Host server is spawned in `packages/desktop/src-tauri/src/openwork_server/mod.rs` and `packages/desktop/src-tauri/src/openwork_server/spawn.rs`.
  - Tokens are generated at spawn time (`client_token`, `host_token`).
  - The server binds to `0.0.0.0` and exposes LAN/mdns connect URLs.

### Workspace config "packages" already exist (export/import)
This directly matches the user request about re-sharing skills/etc.

- Export bundles include `opencode.json` + `.opencode/**` and a `manifest.json`.
  - Implemented in `packages/desktop/src-tauri/src/commands/workspace.rs` (`workspace_export_config`).
- Import validates and extracts only `opencode.json` and `.opencode/**`, skipping secret-like filenames.
  - Implemented in `packages/desktop/src-tauri/src/commands/workspace.rs` (`workspace_import_config`).
- Workspace store exposes:
  - `exportWorkspaceConfig()` and `importWorkspaceConfig()` in `packages/app/src/app/context/workspace.ts`.

### Bots: Telegram + WhatsApp + Slack exist via owpenbot
- Adapters:
  - Telegram: `packages/owpenbot/src/telegram.ts`
  - WhatsApp: `packages/owpenbot/src/whatsapp.ts`
  - Slack: `packages/owpenbot/src/slack.ts`
- OpenWork server endpoints for configuring bot tokens exist:
  - `POST /workspace/:id/owpenbot/telegram-token` (client auth)
  - `POST /workspace/:id/owpenbot/slack-tokens` (client auth)
  - Implemented in `packages/server/src/server.ts`.
- Client wiring exists in `packages/app/src/app/lib/openwork-server.ts`:
  - `setOwpenbotTelegramToken()`
  - `setOwpenbotSlackTokens()`
- There is already an Owpenbot settings UI component in `packages/app/src/app/pages/settings.tsx`.

### openwrk already has multi-workspace state (host-side)
- openwrk router daemon exists and persists a workspace list + active workspace:
  - Implemented in `packages/headless/src/cli.ts` (`openwrk daemon ...`, `/workspaces` routes).
  - This is relevant because "share workspace" eventually needs stable workspace identity and stable endpoints.

## What's missing
- No workspace-level share entry point (the request is specifically `...` menu next to a workspace).
- No share artifact that combines:
  - connection details (URL/token)
  - workspace identity (name/id)
  - safe UX copy
  - copy/share sheet/QR
- No "share this workspace via bot" flow attached to the workspace row.
- No explicit product stance on "is a workspace a server endpoint?"

## Proposed UX

### Entry point
- Add `Share...` to the workspace row overflow menu in `packages/app/src/app/components/session/sidebar.tsx`.
  - If the UI doesn't yet use a `...` overflow menu for workspaces, add one (the sidebar already shows action buttons; `Share...` should live next to those, but surfaced as a single share entry).

### Share modal (single place, multiple share modes)
Modal title: `Share workspace`.
Context header shows:
- workspace name
- local vs remote
- (if remote) OpenWork host URL

Modes (tabs or cards):

1) `Access` (URL / QR)
- Shows:
  - `OpenWork Server URL` (best connect URL, e.g. LAN or mdns)
  - `Access token` (client token)
- Actions:
  - `Copy link` (encodes URL + token + workspace label as a deep link payload)
  - `Show QR`
  - `Share...` (OS share sheet where available)
- Microcopy:
  - "Anyone with this link can connect as a client. Use only with trusted people."
  - "Works best on the same Wi-Fi or over VPN/tunnel."

2) `Credentials` (manual)
- Shows raw fields (copy buttons) and clear warnings.
- By default, show client token only.
- Advanced disclosure: show host token (`Server token`) with explicit warning:
  - "Keep private. Used for approvals and host-only actions."

3) `Config bundle` (share the workflow pack)
- Goal: share skills/plugins/commands/MCP config without giving live access.
- For local workspaces:
  - `Export config` -> produces `.openwork-workspace` archive (already implemented).
  - After export, user shares the file via OS share sheet.
- For remote workspaces:
  - Show: "Export is only supported for local workspaces." (current limitation in code).
- Microcopy:
  - "This exports `opencode.json` + `.opencode/` (skills, commands, plugins, MCP). Secrets are excluded."

4) `Bots` (Telegram / Slack / WhatsApp)
This is the "Slack agent has access to this workspace" path.

- Telegram:
  - If configured: show `Connected` and instructions for using it (DM, mention, etc.).
  - If not configured: prompt for token (or link to Settings) and save via OpenWork server.
- Slack:
  - If configured: show `Connected` and "invite app to channel" instructions.
  - If not configured: prompt for bot token + app token and save via OpenWork server.
- WhatsApp:
  - Show current status (linked/unlinked) and a "Show pairing QR" action if supported.

Note: in v0, "Bots" can deep-link to the existing settings section and preselect the workspace.

## Architecture decision: what does "share workspace" mean?

### Key constraint in today's server
OpenWork server currently exposes only the *active* workspace to clients:
- `GET /workspaces` returns `[active]` only (see `packages/server/src/server.ts`).
- `/opencode` proxy also targets `config.workspaces[0]` (active workspace).

That means if we share `host URL + client token` today, we are effectively sharing "whatever workspace the host has active".
That is acceptable for an early version, but it is not what users intuitively expect when they click `Share...` on a specific workspace row.

### Phase 0 (ship quickly, no new backend API)
- Add the Share modal in the sidebar.
- `Access` / `Credentials` uses existing host info (same fields currently shown in Settings).
- Explicitly label what is happening:
  - "This shares the host's current active workspace."
- Add a one-tap helper in the modal: `Make this workspace active on host`.
  - Implementation uses existing host-only switching (details are in the codebase; this PRD does not mandate how).

### Phase 1 (recommended): workspace == endpoint (independent workspace servers)
To support:
- multiple workspaces accessible independently
- multiple clients connected to different workspaces simultaneously
- predictable sharing ("this link always points to this workspace")

We should expose **one OpenWork server endpoint per workspace**.

Implementation direction (grounded in current runtime):
- Today, desktop spawns a single `openwork-server` process in `packages/desktop/src-tauri/src/openwork_server/mod.rs`.
- Replace single-process state with a per-workspace server registry:
  - `OpenworkServerManager` becomes `OpenworkWorkspaceServerManager` keyed by `workspaceId`.
  - Each server gets its own port + tokens.
  - Each server is started with exactly one `--workspace <path>` (not the full workspace list).
- The UI already models each workspace independently (`WorkspaceInfo` list + sidebar groups).
  - We extend workspace metadata so each local workspace has a stable `openwork connect url + token` pair.

This approach avoids inventing a new share-specific API: sharing is just "copy this workspace endpoint credential".

### Security/approvals (must change if we share externally)
Current desktop spawn forces `--approval auto` (see `packages/desktop/src-tauri/src/openwork_server/spawn.rs`).
That is safe only when the server is effectively local-only.

When a workspace is shared:
- Default to `--approval manual` for that workspace server.
- Keep host token private; approvals are done by the host device.

## Requirements

### Product requirements
- Share is available from workspace `...` menu.
- Modal exposes at least:
  - `Access` (URL + client token)
  - `Config bundle` (export `.openwork-workspace`)
  - `Bots` (Telegram + Slack)
- Copy buttons always work on mobile + desktop.
- Clear warnings and explicit "trusted people only" copy.

### Technical requirements
- Share payload should be a stable, parseable format.
  - Example: `openwork://connect?url=...&token=...&name=...`
  - Fallback: JSON text block.
- No tokens written to disk in repo; UI must avoid logging tokens.
- Workspace config export must continue excluding secrets.

## Implementation map (expected files to touch)
- Workspace share entry point UI:
  - `packages/app/src/app/components/session/sidebar.tsx`
  - (new) `packages/app/src/app/components/share-workspace-modal.tsx`
- Share modal wiring + token source:
  - `packages/app/src/app/app.tsx` (host info is already fetched via `openworkServerInfo()`)
  - `packages/app/src/app/lib/tauri.ts` (host info shape)
- Config bundle actions:
  - `packages/app/src/app/context/workspace.ts` (export/import already exist)
  - `packages/desktop/src-tauri/src/commands/workspace.rs` (export/import implementation)
- Bot wiring:
  - `packages/app/src/app/lib/openwork-server.ts` (setOwpenbotTelegramToken / setOwpenbotSlackTokens)
  - `packages/app/src/app/pages/settings.tsx` (existing OwpenbotSettings UI to reuse/deeplink)
  - `packages/server/src/server.ts` (owpenbot token routes)
  - `packages/owpenbot/src/telegram.ts`
  - `packages/owpenbot/src/slack.ts`
  - `packages/owpenbot/src/whatsapp.ts`
- Phase 1 (per-workspace endpoints):
  - `packages/desktop/src-tauri/src/openwork_server/manager.rs`
  - `packages/desktop/src-tauri/src/openwork_server/mod.rs`
  - `packages/desktop/src-tauri/src/openwork_server/spawn.rs`

## Testing plan
- Manual (desktop host -> mobile client):
  - Create two local workspaces.
  - Open `Share...` on workspace A and connect from another device.
  - Verify the recipient can connect and run a simple prompt.
  - Verify share flow does not require visiting Settings.
- Config bundle:
  - Export config from workspace A.
  - Import into an empty folder on another machine.
  - Confirm `.opencode/skills` and `opencode.json` are present and secrets are not exported.
- Bots:
  - Configure Telegram token from Share modal.
  - Send a message to the bot and confirm it reaches the correct workspace.
  - Configure Slack tokens and confirm Socket Mode connection + message routing.
- Phase 1:
  - Connect to workspace A and B concurrently from two clients and verify no "active workspace" collisions.

## Success metrics
- Workspace share is discoverable (people use it without going to Settings).
- First-time remote connect success rate increases.
- Teams reuse workflow packs via config bundle export/import.
- Slack/Telegram usage increases for shared workspaces.

## Open questions
- Do we want a path-based gateway (single port) for per-workspace endpoints, or is per-workspace port acceptable in v1?
- What is the canonical deep link format (and how do we validate/sanitize it)?
- Should "Bots" be configured per workspace or per host (today it looks per workspace via `/workspace/:id/...`)?
- Should enabling sharing automatically flip approval mode from auto -> manual?

## References
- `prds/remote-first-openwork.md`
- `prds/workspace-sidebar-hub.md`
- `prds/openwork-remote-workspace-clarity.md`
