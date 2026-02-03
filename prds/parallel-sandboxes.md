---
title: Parallel sandboxes with local/remote execution
description: Provide worktree-like isolation and a per-run execution target toggle without exposing git worktrees.
---

## Summary
OpenWork is an open-source alternative to Claude Cowork that is mobile-first, purpose-first, and premium for non-technical users (see `_repos/openwork/AGENTS.md`).
This PRD defines a parallelization model that gives users isolated sandboxes and a local/remote execution toggle in the composer while hiding git worktree concepts.
The system must preserve parity with OpenCode primitives and treat all executions as OpenWork server-backed.

## Problem statement
- The current single-workspace flow limits parallel work and forces users to serialize long-running tasks.
- Advanced users want to use multiple machines or remotes, but do not want to manage git worktrees or server wiring.
- The product needs a simple, safe UI that exposes "where this runs" without exposing low-level git or infra concepts.

## Goals
- Provide a first-class "sandbox" concept with isolated filesystem state per session.
- Add a composer-level execution target selector that defaults to local.
- Allow local and remote executions using the same OpenWork server contract.
- Keep parity with OpenCode primitives (projects, folders, `.opencode`, skills, plugins).
- Maintain purpose-first UI and mobile-first ergonomics.

## Non-goals
- Building new remote compute infrastructure or a hosted runtime.
- Auto-merging changes from parallel sandboxes into the base workspace.
- Collaborative multi-user editing inside a single sandbox.
- Replacing OpenCode SDK or OpenCode server behavior.

## Success metrics
- 90% of sessions still start within 2 seconds from tap to ready state (local target).
- Remote target selection completes within 5 seconds for healthy remotes.
- At least 30% of power users adopt more than one sandbox per week.
- Less than 1% of sessions fail due to sandbox provisioning errors.

## Personas and jobs-to-be-done
- Non-technical builder: "Run two tasks in parallel without learning git or servers."
- Power user: "Run heavy tasks remotely while keeping light edits local."
- Team lead: "See where work is running and keep it safe by default."

## Experience principles
- Hide worktree terminology. The UI speaks in terms of sandboxes and targets.
- Keep the default safe: local target, single sandbox, clear indicators.
- Make target and sandbox identity always visible in the session header.
- Favor explicit actions for creating sandboxes or switching targets.

## UX overview
### Composer
- Add a compact selector labeled "Run on" with options for Local and configured Remotes.
- Default value is "Local (this device)".
- Switching the target before sending creates a new sandbox and session.

### Session header
- Add a sandbox chip showing name + target icon.
- Tap opens sandbox details (name, target, created at, status, storage size, actions).

### Project view
- Add "New sandbox" action with options:
  - Clean copy (from base workspace)
  - From current sandbox state
- Display a list of sandboxes with status: Active, Idle, Archived.

### Settings
- Add "Execution targets" management:
  - Add remote target (URL + token)
  - Rename, delete, set default
  - Health status and last used

### Copy and microcopy
- "Run on" label in composer.
- "Sandbox" chip in session header.
- Confirmation copy when switching to a remote target: "This session will run on <Target>. Start a new sandbox?"

## Core behaviors
- Each session is pinned to a single sandbox and target.
- Target changes always create a new session and sandbox by default.
- Sandboxes can be archived and deleted without affecting the base workspace.
- Local and remote sandboxes follow the same lifecycle and UI.

## Architecture overview
### Local target
1) Desktop starts openwrk and local OpenWork server (loopback).
2) openwrk creates a sandbox directory from the base workspace.
3) openwrk starts OpenCode for that sandbox and publishes a connection descriptor.
4) App runs the session using the descriptor and renders the sandbox state.

### Remote target
1) App connects to a remote OpenWork server (URL + token).
2) App requests a new sandbox on the remote target.
3) Remote openwrk creates the sandbox, starts OpenCode, and returns a descriptor.
4) App runs the session using the descriptor and renders the sandbox state.

## Dependencies
- Remote-first connection descriptor behavior (see `prds/remote-first-openwork.md`).
- openwrk orchestration changes to provision sandboxes and expose metadata.
- OpenWork server endpoints for sandbox lifecycle.

## Sandbox provisioning details
- Implementation choice is internal and hidden from the UI.
- Preferred strategy order:
  - Git worktree if base workspace is a git repo and clean.
  - Shallow clone if git repo but worktree is not viable.
  - Filtered copy if not a git repo.
- Sandboxes live under `.openwork/sandboxes/<sandbox-id>` for local targets.
- Each sandbox has its own `.opencode` state and OpenCode server instance.
- Ignore heavy caches on copy using `.openwork/sandbox-ignore` with fallbacks to `.gitignore`.

## Data model (conceptual)
- Target profile: `{ id, label, type: local|remote, baseUrl, tokenRef, lastUsedAt, status }`
- Sandbox: `{ id, name, targetId, baseWorkspaceId, path, createdAt, updatedAt, status, sizeBytes }`
- Session: `{ id, sandboxId, targetId, createdAt, updatedAt }`

## API surface (OpenWork server)
- `POST /sandboxes` -> create a new sandbox for a target profile.
- `GET /sandboxes` -> list sandboxes and their status.
- `GET /sandboxes/:id` -> sandbox detail (size, status, target, createdAt).
- `POST /sandboxes/:id/archive` -> archive a sandbox.
- `POST /sandboxes/:id/delete` -> delete a sandbox.
- `GET /connect/active` -> return descriptor for the active sandbox.

### Connection descriptor extension
Add sandbox and target metadata to the descriptor payload:
```
{
  "updatedAt": 1738540000000,
  "sandbox": {
    "id": "sbx-01",
    "name": "Pricing experiment",
    "path": "/Users/.../.openwork/sandboxes/sbx-01",
    "status": "active"
  },
  "target": {
    "id": "tgt-local",
    "label": "Local (this device)",
    "type": "local"
  },
  "opencode": {
    "baseUrl": "http://127.0.0.1:51142",
    "connectUrl": "http://127.0.0.1:51142",
    "directory": "/Users/.../.openwork/sandboxes/sbx-01",
    "username": "openwork",
    "password": "***",
    "port": 51142
  },
  "openwork": {
    "baseUrl": "http://127.0.0.1:51140",
    "connectUrl": "http://127.0.0.1:51140",
    "token": "client-token",
    "hostToken": "host-token",
    "port": 51140
  },
  "owpenbot": {
    "healthUrl": "http://127.0.0.1:58928",
    "healthPort": 58928
  }
}
```

## Storage and persistence
- Target profiles stored in app IndexedDB with tokens stored in OS keychain.
- Sandbox metadata stored in app IndexedDB; full state lives on the target.
- Local openwrk persists sandbox runtime state in-memory and can reconstruct from disk.

## Security and permissions
- Default to least-privilege permissions per sandbox.
- Always show a confirmation when selecting a remote target.
- For remote targets, display a clear indicator that files are remote-only.
- Do not persist raw tokens in plaintext files.

## Error states and recovery
- Remote unreachable: show target as "Offline" and prevent new sessions.
- Sandbox provision failed: show retry option and log reason.
- Target version mismatch: fall back to local and prompt to update remote.
- Local disk full: block sandbox creation and surface storage usage.

## Observability
- Events to log: target add/remove, sandbox create/archive/delete, target switch, provision failure.
- Add a debug view for sandbox path and target health.

## Performance expectations
- Local sandbox creation: under 2 seconds for typical repos (<200MB).
- Remote sandbox creation: under 5 seconds for healthy remotes.
- UI should never block input while provisioning; show progress state.

## Rollout plan
- Phase 1: Local target only, sandboxes behind feature flag.
- Phase 2: Remote target support for a small beta cohort.
- Phase 3: Default enable for all users.

## Test plan
- Local: create two sandboxes, confirm file isolation and independent OpenCode servers.
- Remote: add target, create sandbox, run a session, confirm execution on remote host.
- Mixed: run one local and one remote session concurrently.
- Migration: existing sessions map to a default local sandbox.
- Failure cases: offline target, insufficient permissions, sandbox creation error.

## Acceptance criteria
- Composer target selector exists and is wired to session creation.
- Each session is pinned to exactly one sandbox and target.
- UI never mentions worktrees; only sandboxes and targets.
- openwrk can provision and tear down sandboxes for local and remote targets.
- App connects to OpenCode only through the sandbox descriptor.
- Target management supports add, remove, rename, set default.

## Open questions
- What is the default retention policy for archived sandboxes?
- Do we allow sandbox creation from an arbitrary git ref or only the current state?
- How do we present storage usage and cleanup in the UI?
- Should we allow manual diff and export of sandbox changes?
