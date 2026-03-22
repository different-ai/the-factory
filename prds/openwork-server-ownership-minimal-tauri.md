---
title: Minimal Tauri + OpenWork Server Ownership
description: Inventory the responsibilities currently owned by Tauri in OpenWork and define which responsibilities should move into OpenWork server versus remain in the desktop shell.
---

## Summary

OpenWork currently uses Tauri for both shell concerns and a large amount of workspace logic.

That creates two capability surfaces:

- a desktop-only Tauri command layer
- an OpenWork server API layer

This split works against the direction already stated in `_repos/openwork/AGENTS.md` and `_repos/openwork/ARCHITECTURE.md`: anything that mutates `.opencode/` should be expressible via the OpenWork server API, with Tauri-only filesystem calls treated as a fallback rather than a separate product surface.

This PRD is a best-guess ownership proposal after reviewing the current desktop shell, workspace helpers, and OpenWork server routes in `_repos/openwork`.

## Problem statement

- Tauri currently owns direct reads and writes for `opencode.json`, `.opencode/openwork.json`, skills, commands, workspace bootstrap, archive import/export, scheduler cleanup, and reload watching.
- OpenWork server already exposes overlapping APIs for config, audit, markdown files, plugins, skills, MCP, commands, scheduler jobs, artifacts, import/export, and OpenCode Router configuration.
- The OpenWork app therefore has to branch between Tauri calls and OpenWork server calls for capabilities that should conceptually share one host contract.
- Desktop-only mutations bypass the same approval and audit path that remote clients use through OpenWork server.
- Web and mobile parity is harder because the same feature sometimes exists only as a Tauri command.

## Goals

- Make OpenWork server the canonical owner of workspace-backed reads and writes.
- Reduce Tauri to a thin desktop shell for native OS concerns.
- Remove duplicated ownership between `packages/desktop/src-tauri` and `packages/server`.
- Make the OpenWork app rely on one host contract for desktop host mode, remote clients, and future web/mobile surfaces.
- Keep approvals, audit, and reload behavior centralized in OpenWork server.

## Non-goals

- Remove Tauri from OpenWork desktop.
- Replace `openwrk` or redesign sandbox architecture in this PRD.
- Rebuild OpenCode engine lifecycle from scratch.
- Redesign the UI.
- Commit to moving every host process concern into OpenWork server immediately.

## Code evidence reviewed

- Tauri command surface: `_repos/openwork/packages/desktop/src-tauri/src/lib.rs`
- Tauri workspace ownership: `_repos/openwork/packages/desktop/src-tauri/src/commands/workspace.rs`
- Tauri skill, command, config, and maintenance commands:
  - `_repos/openwork/packages/desktop/src-tauri/src/commands/skills.rs`
  - `_repos/openwork/packages/desktop/src-tauri/src/commands/command_files.rs`
  - `_repos/openwork/packages/desktop/src-tauri/src/commands/config.rs`
  - `_repos/openwork/packages/desktop/src-tauri/src/commands/misc.rs`
  - `_repos/openwork/packages/desktop/src-tauri/src/commands/scheduler.rs`
- Tauri bootstrap and file watcher helpers:
  - `_repos/openwork/packages/desktop/src-tauri/src/workspace/files.rs`
  - `_repos/openwork/packages/desktop/src-tauri/src/workspace/watch.rs`
  - `_repos/openwork/packages/desktop/src-tauri/src/workspace/state.rs`
- Tauri host-process ownership:
  - `_repos/openwork/packages/desktop/src-tauri/src/commands/engine.rs`
  - `_repos/openwork/packages/desktop/src-tauri/src/commands/openwrk.rs`
  - `_repos/openwork/packages/desktop/src-tauri/src/commands/opencode_router.rs`
  - `_repos/openwork/packages/desktop/src-tauri/src/openwork_server/mod.rs`
- OpenWork server overlap: `_repos/openwork/packages/server/src/server.ts`
- Existing app-side OpenWork server client: `_repos/openwork/packages/app/src/app/lib/openwork-server.ts`

## Current Tauri responsibility inventory

### 1) Desktop shell and OS integration

- window decoration toggles
- native open/save/folder pickers
- opener and reveal-in-folder behaviors
- updater environment and app build metadata
- desktop event bridge for Tauri-only events

### 2) Local host process supervision

- find, install, start, and stop the OpenCode engine
- start and stop `openwrk`
- start and stop `openwork-server`
- start and stop `opencode-router`
- manage ports, child PIDs, child stdout/stderr, and cleanup on exit
- run Docker sandbox doctor and stop sandbox containers

### 3) Workspace registry and bootstrap

- persist recent workspaces and active workspace in app data
- create the starter workspace
- create, forget, activate, and rename local or remote workspace entries
- store remote workspace metadata, OpenWork tokens, and sandbox metadata
- seed `.opencode` defaults for starter workspaces

### 4) Workspace filesystem mutation

- read and write `opencode.json` / `opencode.jsonc`
- read and write `.opencode/openwork.json`
- manage authorized roots
- list, read, write, install, import, and uninstall skills
- list, write, and delete OpenCode commands
- run `opkg install`
- copy local skill directories into the workspace
- export and import workspace config archives
- launch `opencode mcp auth`
- reset OpenCode cache and reset OpenWork local app state

### 5) Desktop eventing and reload detection

- watch workspace root and `.opencode/`
- infer reload reasons from file paths
- emit `openwork://reload-required`
- emit sandbox creation progress events

### 6) Scheduler and maintenance

- enumerate scheduled jobs from launchd/systemd-backed storage
- uninstall and delete scheduled jobs from desktop-managed system paths

## OpenWork server overlap that already exists today

OpenWork server already exposes routes for:

- workspace config read and patch
- audit log read
- markdown file read and write
- plugins add and remove
- skills list, read, write, delete, and hub install
- MCP list, add, remove, and auth removal
- commands list, upsert, and delete
- scheduler list and delete
- logical workspace export and import
- inbox upload and artifact download
- OpenCode Router token, identity, binding, and send flows

That means a large amount of the desired ownership shift is not greenfield. The server surface already exists; the main gap is product ownership and frontend routing.

## Recommended ownership split

| Responsibility | Recommended owner | Why |
| --- | --- | --- |
| window chrome, updater, app version/build info | Tauri | Pure desktop shell behavior with no web/mobile parity value. |
| native file/folder pickers and reveal/open path | Tauri | These are OS affordances, not workspace business logic. |
| OpenCode engine / `openwork-server` / `openwrk` / `opencode-router` child-process spawn and stop | Tauri for now | OpenWork server cannot bootstrap itself; this is host-shell supervision. Longer-term this may belong in `openwrk`, not OpenWork server. |
| Docker binary detection, sandbox doctor, sandbox stop | Tauri for now | This is host-machine orchestration. It should not block the server ownership work. |
| recent-workspace list, active-workspace preference, local UI-only state | Client-local state | This is presentation state. On desktop it can live in Tauri app data; on web it can live in browser storage. |
| starter workspace initialization and `.opencode` seeding | OpenWork server | This mutates workspace files and should be identical across host clients. |
| `opencode.json` read and write | OpenWork server | Already aligns with server config routes and approval/audit. |
| `.opencode/openwork.json` read and write | OpenWork server | This is OpenWork workspace config and should not be desktop-only. |
| authorized roots management | OpenWork server | This is part of the host authorization contract, not a UI-only detail. |
| skills list/read/write/install/delete/import | OpenWork server | Skills are workspace capabilities; server already owns most of this surface. |
| commands list/write/delete | OpenWork server | Commands belong to `.opencode` and should follow server approval/audit. |
| plugin and MCP config mutation | OpenWork server | This is already exposed in server and should be the only path. |
| markdown workspace file read/write | OpenWork server | Already exposed by server and needed for remote/web parity. |
| workspace export/import data model | OpenWork server | Server already exports logical config payloads. Native archive file selection can remain in Tauri. |
| scheduled job list/delete | OpenWork server | Already exposed and should be the host authority. |
| reload watching and reload event stream | OpenWork server | Reload semantics should be host-wide and workspace-scoped, not desktop-only. |
| OpenCode Router config and identity management | OpenWork server | Already mostly server-owned and should stay there. |
| MCP auth browser launch | Split: server owns auth state, Tauri performs local browser/open if needed | The auth contract belongs to the host; only the final OS browser launch is desktop-specific. |
| cache repair and app-state reset | Mostly Tauri | This is local app maintenance rather than shared workspace capability. |

## Best-guess move list

These are the responsibilities that should move into OpenWork server:

- workspace bootstrap that creates or normalizes `.opencode` files
- starter/default seed logic in `_repos/openwork/packages/desktop/src-tauri/src/workspace/files.rs`
- `opencode.json` and `.opencode/openwork.json` read/write
- authorized-roots persistence
- all skill CRUD and install/import flows
- all command CRUD flows
- `opkg`-backed workspace capability installs
- workspace markdown file read/write
- workspace import/export as a server data contract
- scheduler list/delete
- reload watch and reload event delivery
- any OpenCode Router config that still depends on desktop-only commands

These are the responsibilities that should stay on Tauri:

- native dialogs and path reveal/open actions
- updater, build info, window controls
- spawning and supervising host-side child processes
- local app cache reset and app-state reset
- desktop-only progress events until the server exposes a unified stream

These are the responsibilities that should stay off OpenWork server for now even if Tauri is too heavy:

- Docker sandbox lifecycle and low-level host orchestration
- detached `openwrk` startup
- direct OpenCode engine installation and binary discovery

Those are better treated as host supervisor concerns. If OpenWork wants even less Tauri later, the cleaner destination is likely `openwrk` or another dedicated host daemon, not the request-serving OpenWork server.

## Proposed product rule

Use this ownership rule going forward:

> If a feature reads or writes workspace files, `.opencode`, `opencode.json`, or OpenWork workspace config, the OpenWork app should call OpenWork server rather than Tauri.

Tauri should only be the desktop shell that:

- picks files and folders
- opens native windows and OS affordances
- supervises host-side child processes
- exposes updater and app-maintenance hooks

## Migration plan

### Phase 1: route the app through existing OpenWork server APIs

- Prefer `_repos/openwork/packages/app/src/app/lib/openwork-server.ts` over `_repos/openwork/packages/app/src/app/lib/tauri.ts` for:
  - config
  - skills
  - commands
  - plugins
  - MCP
  - scheduler
  - file content
  - audit
  - export/import
  - OpenCode Router config surfaces
- Keep Tauri only for dialogs, updater, shell affordances, and process bootstrap.

### Phase 2: fill server gaps

- Add server endpoints for workspace initialization and starter seeding.
- Add server endpoints for authorized-roots updates.
- Add a server-owned install/import flow for skills and `opkg` packages.
- Add a server-owned reload watcher and event stream so reload behavior is no longer a desktop-only file watcher.

### Phase 3: shrink the Tauri command surface

- Remove Tauri commands once the OpenWork app no longer needs them.
- Keep only shell-level commands in `packages/desktop/src-tauri/src/lib.rs`.
- Treat direct Tauri filesystem mutation as an escape hatch, not a primary path.

## Acceptance criteria

1. The OpenWork app does not need direct Tauri commands for skills, commands, config, plugins, MCP, scheduler, workspace markdown files, or workspace import/export when connected to a local OpenWork server.
2. Every workspace-backed mutation flows through OpenWork server approval and audit paths.
3. Tauri no longer owns canonical writes to `.opencode` or `opencode.json`.
4. Reload signals come from OpenWork server rather than a desktop-only file watcher.
5. The remaining Tauri surface is limited to shell concerns: dialogs, updater, OS integration, and host-process supervision.
6. Desktop host mode and remote clients share the same workspace capability surface wherever the host is available.

## Risks

- Workspace bootstrap currently mixes product defaults with shell setup. Untangling that may expose assumptions in onboarding.
- Some flows may currently rely on Tauri returning raw file paths immediately after dialogs; server routing must preserve user intent without breaking UX.
- `openwrk` and OpenWork server both touch host orchestration concerns. Ownership boundaries must stay clear.
- Global commands and global skills may need explicit host-only behavior even after migration.

## Open questions

1. Should workspace creation itself become an OpenWork server endpoint, or should Tauri/browser create the folder and then ask the server to initialize it?
2. Should authorized roots live in OpenWork server config, `.opencode/openwork.json`, or both?
3. Should `opkg install` execute inside OpenWork server, or should the server ask a host supervisor to run it?
4. Should archive packaging for export/import remain a desktop concern while the server owns the logical payload?
5. Should sandbox progress move to a server or `openwrk` event stream instead of Tauri events?
6. Which existing Tauri commands should be considered acceptable permanent shell APIs versus temporary compatibility shims?
