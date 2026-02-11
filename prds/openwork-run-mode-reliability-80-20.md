---
title: OpenWork run-mode reliability 80/20
description: Simplify runtime surfaces to one boring path (openwrk + openwork-server), remove non-product Agent Lab/Toy UI code, and harden health and reconnect behavior across local/remote flows.
---

## Summary
This PRD focuses on the 80/20 for reliability and consistency across run modes:

1. Remove non-core surfaces that are not wired to the real app (Agent Lab + Toy UI).
2. Make openwrk the canonical host runtime path.
3. Keep one edge contract (`openwork-server`) for local and remote clients.
4. Harden startup/readiness/reconnect checks so mode switches are predictable.

This follows the OpenWork principles in `AGENTS.md` and `_repos/openwork/AGENTS.md`:
- prefer OpenCode/OpenWork primitives over bespoke abstractions
- CLI-first + sidecar composability
- graceful degradation
- explicit approvals and auditable writes

## Why this is the 80/20
The highest-cost failures are startup drift, runtime mismatch, and reconnection edge-cases - not missing features.

Today we still have multiple runtime paths with different behavior:
- Desktop host path via `engine_start` (`_repos/openwork/packages/desktop/src-tauri/src/commands/engine.rs`)
- Detached sandbox path via `openwrk_start_detached` (`_repos/openwork/packages/desktop/src-tauri/src/commands/openwrk.rs`)
- Legacy direct runtime toggle in UI (`_repos/openwork/packages/app/src/app/pages/settings.tsx`)

Consolidating these paths removes entire classes of bugs:
- token drift across host restarts
- inconsistent health readiness expectations
- different behavior for workspace switching vs sandbox flow

## Research findings (exact mapping)

### 1) Runtime startup paths are split
- Desktop local host startup: `engine_start` in `_repos/openwork/packages/desktop/src-tauri/src/commands/engine.rs`
  - openwrk runtime branch starts router daemon via `spawn_openwrk_daemon`
  - also starts `openwork-server` + `owpenbot` via desktop lifecycle
- Detached sandbox flow: `openwrk_start_detached` in `_repos/openwork/packages/desktop/src-tauri/src/commands/openwrk.rs`
  - directly shells `openwrk start --detach --sandbox docker ...`
  - issues independent OpenWork tokens and port allocation
- App sandbox create flow uses detached path in `_repos/openwork/packages/app/src/app/context/workspace.ts` (`createSandboxFlow`)
- App normal host flow uses `engineStart(...)` in `_repos/openwork/packages/app/src/app/context/workspace.ts` (`startHost`)

Net: two host bootstraps with similar responsibilities but different ownership.

### 2) Health checks exist, but contracts are scattered
- openwrk startup health is in `_repos/openwork/packages/headless/src/cli.ts`
  - `waitForHealthy`
  - `waitForHealthyViaProxy`
  - `verifyOpenworkServer`
  - `waitForOpencodeHealthy`
- App-level connect health is in `_repos/openwork/packages/app/src/app/context/workspace.ts` (`connectToServer`, `testWorkspaceConnection`)
- Desktop runtime status snapshots are in:
  - `_repos/openwork/packages/desktop/src-tauri/src/openwrk/mod.rs`
  - `_repos/openwork/packages/desktop/src-tauri/src/openwork_server/manager.rs`

Net: readiness logic is robust but duplicated between CLI, desktop command layer, and app store.

### 3) Non-core server surfaces increased complexity
- Agent Lab endpoints were implemented in `_repos/openwork/packages/server/src/server.ts` under:
  - `/workspace/:id/agentlab/automations*`
- Toy UI static serving was implemented under:
  - `/ui`
  - `/w/:id/ui`
  - `/ui/assets/*`
- Toy UI implementation lived in `_repos/openwork/packages/server/src/toy-ui.ts`

These were not wired to core OpenWork app pages (`_repos/openwork/packages/app/src`), and created extra maintenance surface.

## Decision
Adopt a "single boring path" strategy:

- Host runtime: openwrk orchestrator is canonical.
- Edge API: openwork-server is canonical.
- Client mode: OpenWork app targets openwork-server (OpenCode behind `/opencode/*`).
- Legacy direct runtime remains as an escape hatch for now, but no longer a promoted mode.

## Scope

### In scope
1. Remove Agent Lab and Toy UI codepaths not linked to the real app.
2. Define and implement run-mode consistency changes for host startup and reconnect behavior.
3. Add explicit reliability checks focused on run-mode parity.

### Out of scope
1. Reintroducing Agent Lab as a product surface.
2. Multi-tenant/cloud control-plane redesign.
3. New UX feature work unrelated to reliability.

## Phase A (done in this branch): remove non-core surfaces

### Code removal
- Delete `packages/agent-lab` package:
  - `_repos/openwork/packages/agent-lab/package.json`
  - `_repos/openwork/packages/agent-lab/src/cli.ts`
  - `_repos/openwork/packages/agent-lab/README.md`
  - `_repos/openwork/packages/agent-lab/tsconfig.json`
- Remove Agent Lab routes and helpers from:
  - `_repos/openwork/packages/server/src/server.ts`
  - removed `/workspace/:id/agentlab/automations*` handlers
  - removed schedule parsing/id validation helpers used only by Agent Lab routes
- Remove Toy UI serving from server:
  - removed `/ui`, `/w/:id/ui`, `/ui/assets/*` routes from `_repos/openwork/packages/server/src/server.ts`
  - deleted `_repos/openwork/packages/server/src/toy-ui.ts`

### Docs cleanup
- Update `_repos/openwork/packages/server/README.md` to remove Toy UI endpoint docs.
- Update `_repos/openwork/packaging/docker/README.md` to use `/health` check instead of `/ui`.

## Phase B (next): run-mode reliability convergence

### B1) De-promote legacy direct runtime in UI
Goal: avoid user-facing split-brain runtime decisions.

Implementation map:
- `_repos/openwork/packages/app/src/app/pages/settings.tsx`
  - remove developer toggle that exposes Direct vs Openwrk runtime selection
- `_repos/openwork/packages/app/src/app/app.tsx`
  - migrate stored `openwork.engineRuntime=direct` to `openwrk` on load
  - continue persisting runtime for internal fallback, but default hard to `openwrk`
- `_repos/openwork/packages/app/src/app/context/workspace.ts`
  - simplify workspace switch/reload branches to prefer openwrk-only branch paths

Expected outcome:
- one runtime behavior for local host in real app usage
- fewer restart/reconnect branching bugs

### B2) Unify host bootstrap ownership
Goal: local host startup and sandbox startup should present one consistent contract to the app.

Implementation map:
- `_repos/openwork/packages/desktop/src-tauri/src/commands/engine.rs`
- `_repos/openwork/packages/desktop/src-tauri/src/commands/openwrk.rs`
- `_repos/openwork/packages/app/src/app/context/workspace.ts`

Design:
- keep one canonical bootstrap command path for app-driven host sessions
- keep detached startup as an explicit operational path, not a separate product flow semantics
- ensure token and workspace registration behavior are consistent regardless of sandbox backend

Expected outcome:
- no user-visible differences between "host started" states except sandbox capability metadata

### B3) Consolidate health/readiness contract
Goal: one explicit readiness contract for all modes.

Implementation map:
- `_repos/openwork/packages/headless/src/cli.ts` (reference implementation)
- `_repos/openwork/packages/app/src/app/context/workspace.ts` (client-side checks)
- `_repos/openwork/packages/desktop/src-tauri/src/openwrk/mod.rs` (runtime status snapshots)

Contract checks:
1. edge alive: `GET /health` on openwork-server
2. edge diagnostics: `GET /status`
3. engine proxy alive: `GET /opencode/health` via edge when in remote/openwork mode
4. workspace identity stable: `GET /workspaces` and active workspace resolution

Expected outcome:
- predictable "connected / limited / disconnected" transitions
- fewer false-positive connected states during startup races

### B4) Add reliability regression matrix
Goal: catch run-mode regressions early.

Implementation map:
- extend existing scripted checks in `_repos/openwork/packages/app/scripts`
- add explicit run-mode matrix script (local openwrk, remote openwork edge, workspace switch)
- keep checks CLI-friendly and JSON-output for automation

Acceptance for matrix:
- startup succeeds with stable health in each mode
- workspace switch does not lose session visibility
- reconnect after host restart resolves to correct workspace directory

## Acceptance criteria
1. No Agent Lab package or API routes remain in `_repos/openwork`.
2. No Toy UI endpoints remain in openwork-server.
3. Core app flows (onboarding host start, remote connect, local workspace switch) still work.
4. Openwork-server build/typecheck passes.
5. Reliability PRD and mapping are committed in `prds/`.

## Risk notes
- Removing legacy surfaces may break private scripts that called removed endpoints.
  - mitigation: document removal in changelog/release notes.
- Runtime convergence could expose hidden assumptions in direct-mode code.
  - mitigation: keep direct path behind internal fallback until matrix is green.

## Rollout recommendation
1. Land Phase A cleanup (this branch).
2. Land runtime de-promotion + migration in one PR.
3. Land health/readiness contract + matrix tests in next PR.
4. After stable period, fully remove direct runtime branching from app stores.

## Operator notes
- Existing OpenWork clients should connect to openwork-server URL and token; `/ui` is removed.
- Use `/health` and `/status` for edge diagnostics.
