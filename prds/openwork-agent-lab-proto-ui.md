---
title: OpenWork Agent Lab Proto UI (Workers): create, share, deploy
description: A mock-inspired proto UI that makes Agent Lab feel like a real product. Introduces the "worker" abstraction (renamed from workspace in the UI), keeps sharing identical (connect artifacts + scoped tokens), and adds multi-folder entrypoints.
---

## Summary
OpenWork is an open-source alternative to Claude Cowork (see `_repos/openwork/AGENTS.md`). Agent Lab is our controlled harness for experimenting with agent-as-character + sandboxed runs + sharing, while reusing `openwrk` + `openwork-server` + `opencode`.

This PRD focuses on one thing: **a proto UI** that feels close to `prds/mocks/agent-lab-window.mock.tsx` so we can evaluate the workflow:

1. create agent
2. share agents
3. deploy agents

Key UI changes:

- **Workspaces -> Workers** (UI naming only): users think in terms of “a worker” (an agent) rather than a workspace.
- **Sharing stays exactly the same** for now: `openwork.connect.v1` JSON + scoped tokens.
- **Multi-folder support**: a worker can have multiple folder entrypoints, each `ro`/`rw`.
- **Identity is first-class**: Slack/Telegram/WhatsApp move into an `Identities` pane, and identities can be used both inbound and outbound.

This is intentionally a prototype. It can be implemented as a fast, server-served UI or as an app route later. The goal is to test product feel with real backend calls.

Implementation stance (updated)
- Primary: integrate into the main OpenWork web app (`_repos/openwork/packages/app`) as an "Agent Lab view".
  - Initially shipped as a proto/mode (dedicated route or feature-flagged layout) so iteration does not destabilize the default experience.
  - Promoted to the default once stable.
- The server Toy UI remains a fallback harness, not the primary product surface.
- Validation runs through the headless web harness (`_repos/openwork/scripts/dev-headless-web.ts`) and Chrome MCP.

## Why this PRD exists (what’s missing today)
We currently have:

- a functional but utilitarian server Toy UI (good for API harnessing)
- a CLI-first instance manager (`openwork-agent-lab`) (good for running the host stack)

What we do not have is a **cohesive, mock-like “Agent Lab” UI** where creating, sharing, and “deploying” workers feels intentional.

This PRD describes a proto UI that:

- uses the mock’s layout and interaction language
- keeps the host contract honest (real endpoints, real tokens, real SSE)
- makes multi-folder entrypoints first-class

## Goals
- Provide a proto UI that matches the mock’s structure closely enough to evaluate “feel”.
- Support the 3 workflows end-to-end using real OpenWork primitives:
  - create worker
  - share worker
  - deploy worker (beta)
- Keep sharing semantics unchanged:
  - connect artifact `openwork.connect.v1`
  - scoped tokens: `owner`, `collaborator`, `viewer`
- Make multi-folder entrypoints easy and safe.
- Make identity feel real:
  - a dedicated `Identities` pane
  - strong observability via REST (health + routing + recent activity)
  - a path to REST-driven test actions (e.g. outbound send) without requiring an OpenCode tool call

## Non-goals
- Shipping the final OpenWork desktop UI.
- Building a production SaaS deploy control plane.
- Replacing OpenCode’s primitives with bespoke concepts.
- Building a perfect permissions UX. This is a proto; we keep least-privilege defaults and clear warnings.

## Definitions

### Worker
UI abstraction for an agent.

In the current system, a worker maps to:

- an Agent Lab instance (local directory + runtime config)
- a workspace directory (OpenCode-native config: `.opencode/*` + `opencode.json`)
- a running `openwrk` host stack (opencode + openwork-server, optionally sandboxed)

We will keep backend route names as-is for now (they still say “workspace”), but the UI will label them as “worker”.

### Entrypoints (multi-folder)
Entrypoints are the folders a worker can see. Each entrypoint includes:

- absolute host path
- `ro` or `rw`
- an optional label (used for sandbox mount mapping)

Entrypoints are reflected in:

- `openwrk` sandbox mounts (`--sandbox-mount hostPath:label:ro|rw`)
- a mount allowlist file (per worker) to enable those mounts safely

### Identity (Slack/Telegram/WhatsApp)
An identity is an addressable surface for a worker.

An identity can be used in two directions:

- inbound: a message arrives and triggers the worker (creates/continues a session)
- outbound: a message is sent out (notification / reply) via a provider

In proto form, identities are allowed to be simple stubs ("Connected" with a config blob), but the UI must make the concept feel first-class.

### Sharing (unchanged)
Sharing remains:

- a workspace URL: `/w/<id>`
- a connect artifact:

```json
{
  "kind": "openwork.connect.v1",
  "hostUrl": "http://127.0.0.1:8787",
  "workspaceId": "ws_...",
  "workspaceUrl": "http://127.0.0.1:8787/w/ws_...",
  "token": "...",
  "tokenScope": "collaborator",
  "createdAt": 0
}
```

## Product principles (proto UI)
Grounded in `_repos/openwork/AGENTS.md` and the Agent Lab PRD (`prds/openwork-agent-lab.md`):

- Conversation-first configuration: creation happens by chatting; UI is for inspection, sharing, scheduling, and guardrails.
- Waiting feels good: show checkpoints quickly; streaming progress with a step timeline.
- Least privilege by default: entrypoints default to `ro`; viewer tokens are read-only.
- “Share is the product”: sharing is a first-class tab, not a hidden settings pane.

## Config reload (repo-grounded)
OpenWork already has **reload signals** and a **reload action**, but the system is imperfect today because **OpenCode does not hot-reload config**.

What exists right now in `_repos/openwork`:

1) Desktop file watcher (local workspaces)
- `packages/desktop/src-tauri/src/workspace/watch.rs`
- Watches:
  - workspace root (non-recursive)
  - `.opencode/` (recursive)
- Emits a Tauri event: `openwork://reload-required` with `{ reason, path }`
- Reasons are conservative and derived from the changed path:
  - `skills`, `agents`, `commands`, `plugins`, `config`
- Explicitly ignored:
  - `openwork.json` (OpenWork metadata)
  - database files (`*.db`, WAL, etc)

2) Server-side reload event store (API-driven changes)
- `packages/server/src/events.ts` stores an in-memory ring buffer of reload events (default max: 200).
- `GET /workspace/:id/events` returns `{ items, cursor }` and supports `?since=<cursor>`.
- Events are recorded when OpenWork endpoints mutate workspace-facing config (skills/plugins/mcp/commands/config import/patch).

3) Engine reload action (manual)
- `POST /workspace/:id/engine/reload`
- Implemented in `packages/server/src/server.ts` via `reloadOpencodeEngine()`.
- Under the hood it calls OpenCode: `POST <opencodeBaseUrl>/instance/dispose?directory=<dir>`.

Proto UI requirements (to make this feel good despite OpenCode not hot-reloading):

- The UI MUST surface a clear "Reload required" state when:
  - it receives the desktop event `openwork://reload-required`, OR
  - it observes new items in `GET /workspace/:id/events`.
- The UI MUST offer a single primary action: "Reload engine" which calls `POST /workspace/:id/engine/reload`.
- After reload succeeds:
  - refresh the worker's config surfaces (skills/plugins/apps)
  - clear the banner
  - add a checkpoint in the timeline ("engine reloaded")

Known gaps (and what we should fix in OpenWork):

- In server-only mode, changes written by OpenCode tools (e.g. creating a skill file) do not necessarily produce `GET /workspace/:id/events` entries.
  - Fix: add a workspace watcher in `openwork-server` (Bun) that records reload events for the same conservative reasons as the desktop watcher.
- Reload should be queued when a session is actively running.
  - Fix: add a minimal "reload queue" state per workspace and only call engine reload when idle.

## UX scope

## Feel test script (what we will dogfood)
This proto UI is successful only if the experience feels good in real-time.

Script (run as owner):

1) Create a worker
- Go to Workers home
- Click Create worker
- Name: "Scout"
- Add 2 entrypoints:
  - `~/projects` (ro)
  - `~/Downloads` (rw)
- Create and start

Expected:
- worker appears with "running" status
- you land in chat within 1 navigation
- first checkpoint arrives quickly (sub-second after prompt submit)

2) Share a worker
- Open Share tab
- Mint a viewer token
- Copy connect JSON

Expected:
- connect JSON is valid and immediately usable
- viewer token cannot mutate anything (UI reflects read-only)

3) Deploy (Beta)
- Open Deploy flow
- Generate a stateless worker bundle
- Copy the bundle JSON

Expected:
- you get export JSON (workspace blueprint) plus a minimal run recipe
- the UI explains what is and is not included (no credentials; folders are not copied)
- there is an explicit post-deploy verification checklist (health, import, engine reload)

### A) Create worker
Goal: create a new worker in under 60 seconds, with correct folder access.

Proto UI requirements:

- Worker creation is a dedicated, first-class flow.
- Minimal fields:
  - name
  - runtime: sandbox `auto|none` (advanced: image)
  - entrypoints: multi-folder list with `ro|rw` toggle
- Defaults:
  - sandbox: `auto`
  - entrypoints: `ro`
- Preflight validation:
  - path exists
  - warn on blocked patterns (credentials-like paths)
  - show what will be mounted and where

Outcome:

- worker is created
- worker is started in background
- UI navigates into the worker experience automatically

### B) Share worker (unchanged semantics)
Goal: make it easy to generate connect artifacts and tokens.

Proto UI requirements:

- Show worker URL (`/w/<id>`)
- Render connect artifact JSON
- Mint viewer/collaborator tokens (owner-only)
- List and revoke tokens (owner-only)
- Copy actions that work reliably

### C) Deploy worker (Beta)
Goal: test the “deploy” feel without requiring full infra.

Definition (proto): deployment is a guided flow that produces a runnable plan.

Deploy UI steps:

1) Generate a stateless bundle
- export JSON (existing `GET /workspace/:id/export`)
- entrypoints plan (folders expected on the target)
- automations definitions (if present)
- identity stubs (no credentials)

2) Show an apply recipe (no remote execution)
- start a host on the target machine (run `openwrk start ...` on that machine)
- apply config: `POST /workspace/:id/import`
- reload engine: `POST /workspace/:id/engine/reload`

Non-goal: automatic remote provisioning. Deploy is portability, not remote execution.

### D) Identities (inbound + outbound)
Goal: identities feel like part of the worker character, not an afterthought.

Proto UI requirements:

- Slack/Telegram/WhatsApp are shown in a dedicated `Identities` pane.
- Each identity can show:
  - provider (slack / telegram / whatsapp)
  - status (connected / not configured)
  - configured? enabled? applied? last error?
- Provide test/observability actions (all REST-driven):
  - Refresh status (`GET /owpenbot/health`)
  - View routing/bindings (`GET /owpenbot/bindings`)
  - Configure Slack + Telegram via OpenWork helpers (workspace-scoped + approval gated)
  - WhatsApp pairing UX (QR code)

Note: we do not require full provider onboarding flows in proto. We do require strong observability and clear "configured vs applied" feedback.

## UI design (mock-inspired)
Design reference: `prds/mocks/agent-lab-window.mock.tsx`.

The proto UI should preserve the mock’s high-level structure:

- Home screen: Workers list
- Worker screen:
  - left rail: sessions/tasks
  - center: chat + timeline
  - right rail: tabs

### Tabs (right rail)
Minimum set:

- Share (includes Deploy button)
- Identities
- Automations
- Skills
- Plugins
- Apps (MCP)
- Config (folder access)

Notes:

- The “Deploy (Beta)” affordance must exist even if it is a guided copy/paste flow.
- Multi-folder entrypoints are managed in Config.

## Screen specs (proto)

### Screen 0: Workers home
Primary purpose: treat workers as the first-class object.

Elements:
- header: "Agent Lab" + subtle status (local host running / not running)
- primary list: worker cards (name, avatar, status, entrypoints count, last run)
- actions:
  - Create worker
  - Import worker bundle (optional)

Worker card states:
- stopped: shows Start button
- starting: shows spinner + recent logs link
- running: shows Open button (go to Worker screen)
- error: shows error summary + Retry / View logs

### Screen 1: Worker (main)
Layout mirrors the mock:

- left rail (Tasks): session list (most recent at top) + "New session"
- center: chat + checkpoints timeline
- right rail: tabs

Copy rules:
- UI says "worker" everywhere.
- Where the underlying API uses `workspaceId`, show it as "worker id" but do not rename JSON keys in connect artifacts (sharing is unchanged).

### Tab: Share
Keep the semantics identical to the Toy UI, but present it with mock-like affordances.

Sections:
- Workspace URL (label as "Worker URL")
- Connect artifact JSON
- Token actions:
  - Mint viewer token
  - Mint collaborator token
  - Revoke token
- Deploy (Beta) button

Behavior:
- If current token is not owner, show Share in read-only mode:
  - hide mint/revoke
  - show "Ask owner for an owner token" hint

### Tab: Deploy (Beta)
Deploy is a wizard-like flow that produces a **stateless bundle**. There is no remote execution concept in this product.

Step 1: Bundle type
- Blueprint (stateless, portable) (default)

Step 2: Bundle contents
- export JSON (always) from `GET /workspace/:id/export`
- entrypoints plan (always)
- automations definitions (if present)
- identities stubs (addresses and routing hints, not credentials)

Step 3: Output
- Bundle JSON box (copy/download)
- Run recipe (copy): how to start `openwrk` on the target machine and apply the bundle via `POST /workspace/:id/import`
- Verification checklist (copy):
  - `GET /health`
  - `GET /workspaces`
  - `POST /workspace/:id/import`
  - `POST /workspace/:id/engine/reload`

Rollback:
- stop the target host process

### Tab: Config (multi-folder)
Folder access is the core safety feature.

Requirements:
- Add/remove entrypoints
- Each entrypoint has:
  - path (absolute)
  - ro/rw toggle
  - optional label
- Show the mount mapping:
  - `ro` or `rw`
  - "Mounts inside sandbox at /workspace/extra/<label>"

Behavior:
- Changing entrypoints on a running worker requires a restart.
- UI should offer:
  - "Apply and restart" (owner)
  - "Save for next start" (collaborator, if we allow local-only edits)

### Tab: Identities
Identity is a core part of a worker. This tab should be visually strong:

- identity cards per provider:
  - Slack
  - Telegram
  - WhatsApp

Each card has:

- status pill: Connected / Not configured
- configured vs applied detail:
  - configured means credentials/settings are persisted
  - applied means the running adapter picked up the change
- health panel (from `GET /owpenbot/health`)
- routing panel (from `GET /owpenbot/bindings`)

Provider-specific actions:

- Slack:
  - set bot/app tokens via `POST /workspace/:id/owpenbot/slack-tokens`
  - show `applied/starting/error` from response
- Telegram:
  - set bot token via `POST /workspace/:id/owpenbot/telegram-token`
  - show `applied/starting/error` from response
- WhatsApp:
  - show enabled state via `GET /owpenbot/config/whatsapp-enabled`
  - show QR code via `GET /owpenbot/whatsapp/qr`
  - (proto) if we add wrappers: configure/toggle via workspace-scoped helper endpoints

Observability gap to close (required for proto feel):

- Add a read-only "recent activity" feed for inbound/outbound adapter events so the UI can show:
  - last inbound message per channel
  - last outbound send per channel
  - last adapter error

### Tab: Automations
Proto requirements:
- list automations
- create automation (interval/daily/weekly)
- run now
- view last run session

Scheduling note:
- the schedule is applied on the host (launchd) by the manager.
- UI must explicitly say "scheduled runs are applied on this machine".

### Tab: Skills / Plugins / Apps
These remain simple views over existing endpoints:
- Skills: list + delete (project-only)
- Plugins: list + add/remove (config source)
- Apps: list MCP servers (add/remove is optional for proto)

## Hard parts (what will be difficult)

### 1) Workers list in a single UI
If each worker is a separate host, we need a manager UI that can list and control them.

Mitigation:
- Start by reusing the existing workspace model inside the app and relabel it as "worker" in this view.
- Ship the Agent Lab view as a mode/route first.
- Add UI-first worker creation later (desktop-only), or rely on CLI/daemon in the interim.

### 2) Session list UX
The mock implies a stable "Tasks" list.

Mitigation (proto):
- treat sessions as "recently used" based on what the UI opened
- optionally add a lightweight "recent sessions" cache per worker (local file) without needing new OpenCode APIs

### 3) Deploy meaning
"Deploy" can balloon into infra.

Mitigation:
- keep deploy as a guided bundle + copyable command template for now
- keep a clear separation between "share" (token) and "deploy" (hosting)

## Rollout plan (app-first)

Phase 0: Agent Lab view behind a proto switch
- Add an Agent Lab view (route or mode) that reuses existing session layout components.
- Keep existing app flows unchanged.
- The Agent Lab view relabels "workspace" as "worker" in UI copy only.

Phase 1: Promote to default
- Once Create/Share/Deploy/Identities are stable and testable, make the Agent Lab view the default landing experience for local mode.

Exit criteria for promotion:
- reload UX works end-to-end in `dev:headless-web` harness
- identities pane shows owpenbot status without host token sharing
- deploy bundle works locally (export/import/reload) without secrets

## System design (proto implementation)

### Recommended: Agent Lab Manager UI (served by openwork-agent-lab)
To support a real “Workers list” + create/start/stop across many workers, we introduce a manager surface:

- Add `openwork-agent-lab ui` that starts a local web server (bind `127.0.0.1`).
- The manager UI reads/writes the same instance state the CLI uses.
- The manager UI proxies worker API calls so the browser talks to one origin.

This avoids trying to make a single `openwork-server` instance own process management.

Manager responsibilities:

- list workers (instances)
- create worker (provision workspace, entrypoints)
- start/stop worker (`openwrk start --detach`)
- share actions:
  - mint tokens (call worker `/tokens` using owner token or host token)
  - render connect artifacts
- deploy wizard:
  - fetch export JSON from worker
  - generate commands and bundle
  - identities management:
    - read/write identity config
    - test inbound/outbound endpoints

### Worker responsibilities (existing)
Each worker is a normal OpenWork host stack:

- `openwrk` orchestrates
- `openwork-server` serves API + SSE and (optionally) Toy UI
- `opencode` runs the engine

We keep these unchanged.

## Data model (proto)

### Worker
Stored in the instance directory (already exists in the CLI):

- `id`, `name`, `avatarSeed`
- `workspaceDir`
- `entrypoints[]` (multi-folder)
- runtime config (sandbox mode/image)
- connect tokens (collaborator + owner)

### Deployment bundle
Proto file format stored per worker (example):

- `deployment.json`
  - exported config payload
  - command template(s)
  - notes/warnings

## API surface (what the proto UI needs)

### Existing (OpenWork server)
- tokens: `GET/POST/DELETE /tokens` (host/owner)
- export/import: `GET /workspace/:id/export`, `POST /workspace/:id/import`
- skills/plugins/mcp/commands: `GET/POST/DELETE /workspace/:id/...`
- config reload signals: `GET /workspace/:id/events` and `POST /workspace/:id/engine/reload`
- opencode proxy + events: `/w/:id/opencode/*`, SSE events
- owpenbot proxy: `/owpenbot/*` and `/w/:id/owpenbot/*`
  - `GET /owpenbot/health` is client-auth (read-only)
  - other owpenbot routes are host-auth by default

### Existing (OpenWork server): owpenbot identity configuration helpers
OpenWork already exposes helper endpoints that persist credentials to the host-local `owpenbot.json` and then attempt to apply them to a running owpenbot adapter via its health server.

- `POST /workspace/:id/owpenbot/telegram-token`
- `POST /workspace/:id/owpenbot/slack-tokens`

These are the preferred UI hooks because they:

- are workspace-scoped for auditing/approvals
- return `applied` / `starting` / `error` fields suitable for UI feedback

### Existing (owpenbot health server) via OpenWork proxy
Owpenbot exposes a small REST surface intended for configuration and status. Source: `_repos/openwork/packages/owpenbot/src/health.ts`.

Key routes (as seen through OpenWork proxy):

- `GET /owpenbot/health`
  - returns `HealthSnapshot`:
    - `opencode.url`, `opencode.healthy`, `opencode.version?`
    - `channels.telegram`, `channels.whatsapp`, `channels.slack`
    - `config.groupsEnabled`
- `POST /owpenbot/config/telegram-token`
- `POST /owpenbot/config/slack-tokens`
- `GET /owpenbot/config/whatsapp-enabled`
- `POST /owpenbot/config/whatsapp-enabled`
- `GET /owpenbot/whatsapp/qr?format=raw|ascii`
- `GET /owpenbot/bindings`
- `POST /owpenbot/bindings`
  - sets or clears routing rules: `{ channel, peerId, directory }`

Bindings are the real "identity -> worker" mapping today: owpenbot routes inbound messages to the correct OpenCode directory.

### Needed (OpenWork changes) for the proto UI
To improve observability and keep everything testable via REST:

- Add wrapper endpoints for WhatsApp enablement + QR code that mirror Slack/Telegram helper endpoints (persist + apply + return rich status).
- Add a read-only owpenbot observability feed (ring buffer) for the UI:
  - recommended: extend `HealthSnapshot` to include recent inbound/outbound/status items, OR add `GET /owpenbot/events`.
  - update the OpenWork proxy allowlist so collaborators can read this endpoint (similar to `GET /owpenbot/health`).

### New (Agent Lab Manager)
Only needed if we implement the manager UI:

- `GET /workspaces` (list local workers)
- `POST /workspaces` (create + optionally start)
- `POST /workspaces/:id/start`
- `POST /workspaces/:id/stop`
- `GET /workspaces/:id/connect` (connect artifacts)
- `POST /workspaces/:id/deploy/bundle` (generate bundle)

These are local-only; they do not need to be part of openwork-server.

## Security and safety
- The manager UI binds to `127.0.0.1`.
- Owner-only actions remain owner-only:
  - token mint/revoke
  - OpenCode permission replies via proxy
- Entrypoints default to `ro`.
- UI must display a clear warning whenever `rw` is enabled.

Identity safety:

- Owpenbot credentials are stored host-locally (default: `~/.openwork/owpenbot/owpenbot.json`, overridable via `OWPENBOT_CONFIG_PATH`).
- Blueprint export (`GET /workspace/:id/export`) MUST remain stateless: it must not include owpenbot credentials.
- Identity config changes must remain approval/audit gated.
- Read-only identity observability (health/events) should be safe to expose to collaborators.

## Acceptance criteria

### Create worker
- From the Workers screen, I can create a worker with 2+ entrypoints and start it.
- I land in the worker view and can send a prompt.
- The timeline shows live checkpoints.

### Share worker
- I can copy a connect artifact.
- I can mint a viewer token and revoke it.

### Deploy worker
- I can generate a deployment bundle that includes:
  - export JSON (workspace blueprint)
  - entrypoints plan
  - a run recipe (how to start a host + apply `POST /workspace/:id/import` + `POST /workspace/:id/engine/reload`)
- The bundle must not contain secrets.

### Identities
- I can see identity health status via `GET /owpenbot/health` (proxied through OpenWork).
- I can configure Telegram and Slack via the OpenWork helper endpoints:
  - `POST /workspace/:id/owpenbot/telegram-token`
  - `POST /workspace/:id/owpenbot/slack-tokens`
  and get `applied/starting/error` feedback.
- I can retrieve a WhatsApp QR code via `GET /owpenbot/whatsapp/qr` and see a clear "enabled" state.
- I can view owpenbot bindings and understand which directory (worker) a peer routes to.

## Open questions
- What is the minimum viable meaning of “Deploy” we want to validate?
  - export blueprint + run recipe (no remote exec concept)
  - optional: UI-assisted "download bundle" (still local-first)
- Do we want “Workers” to be multiple workspaces under one host (daemon), or multiple hosts (instances)?
  - Keep the UI model stable either way: worker == workspace at the API level.
  - Choose based on operational simplicity (ports/processes vs routing).

- Owpenbot observability: which read-only endpoints should collaborators be allowed to access through the OpenWork proxy?
  - today: only `GET /owpenbot/health` is client-auth
  - likely needed: `GET /owpenbot/bindings` and a read-only event feed

## Next steps
- Implement the Agent Lab Manager UI as `openwork-agent-lab ui`.
- Port the mock’s layout and styling into that UI (HTML/CSS/JS is acceptable for proto).
- Keep `openwork-server` Toy UI as a harness, but make the manager UI the primary “feel test” surface.
