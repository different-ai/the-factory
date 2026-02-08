---
title: OpenWork Agent Lab (toy app): character-first agents, sandboxed runs, and multi-instance hosting
description: A new OpenWork package and Toy UI that experiments with an agent-as-character model (skills/plugins/folders/scheduler/bot) while reusing openwrk + openwork-server + owpenbot + opencode primitives. Optimized for local container safety and cloud portability.
---

## Summary
OpenWork is an open-source alternative to Claude Cowork (see `_repos/openwork/AGENTS.md`). OpenCode is the engine; OpenWork is the experience layer (see `_repos/openwork/VISION.md`).

This PRD proposes **Agent Lab**: a new, intentionally small OpenWork package that lets us experiment aggressively with "workspace becomes agent" while staying grounded in existing infrastructure:

- **Character-first UX**: users create and grow an **agent character** (avatar + name) whose real substance is: skills, plugins, folders (entrypoints), scheduler, and optional bot surfaces.
- **Conversation-first configuration**: most creation happens iteratively in chat (do task -> "make that a skill" -> schedule/share). Buttons are primarily for inspection, sharing, and cleanup.
- **Safe execution by default**: every agent run is executed inside a local container boundary using `openwrk --sandbox ...` (see `_repos/openwork/packages/headless/README.md`).
- **Cloud-ready by design**: the same "agent host" can run on another machine or in the cloud; clients connect through `openwork-server`'s host contract (see `_repos/openwork/packages/server/README.md` and `prds/openwork-minimal-containerization.md`).
- **Multi-instance**: you can run multiple independent Agent Lab hosts simultaneously (like multiple Chrome windows), by isolating config + ports + data directories.
- **Mac-first**: MVP can be macOS-only (desktop app + launchd scheduling), with portability as an explicit follow-up.

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
- (MVP) macOS-only is acceptable if it accelerates iteration.

## Non-goals
- Replacing the main OpenWork desktop/mobile UI.
- Building a multi-tenant hosted SaaS control plane (billing/orgs/SSO).
- Inventing new capability systems that bypass OpenCode (no bespoke plugin system).
- Perfect hermetic builds; this is sandboxing + scoping, not Nix.
- Full cross-platform support in v1 (Windows/Linux can follow once the model is proven).

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

Entrypoints are the user-facing name for these mounts: "folders this agent can see". They should feel like volumes: explicit, inspectable, and revocable.

### 4) Agent scheduler
An agent's scheduler is a way to run prompts "later" and "repeatedly".

Implementation path (Mac-only MVP, sandbox-compatible):

- Use macOS launchd directly from the Agent Lab instance manager to schedule jobs.
- Each job triggers runs by calling the existing edge API (`openwork-server`) for that instance.
- Store schedules as explicit JSON alongside instance state.

Follow-up (if/when we relax sandbox constraints):

- Reuse `opencode-scheduler` plugin (`_repos/opencode-scheduler`) for OS-native scheduling + logs.

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

### 6) Multiple agents are permission boundaries
The primary reason to create multiple agents is not specialization. It is separation:

- different folder access (entrypoints)
- different share audiences (team vs personal vs one-off share)
- different bot surfaces/identities (Slack/WhatsApp/Telegram)

Users can still have a "mega agent" locally; Agent Lab makes it easy to spin off a restricted agent for sharing.

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
- The agent responds quickly with a short checkpoint before starting heavy work.
- List artifacts/outbox and download.

### Skills
- List installed skills.
- Install skill packages via OpenPackage (`opkg install ...`) (reuse existing OpenWork skill manager logic, but keep UX minimal).
- Remove a skill.
- Conversation-driven creation: after a successful run, the user can say "turn this into a skill" and the agent writes `.opencode/skills/<name>/SKILL.md`.
- Reuse across agents: user can bring an existing skill into a new agent (via `opkg install`, export/import, or a host-side skill library later).

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

### Sharing
- Share is a first-class action on the agent:
  - show a workspace URL (`/w/<id>`) and connect artifact (`openwork.connect.v1`)
  - mint scoped tokens (`viewer`/`collaborator`/`owner`) via `openwork-server` token APIs
- Export/import remains the "portable bundle" fallback for offline sharing.

Shareability note: sharing is orthogonal to "local vs cloud". The UX is the same - only the base URL changes (localhost, LAN, or a hosted URL). Agent Lab should include a "Deploy (Beta)" affordance in the share sheet even if it is a stub in MVP.

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

## Conversation-first creation loop
Most of the agent is built through talk -> do -> refine. The UI's job is to make this feel safe, legible, and shareable.

### The core loop
1) User asks the agent to do a task (example: "add subtitles to this video")
2) Agent executes, showing checkpoints and steps
3) User says: "Create a skill for this"
4) Agent triggers a skill-creation flow (the "skill creator") and writes a new skill into the agent home:
   - `.opencode/skills/<skill-name>/SKILL.md`
5) (Optional) User says: "Schedule this daily" or "Share this with my team"
6) Agent Lab updates the agent's fabric (skills/plugins/folders/scheduler/tokens)

### What the UI should optimize for
- Text-first configuration: the default way to add things is to ask, not to click through wizards.
- Buttons are for:
  - inspecting current setup (skills/plugins/apps/folders)
  - deleting/revoking things (remove skill, disable plugin, revoke token)
  - sharing (generate links/tokens/exports)

### Personality (agent as a co-worker)
Agent Lab should support a per-agent personality that is:

- explicit and editable
- stored inside the agent home so it travels with exports
- applied consistently to all runs

Proposed storage:

- `workspace/.opencode/agent/personality.md` (simple, inspectable)

The UI can show the personality as read-only by default, with edits performed via conversation ("make your tone more serious", "be concise", etc.).

Default personality direction (MVP): calm, serious, and professional. Avoid overly cute banter; be direct and transparent about what is happening.

### Checkpoints and progress (make waiting feel good)
The agent should never feel silent.

Behavior targets:

- First response (ack + what it's doing next) within ~500ms.
- Before long operations, emit a checkpoint message ("Starting transcription, this may take 3-5 minutes") then run the tool call.
- Use the step timeline as the truth source for progress (tool start/end + elapsed time).
- If a task is likely to take a long time, break it into a quick preflight tool call followed by the heavy tool call so the user sees immediate progress.

## Mock designs (Mac-only)
This PRD includes a static UI mock of the Agent Lab window. It is intentionally not tied to the current OpenWork frontend stack (SolidJS) - it exists to lock in interaction and hierarchy ideas.

- Mock source: `prds/mocks/agent-lab-window.mock.tsx`

What the mock is trying to prove:

- Agent as a "character card" (avatar + name) is the primary navigation anchor.
- Inside an agent:
  - left: task sessions
  - center: chat + step timeline
  - right: agent surfaces (Share / Automations / Skills / Plugins / Apps / Config)
- Automations feel like first-class objects (not buried in settings).
- The UI can show safety posture without jargon (Sandbox on/off, folder access, bot status).

Notes:

- This is a mock, not a spec for React or Inter.
- The real product should still use the OpenWork host contract as the only backend surface.

## Architecture deep dive (Mac-only MVP)

### Core boundary: one edge URL
Agent Lab should reuse the existing OpenWork Host contract (see `prds/openwork-minimal-containerization.md`), with `openwork-server` as the only public surface.

High-level:

```
Agent Lab UI (macOS)
  -> openwork-server (edge, port per instance)
      -> /w/:id/opencode/*  -> opencode (engine)
      -> /w/:id/owpenbot/*  -> owpenbot (connectors, optional)

Agent Lab Instance Manager (new package)
  -> spawns openwrk (supervisor)
      -> sandbox backend (docker|container) runs opencode + openwork-server + owpenbot
```

In sandbox mode, `openwork-server` proxies OpenCode and is the "base URL" for clients. This matches how `openwrk` already computes `opencodeBaseUrl` in sandbox mode.

### What is an "Agent Lab instance"
To support "multiple apps" on one Mac, we define an instance as:

- 1x `openwrk start --detach ...` process (or a long-lived container + detached openwrk session)
- 1x openwork-server port (unique)
- 1x instance data directory (unique)
- 1x agent home directory (workspace) (unique)

The UI can either:

- run as a separate desktop app process per instance (closest to "multiple Chrome instances"), or
- run as one app with multiple windows (one per instance).

### Instance directory layout (proposed)
The instance manager owns a directory per instance and treats it as the source of truth.

Example:

```
~/.openwork/agent-lab/instances/<instanceId>/
  agent.json                 # character metadata (name, avatarSeed, mounts)
  connect.json                # last connect artifact (openwork.connect.v1)
  openwrk-data/               # --data-dir (router + sandbox state)
  sidecars/                   # optional --sidecar-dir (cache)
  sandbox-persist/            # optional --sandbox-persist-dir (cache mounted into sandbox)
  workspace/                  # agent home (this is the openwork "workspace" path)
    opencode.json
    .opencode/
      skills/
      commands/
      openwork/
        inbox/
        outbox/
```

Why this matters:

- Multi-instance becomes mechanical: unique dir -> unique ports -> no collisions.
- Export/import is easy: the instance manager can bundle `agent.json` + `workspace/`.
- Nothing relies on hidden global state.

### How we reuse `openwrk` (exact flags)
The new package should treat `openwrk` as the supervisor and keep the glue thin.

Mac-only MVP start command shape (illustrative):

```bash
openwrk start \
  --detach \
  --sandbox auto \
  --workspace "$INSTANCE_DIR/workspace" \
  --data-dir "$INSTANCE_DIR/openwrk-data" \
  --sidecar-dir "$INSTANCE_DIR/sidecars" \
  --sandbox-persist-dir "$INSTANCE_DIR/sandbox-persist" \
  --openwork-port "$OPENWORK_PORT" \
  --approval manual
```

Notes:

- `--openwork-port` is the primary multi-instance knob.
- In sandbox mode, opencode is expected to be accessed through `openwork-server` proxy (no extra opencode port needed).
- `--approval manual` is safer by default; local dev can flip to `auto`.

### How we reuse `openwork-server` (exact endpoints)
Agent Lab should not invent a new backend. Use `openwork-server` endpoints and rename concepts in UI.

Core endpoints Agent Lab UI should rely on:

- Host:
  - `GET /health`
  - `GET /capabilities`
  - `GET /whoami`
  - `GET /workspaces`
- Run prompts (proxy):
  - `POST /w/:id/opencode/session`
  - `POST /w/:id/opencode/session/:sessionId/prompt_async`
  - `GET /w/:id/opencode/event`
  - `GET /w/:id/opencode/session/:sessionId/message`
- Agent config surfaces:
  - `GET /workspace/:id/skills`
  - `POST /workspace/:id/skills`
  - `GET /workspace/:id/plugins`
  - `POST /workspace/:id/plugins`
  - `DELETE /workspace/:id/plugins/:name`
  - `GET /workspace/:id/mcp`
  - `POST /workspace/:id/mcp`
  - `DELETE /workspace/:id/mcp/:name`
  - `GET /workspace/:id/commands`
  - `POST /workspace/:id/commands`
  - `DELETE /workspace/:id/commands/:name`
- File injection + outputs:
  - `POST /workspace/:id/inbox`
  - `GET /workspace/:id/artifacts`
  - `GET /workspace/:id/artifacts/:artifactId`

Token management endpoints that Agent Lab can reuse for sharing:

- `POST /tokens` (mint viewer/collaborator/owner tokens)
- `GET /tokens`
- `DELETE /tokens/:id`

This is already exercised by the existing Toy UI in `_repos/openwork/packages/server/src/toy-ui.ts`.

Known gaps to call out explicitly:

- Skills uninstall: `openwork-server` exposes list/install (`GET/POST /workspace/:id/skills`), but not an uninstall endpoint today. Agent Lab MVP can either:
  - add `DELETE /workspace/:id/skills/:name` to openwork-server, or
  - treat uninstall as a local-only filesystem action (less ideal for web parity).

### Conversation-first configuration pipeline
Agent Lab should treat chat as the primary configuration surface.

How it works end-to-end:

1) UI sends a user prompt to OpenCode (`/w/:id/opencode/session/:sessionId/prompt_async`).
2) OpenCode responds with message parts + tool calls.
3) When the user asks "turn this into a skill", the agent writes:
   - `.opencode/skills/<skill-name>/SKILL.md`
   - optional supporting files (templates, examples)
4) `openwork-server` detects `.opencode/` changes and publishes a reload event (`GET /workspace/:id/events`).
5) UI refreshes Skills/Plugins/Commands views and shows a "Reloaded" checkpoint.

The important property: configuration is produced by the agent using OpenCode primitives (files + prompts), not by bespoke UI forms.

### Approvals and permissions (do not let collaborators self-approve)
Agent Lab needs two layers of safety:

- openwork-server approvals (host/owner token) for writes through its own endpoints (skills/plugins/mcp/commands).
- OpenCode permission prompts for tool calls (file writes, bash, etc).

If a collaborator token can call OpenCode permission reply endpoints through the `/opencode/*` proxy, they can effectively self-approve writes.

MVP requirement:

- openwork-server must enforce scope rules for proxied OpenCode permission replies:
  - `viewer`: read-only (already enforced)
  - `collaborator`: can run prompts, but cannot reply to permission requests
  - `owner`: can reply to permission requests

This keeps conversation-first configuration safe when the agent is shared.

### Folder access model (authorized roots + sandbox mounts)
Folder access is a first-class part of the agent identity.

- openwork-server already supports `authorizedRoots` (server config) to constrain which workspace roots are allowed.
- openwrk sandbox mode physically enforces access by only mounting approved paths into the container.

Agent Lab should:

- store entrypoints in `agent.json` (path + ro/rw)
- materialize entrypoints as sandbox mounts (`openwrk --sandbox-mount ...`) where possible
- treat mount changes as requiring a sandbox restart (explicit UI checkpoint)

### Scheduler (Mac-only MVP)
Scheduler is a core "agent" feature, but sandbox mode complicates reuse of OS-native schedulers:

- `opencode-scheduler` (plugin) relies on host OS schedulers (launchd/systemd).
- In sandbox mode, OpenCode runs inside Linux userland, so it cannot reliably register host launchd jobs.

MVP proposal (Mac-only, reuse-first):

- Implement a thin scheduler in the Agent Lab instance manager that uses launchd directly.
- Each scheduled job runs a small script that calls the existing edge API (`openwork-server`) to trigger a prompt.
- Store job definitions alongside instance state (not in the workspace).

Concrete macOS mechanics (proposed):

- launchd plists live at `~/Library/LaunchAgents/`.
- labels follow a stable pattern, e.g. `com.openwork.agentlab.<instanceId>.<jobId>`.
- the job executes a tiny wrapper script that reads instance state (edge URL + token) and triggers the run.

Illustrative wrapper script shape:

```bash
#!/usr/bin/env bash
set -euo pipefail

OPENWORK_URL="http://127.0.0.1:<openworkPort>"
WORKSPACE_ID="<workspaceId>"
TOKEN="<ownerOrCollaboratorToken>"

curl -fsS \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -X POST "${OPENWORK_URL}/w/${WORKSPACE_ID}/opencode/session" \
  -d '{"title":"Scheduled run"}'

# Follow-up: prompt_async on the created session id.
```

Follow-up (once we decide the long-term model):

- Either run OpenCode on host (no sandbox) when `opencode-scheduler` is enabled, or
- extend `openwrk` to offer a host-side scheduler adapter that still executes runs inside sandbox.

### Bot surfaces (owpenbot)
Reuse owpenbot exactly as OpenWork does today:

- owpenbot runs as a sidecar (inside sandbox when sandbox is enabled)
- openwork-server proxies it under `/owpenbot/*`

Agent Lab UI only talks to the edge server.

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
  - OS-native scheduling, storage + logs, and a stable management surface (follow-up; sandbox caveat)

### Reuse matrix (feature -> component -> interface)

| Agent Lab feature | Reuse component | Interface we use | Notes |
| --- | --- | --- | --- |
| Run a task (prompt) | OpenCode | `/w/:id/opencode/session/*` | Sessions + streaming are the core primitive |
| Stream updates | OpenCode | `/w/:id/opencode/event` (SSE) | Reuse the existing event model |
| Skills list/install | openwork-server | `/workspace/:id/skills` | Uninstall may require a new endpoint |
| Plugins CRUD | openwork-server | `/workspace/:id/plugins` + `opencode.json` | Treat plugin list as OpenCode-native |
| MCP CRUD | openwork-server | `/workspace/:id/mcp` | OAuth flow stays external to Agent Lab |
| Commands CRUD | openwork-server | `/workspace/:id/commands` | Optional for v1 |
| File injection | openwork-server | `/workspace/:id/inbox` | Uploads land in `.opencode/openwork/inbox/` |
| Outputs/artifacts | openwork-server | `/workspace/:id/artifacts/*` | Downloads read from outbox/artifacts |
| Sandbox execution | openwrk | `openwrk start --sandbox ...` | Container boundary encloses the stack |
| Extra mounts | openwrk | `--sandbox-mount` + allowlist | Physical enforcement of entrypoints |
| Bot surfaces | owpenbot | `/owpenbot/*` proxy via openwork-server | Single edge URL |
| Scheduling | (MVP) instance manager | launchd plists + curl | `opencode-scheduler` is a follow-up due to sandbox |

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
4) Proxy scope gating: collaborators must not be able to reply to OpenCode permission prompts via `/opencode/*`.

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
- integrate macOS launchd scheduling (instance manager)
- UI: create/run/list jobs + view last run + show logs link
- follow-up: adopt `opencode-scheduler` where sandbox boundaries allow

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
- Scheduler uses macOS launchd in MVP; `opencode-scheduler` is a follow-up if we run OpenCode outside sandbox or add a host-side adapter.
