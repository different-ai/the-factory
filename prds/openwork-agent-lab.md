---
title: OpenWork Agent Lab (toy app): character-first agents, sandboxed runs, and multi-instance hosting
description: A new OpenWork package and Toy UI that experiments with an agent-as-character model (skills/plugins/folders/scheduler/bot) while reusing openwrk + openwork-server + owpenbot + opencode primitives. Optimized for local container safety and cloud portability.
---

## Summary
OpenWork is an open-source alternative to Claude Cowork (see `_repos/openwork/AGENTS.md`). OpenCode is the engine; OpenWork is the experience layer (see `_repos/openwork/VISION.md`).

This PRD proposes **Agent Lab**: a new, intentionally small OpenWork package that lets us experiment aggressively with "workspace becomes agent" while staying grounded in existing infrastructure:

- **Character-first UX**: users create and grow an **agent character** (avatar + name) whose real substance is: skills, plugins, folders (entrypoints), scheduler, and optional bot surfaces.
- **Safe execution by default**: every agent run is executed inside a local container boundary using `openwrk --sandbox ...` (see `_repos/openwork/packages/headless/README.md`).
- **Cloud-ready by design**: the same "agent host" can run on another machine or in the cloud; clients connect through `openwork-server`'s host contract (see `_repos/openwork/packages/server/README.md` and `prds/openwork-minimal-containerization.md`).
- **Multi-instance**: you can run multiple independent Agent Lab hosts simultaneously (like multiple Chrome windows), by isolating config + ports + data directories.

MVP scope: **one character per Agent Lab host** (one agent). Later: multiple characters per host.

## Why now
OpenWork is already powerful, but the "workspace" abstraction drifts from how many users think about delegation:

- Users want "a helper" with a personality and a safety boundary.
- Safety needs to be physical (OS isolation) first, not only prompt/permission policy.
- We need a sandboxed experimentation harness that does not destabilize the main Tauri app.

Agent Lab is a controlled environment to prototype:

- agent-as-product object model
- packaging/sharing of agent configurations
- schedulable, repeatable automation
- multi-instance hosting

All while maintaining OpenWork principles:

- **Prefer OpenCode primitives** (skills/plugins/commands/MCP, `.opencode`, `opencode.json`) (see `_repos/openwork/AGENTS.md`, `_repos/openwork/PRINCIPLES.md`).
- **CLI-first + sidecar-composable** (see `_repos/openwork/INFRASTRUCTURE.md`).

## Target users (Agent Lab)
Grounded in OpenWork's target users (see `_repos/openwork/PRODUCT.md`):

- **Bob (power user / IT)**: wants to compose agents, constrain access, and share setups.
- **Internal OpenWork team**: needs a fast harness to validate new host-contract and agent-management ideas.

Non-goal for MVP: fully polished "Susan in accounting" onboarding. (We still keep defaults safe and understandable.)

## Goals
- Ship a new package inside `_repos/openwork/packages/` that provides an **Agent Lab host** with:
  - character (avatar) + agent config
  - sandboxed execution
  - agent-scoped skills/plugins/folders
  - scheduler primitives (recurring runs)
  - optional owpenbot integration
- Reuse as much as possible from: `openwrk`, `openwork-server`, `owpenbot`, `opencode`, and existing host contract endpoints.
- Make it possible to run **N Agent Lab instances** on one machine simultaneously without conflicts.
- Keep rollback cheap: experiments should be removable without affecting the main OpenWork app.

## Non-goals
- Replacing the main OpenWork desktop/mobile UI.
- Building a multi-tenant hosted SaaS control plane (billing/orgs/SSO).
- Inventing new capability systems that bypass OpenCode (no bespoke plugin system).
- Perfect hermetic builds; this is sandboxing + scoping, not Nix.

## Core concepts

### 1) Agent character
An "agent" is a first-class object. The character is the UX representation.

Agent = {
- `id`, `name`
- `avatar`: deterministic SVG generated from `avatarSeed` (no image uploads required)
- `entrypoints`: allowlisted folders the agent can see (mounted into sandbox)
- `skills`: `.opencode/skills/*` installed into agent home
- `plugins`: `opencode.json` plugin list
- `scheduler`: recurring jobs targeting this agent
- `bot`: optional owpenbot channels and policies
- `runtime`: local sandbox backend + image + resource limits
}

MVP constraint: a single agent per Agent Lab host.

### 2) Agent home directory (portable)
Each agent gets a dedicated home directory that contains its OpenCode-native configuration:

- `.opencode/skills/*`
- `.opencode/commands/*` (optional)
- `opencode.json` (plugins/MCP/providers)

This makes agents exportable/importable using existing OpenWork server surfaces (`/workspace/:id/export` + `/import`).

### 3) Sandbox boundary
Agent Lab runs the entire host stack inside a Linux container boundary (preferred):

- `opencode` engine
- `openwork-server` edge/control plane
- optional `owpenbot`

We reuse `openwrk start --sandbox auto|docker|container` as the orchestrator.

Key safety idea: the agent can only access:

- mounted agent home
- mounted entrypoints (read-only by default)
- mounted persist dir for caches/state (explicit)

### 4) Agent scheduler
An agent's scheduler is a way to run prompts "later" and "repeatedly".

Implementation path (reuse-first):

- Reuse `opencode-scheduler` plugin (`_repos/opencode-scheduler`) for OS-native scheduling.
- Store schedules as explicit JSON and/or via scheduler job APIs.

MVP scheduler requirements:

- list jobs
- create/update/delete job
- manual run now
- view logs

### 5) Multi-instance hosting
An "app instance" is not a singleton desktop app. It is a host stack with its own:

- ports
- tokens
- config dir
- persistent data dir

We should support multiple running Agent Lab hosts on one machine.

## Product requirements (MVP)

### Onboarding
- First launch auto-creates:
  - one agent character
  - one agent home directory
  - a default sandbox image selection
- User chooses:
  - a small set of entrypoints (folders) for the agent
  - whether entrypoints are mounted `ro` or `rw` (default `ro`)

### Agent management
- View agent profile:
  - avatar, name
  - entrypoints
  - installed skills
  - enabled plugins
  - scheduler jobs
  - bot status
- Rename agent.
- Export agent (portable bundle).
- Import agent bundle (optional in MVP, recommended early).

### Running tasks
- Compose a prompt and run it.
- See streaming output and a minimal step timeline (reuse Toy UI patterns).
- List artifacts/outbox and download.

### Skills
- List installed skills.
- Install skill packages via OpenPackage (`opkg install ...`) (reuse existing OpenWork skill manager logic, but keep UX minimal).
- Remove a skill.

### Plugins
- List enabled plugins.
- Enable/disable plugin by editing `opencode.json`.

### Scheduler
- Create a recurring job for the agent (daily/weekly/cron).
- Run job now.
- View job logs.

### Bot (optional MVP)
- Show owpenbot health/status.
- Provide a "connect surface" stub (even if onboarding is deferred).

## UX direction (Agent Lab)
Agent Lab is "small but premium":

- Character card as the primary navigation anchor.
- Minimal surface area, capability-driven gating.
- Visual safety signals:
  - "Sandbox ON" badge (backend: docker/container)
  - "Entry points: 3 (2 read-only, 1 read-write)"
  - "Bot: disabled"

Avatar direction:

- Deterministic SVG generated from `agentId` or `avatarSeed`.
- Use a constrained palette and a few shape grammars (e.g., blob + eyes, geometric quilt, pixel glyph).
- No external assets required; SVG is computed client-side.

## Technical architecture (reuse map)

### What we reuse (existing)

- `_repos/openwork/packages/headless` (`openwrk`)
  - sandbox mode (`--sandbox auto|docker|container`)
  - sidecar resolution + caching
  - multi-workspace daemon (useful later)
- `_repos/openwork/packages/server` (`openwork-server`)
  - host contract endpoints (`/health`, `/capabilities`, `/workspaces`, `/workspace/:id/*`)
  - approvals + token scopes
  - `/opencode/*` proxy and workspace scoping via `x-opencode-directory`
  - inbox/outbox + artifacts
  - serves a Toy UI today (`/ui`, `/w/:id/ui`) we can evolve
- `_repos/openwork/packages/owpenbot` (`owpenwork`)
  - Slack/WhatsApp/Telegram bridge
  - proxied under `openwork-server` (`/owpenbot/*`)
- `_repos/opencode`
  - core agent runtime, skills, plugins, commands, MCP
- `_repos/opencode-scheduler`
  - OS-native scheduling, storage + logs, and a stable management surface

### What we add (new)

#### A) New OpenWork package
Add a new package inside `_repos/openwork/packages/`:

- Suggested name: `packages/agent-lab`
- Responsibilities:
  - "Agent Lab host" CLI (`openwork-agent-lab` or similar)
  - instance isolation (ports + config dirs)
  - agent home provisioning
  - entrypoint selection + mount policy
  - orchestrate `openwrk` (or embed/compose its library surface if feasible)

This package should be CLI-first (aligns with `_repos/openwork/INFRASTRUCTURE.md`).

#### B) Agent Lab UI (served by openwork-server)
Evolve Toy UI into a real experimentation UI:

- Option 1 (recommended): build static assets from `packages/agent-lab-ui` and have `openwork-server` serve versioned assets.
- Option 2 (fastest): keep embedding JS/CSS strings in `openwork-server` for now.

Recommendation: start with Option 2 to move quickly, then migrate to Option 1 once flows stabilize.

#### C) Agent model + persistence
We need a storage location for "agent" metadata that is not the workspace directory itself.

- Store in the OpenWork server config dir (same persistence boundary as tokens), e.g. `~/.config/openwork/agent-lab/agents.json`.
- Never mount this policy store into the sandbox.

#### D) Mount policy enforcement
Reuse the existing `openwrk` mount allowlist strategy:

- allowlist file outside the workspace: `~/.config/openwork/sandbox-mount-allowlist.json` (already used by openwrk)
- deny obvious secret-bearing paths by default (`~/.ssh`, `~/.aws`, `.env`, etc.)
- resolve symlinks before allowing mounts

## Agent <-> OpenWork mapping (compatibility strategy)
We want to reuse existing host contract shapes that talk about "workspaces".

Recommended mapping:

- Agent Lab host continues to expose "workspaces" at the API level.
- Each agent corresponds to one OpenWork workspace id.
- UI renames "workspace" to "agent" everywhere.

This keeps compatibility with:

- existing `openwork-server` endpoints
- existing clients that understand workspaces

Later: introduce explicit `agents` endpoints as an additive layer once the model stabilizes.

## Instance isolation (multi-instance)
To support multiple Agent Lab hosts concurrently, every instance must be configurable via flags/env:

- `openwork-server`:
  - `--port` / `OPENWORK_PORT`
  - `--config` / `OPENWORK_SERVER_CONFIG`
  - token store location (`OPENWORK_TOKEN_STORE`)
- `openwrk`:
  - `--data-dir` / `OPENWRK_DATA_DIR` (router state isolation)
  - `--sidecar-dir` (sidecar cache isolation if needed)

Agent Lab package should:

- allocate a free port range per instance
- create an instance directory: `~/.openwork/agent-lab/instances/<instanceId>/`
- write config files inside that directory
- print a stable connect artifact (`openwork.connect.v1`) for sharing

## Cloud / remote story
Agent Lab is "local-first, cloud-ready" by reuse:

- Local: run `openwrk start --sandbox auto` on your machine.
- Remote: run the same command on a server; connect via the edge URL (`openwork-server`).
- Sharing: use `/w/<id>/ui` and connect artifacts for quick browser usage.

This inherits the OpenWork Host contract described in `prds/openwork-minimal-containerization.md`.

## Security posture
Defense in depth:

1) OS isolation boundary (container/VM sandbox) shrinks blast radius.
2) OpenWork server approvals for writes (host token / owner scope) remain the remote-safe boundary.
3) OpenCode permissions still gate tool-level requests.

Defaults:

- entrypoints mounted read-only
- network allowed but capability-advertised (future: domain allowlists)
- owpenbot disabled unless explicitly enabled

## Milestones

### Phase 0: PRD + capability map (this document)
- confirm reuse plan and compatibility mapping

### Phase 1: Single-agent host + UI
- new package scaffold
- run one agent in sandbox via openwrk
- UI: character card + run prompt + stream output

### Phase 2: Skills/plugins/folders management
- entrypoint selection persisted and enforced via mounts
- minimal skills install/remove
- plugin enable/disable

### Phase 3: Scheduler
- integrate opencode-scheduler for job CRUD and logs
- UI: create/run/list jobs

### Phase 4: Bot integration
- expose owpenbot status and minimal onboarding surfaces

### Phase 5: Multi-agent (multi-character) per host
- add agent list, switching, and isolation

## Success metrics
- < 5 minutes from "start host" to first successful sandboxed task.
- Clear visibility that sandboxing is on and what folders are mounted.
- Can run 2+ Agent Lab instances simultaneously without port/config conflicts.

## Open questions
- Should "entrypoints" be modeled as mounts only (sandbox-first), or also as OpenWork-authorized roots (non-sandbox parity)?
- Scheduler placement: OS scheduler (host) vs inside sandbox vs in openwork-server.
- How should we represent model/provider config per agent (inherit global vs agent-scoped `opencode.json`)?
- Do we want per-agent owpenbot instances, or one owpenbot that routes by agent/workspace?
- What is the minimal avatar grammar that feels "alive" without adding a new asset pipeline?

## Appendix: explicit reuse checklist
- `openwrk --sandbox auto` is the default execution boundary.
- `openwork-server` remains the single public edge (proxying `/opencode/*` and `/owpenbot/*`).
- Agents are OpenCode-native configs (`.opencode`, `opencode.json`) with minimal extra metadata.
- Scheduler reuses `opencode-scheduler` (OS-native) where possible.
