---
title: OpenWork Single-Workspace Core Rewrite Requirements
description: Best-guess product and architecture requirements for a from-scratch redesign of the OpenWork core app focused on one workspace.
---

## Summary

If we redesign the core app around a single workspace, the current product still reads as a **workspace-backed session runner**, not a generic workspace browser.

The main thing the app has to do is:

1. attach to one workspace
2. connect that workspace to a runtime
3. let the user read and drive sessions clearly
4. expose just enough settings to keep the system healthy and configurable

The shell technology is replaceable. Tauri, Electron, web, or something else is an implementation choice. The product requirement is that the shell stays thin and the runtime/control behavior stays explicit.

## Best-guess product thesis

- One active workspace
- One active runtime connection
- One primary session surface
- Settings as a support surface, not the center of the product
- Remote connect as a first-class path, not an edge case

## Best-guess primary user flow

1. Open the app.
2. If no workspace is attached yet, either:
   - create a local workspace, or
   - connect a remote OpenWork worker with URL + token.
3. Connect to that workspace's runtime.
4. Land in a session/task view.
5. Read messages, send prompts, inspect tool output, approve permissions, and continue work.
6. Occasionally open settings to manage providers, model defaults, workspace/server config, permissions, or reload/reconnect behavior.

## Core requirements

### 1. Session needs to be readable

This is the core requirement.

- The session transcript must be easy to scan.
- Streaming state must be obvious.
- Older messages must be loadable.
- Search inside a session must exist.
- Tool output, files, todos, and status should be visible without destroying reading flow.
- Permission prompts and follow-up questions must be explicit and easy to answer.
- Retry, abort, rename, compact, and resume flows should remain available.
- Reloads or reconnects should preserve the feeling of session continuity.

### 2. Single-workspace does not remove workspace lifecycle

Even with one workspace in the UI, the app still needs real workspace lifecycle behavior:

- first-run bootstrap
- create local workspace
- connect remote workspace
- remember the active workspace
- show workspace identity/root/runtime state
- reconnect or recover when the workspace/runtime is unhealthy
- persist workspace config

The simplification should be: **no multi-workspace-first UI**.

It should not be: **pretend workspaces do not exist**.

### 3. OpenWork server needs to own workspace behavior

This is the most important architecture constraint in the current system.

- The OpenWork app is the UI/control layer.
- The OpenWork server is the API/control layer consumed by the app.
- The OpenCode runtime remains the execution engine behind that surface.
- Workspace-backed reads/writes should go through OpenWork server first.
- Direct shell-only filesystem mutation should be fallback behavior, not the primary product path.

That means the rewrite should assume OpenWork server owns things like:

- workspace config reads/writes
- `.opencode/` mutation
- `opencode.json` / `opencode.jsonc` mutation
- reload-required semantics
- approval/audit-sensitive config changes
- remote/web parity for workspace capabilities

If a feature only works through local shell filesystem APIs, that should be treated as an architecture gap.

### 4. Remote connect is a core feature

The single-workspace app still has to support:

- local desktop-hosted usage
- CLI/orchestrator-hosted usage
- hosted/cloud worker usage

The mental model should stay simple:

- attach to one workspace
- connect to one runtime
- if remote, use URL + token or deep link

Remote attach should not feel like an advanced mode bolted onto a local-only app.

### 5. OpenCode parity still matters

The UI should stay aligned with underlying OpenCode/OpenWork primitives.

- Provider auth, model behavior, skills, plugins, MCP, commands, and config should map cleanly to the real underlying runtime.
- The rewrite should avoid inventing app-only abstractions that cannot work through the OpenWork server path.
- Anything the app mutates in `.opencode/` should remain compatible with server ownership and future web/mobile parity.

### 6. Settings should get smaller, not disappear

Minimum settings that still seem required:

- providers and default model
- workspace/server connection details
- authorized folders / permission scope
- reload controls
- basic appearance/app preferences

Likely second-wave settings:

- skills/plugins/MCP
- automations
- messaging identities
- advanced diagnostics/recovery

### 7. Predictability and safety are non-negotiable

- least-privilege defaults
- explicit permission prompts
- visible runtime and connection state
- clear reload/restart semantics
- exact health-check failures with next steps
- explicit configuration preferred over clever implicit behavior

## Minimum product surfaces for a single-workspace rewrite

### Must-have

1. **Workspace attach/setup**
   - create local
   - connect remote

2. **Session screen**
   - transcript
   - composer
   - progress/status
   - permissions/questions
   - session history access

3. **Runtime/workspace status surface**
   - connection health
   - workspace identity
   - reconnect/recover/reload
   - basic diagnostics

4. **Settings**
   - providers/model
   - permissions/authorized folders
   - workspace/server config
   - appearance/basic app prefs

### Probably removable or deferrable

- multi-workspace sidebar and switching as a primary navigation model
- dashboard-heavy workspace browsing
- shared workspace/org template browsing
- share/publish bundle flows
- Slack/Telegram identities UI
- full cloud provisioning UX
- advanced diagnostics as separate major surfaces
- exposing every extension surface in v1 UI

## Things the rewrite should not remove

- the workspace concept itself
- remote connect
- server-owned config mutation path
- readable session UX
- provider/model setup
- authorized-folder permission model
- explicit reload semantics

## Rewrite shape that seems most aligned

If the app were rebuilt from scratch for one workspace, the cleanest shape would likely be:

- no dashboard as the main destination
- setup flow only when no workspace is attached
- session as the default destination once attached
- a small workspace/runtime drawer instead of a large workspace management shell
- a smaller settings surface with strong server-backed ownership

## Architecture rule for the rewrite

> Optimize the UI around one workspace, but keep workspace semantics and OpenWork server ownership intact.

That rule matters more than whether the shell is Tauri, Electron, or web-first.

## Evidence reviewed

- `_repos/openwork/AGENTS.md`
- `_repos/openwork/ARCHITECTURE.md`
- `_repos/openwork/apps/app/src/app/app.tsx`
- `_repos/openwork/apps/app/src/app/pages/session.tsx`
- `_repos/openwork/apps/app/src/app/context/workspace.ts`
- `_repos/openwork/apps/app/src/app/workspace/create-workspace-modal.tsx`
- `_repos/openwork/apps/app/src/app/workspace/create-remote-workspace-modal.tsx`
- `_repos/openwork/apps/app/src/app/pages/settings.tsx`
- `_repos/openwork/apps/app/src/app/pages/config.tsx`
- `_repos/openwork/apps/app/src/app/app-settings/authorized-folders-panel.tsx`
- `_repos/openwork/apps/app/src/app/pages/identities.tsx`
- `_repos/openwork/apps/app/src/app/shell/settings-shell.tsx`
