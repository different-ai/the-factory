---
title: OCX integration for profile-aware OpenCode management
description: Add optional OCX integration for profiles, config introspection, and component installs without changing remote mode behavior.
---

## Summary
OpenWork is an open-source alternative to Claude Cowork that is mobile-first, purpose-first, and premium for non-technical users (see `_repos/openwork/AGENTS.md`).
This PRD defines how OpenWork can integrate OCX for profile-aware OpenCode configuration, component installs, and registry management while preserving existing remote server flows.

## Problem statement
- Power users want profile-based OpenCode configuration and component management without manual file copying.
- OpenWork currently manages local skills/plugins via `.opencode/` and `opencode.jsonc`, but lacks a formal registry and profile layer.
- We need a safe, auditable integration that does not change the remote-only OpenWork server model.

## Goals
- Add optional OCX support for local/host mode only.
- Provide a profile picker and profile-aware OpenCode launch when OCX is present.
- Expose OCX component installs/updates via a UI that maps to OCX CLI commands.
- Keep remote/client mode on OpenWork server `/config` endpoints unchanged.
- Preserve OpenCode parity and avoid new abstractions beyond profiles and registries.

## Non-goals
- Replacing OpenCode config or `.opencode` conventions.
- Allowing OCX operations on remote targets.
- Building a new registry protocol or component format.

## Definitions
- OCX: A CLI that manages OpenCode profiles and installs components into `.opencode/`.
- Profile: A named configuration layer stored under `~/.config/opencode/profiles/<name>/`.
- Component: Skill/plugin/agent/command/tool packaged for `.opencode/` via OCX.

## Personas and jobs-to-be-done
- Power user: "Select a profile to run OpenCode with my preferred tools."
- Maintainer: "Install skills/plugins from a registry with a clear diff and audit trail."
- Team lead: "Keep configuration consistent across machines without manual copying."

## Experience principles
- OCX is optional and clearly labeled as a third-party tool.
- If OCX is missing, the UI should degrade gracefully.
- Every OCX write operation shows a preview/diff before applying.

## UX overview
### Settings: Profiles
- Show an OCX status banner if `ocx` is available.
- Provide a profile picker populated by `ocx profile list --json`.
- Show selected profile metadata from `ocx profile show --json`.
- Provide a "View merged config" action using `ocx config show --origin --json`.

### Settings: Components
- Add a "Registry" section with add/list/remove for registries.
- Add a "Components" section with install/update/remove actions.
- Require a diff preview (via `ocx diff`) before updates.

## Core behaviors
- When a profile is selected and OCX is present, launch OpenCode via `ocx oc`.
- If OCX is not present or profile is not selected, fall back to `opencode serve`.
- All OCX operations are local-only and blocked for remote targets.
- After OCX operations, refresh OpenWork's views from `.opencode/` and `opencode.jsonc`.

## Architecture overview
### Host mode with OCX
1) App detects OCX via PATH.
2) User selects an OCX profile.
3) Desktop starts OpenCode with `ocx oc -p <profile> -- serve ...`.
4) OpenWork continues to read `.opencode/` and OpenCode APIs as usual.

### Host mode without OCX
1) App does not detect OCX or no profile selected.
2) Desktop starts OpenCode with `opencode serve ...`.
3) Behavior is unchanged.

## Dependencies
- OpenWork host mode startup logic.
- OpenWork settings UI for profiles/components.
- OCX CLI availability on the system.

## CLI mappings
- List profiles: `ocx profile list --json`
- Show profile: `ocx profile show --json`
- Merged config: `ocx config show --origin --json`
- Install component: `ocx add <component>`
- Update component: `ocx update <component>`
- Diff component: `ocx diff <component>`
- Registry add/remove/list: `ocx registry add|remove|list --json`

## Security and permissions
- Explicit user confirmation before running OCX commands.
- Display origin information for merged config when requested.
- Label OCX as third-party and show version in settings.

## Observability
- Log OCX command invocations with outcome and duration.
- Track profile selection changes and component installs.

## Rollout plan
- Phase 1: Detection + profile picker (read-only).
- Phase 2: OCX-based OpenCode launch in host mode.
- Phase 3: Registry and component management.

## Test plan
- With OCX: profile list shows, profile selection launches OpenCode via `ocx oc`.
- Without OCX: host mode behavior unchanged.
- Component install/update flows populate `.opencode/` and reflect in UI.
- Remote target selected: OCX actions are disabled with clear messaging.

## Acceptance criteria
- Users can choose an OCX profile when OCX is installed.
- Host mode uses `ocx oc` when a profile is selected.
- OCX component installs/updates reflect in OpenWork UI.
- Remote mode remains unchanged and does not allow OCX operations.

## Open questions
- Do we support profile-scoped workspace include/exclude in the UI?
- Should we allow OCX to choose a custom OpenCode binary by default?
- What is the best place to surface OCX version and registry status?
