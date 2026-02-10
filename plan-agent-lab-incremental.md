---
title: Agent Lab (Workers) incremental integration plan
date: 2026-02-08
repo: openwork-enterprise
---

This document is an execution plan for landing the Agent Lab "Workers" proto UI and workflow into the main OpenWork repo (`different-ai/openwork`) in a way that is incremental, reliable, and feels like a meaningful step forward at each merge.

Update (2026-02-09)
- We are de-scoping containerization/sandbox as a hard dependency. Keep it as a late hardening step.
- The immediate priority is **real isolation via owpenbot multi-identities + identity-scoped routing**, plus **per-workspace automation scoping**.
- We are removing WhatsApp support (bloat + instability) and focusing on Telegram + Slack with support for multiple bots/apps.
- "Deploy" as a first-class tab/wizard is de-prioritized; stateless export/import remains an API capability but is not the next user-facing milestone.

Constraints (non-negotiable)
- No `_repos/opencode` code changes.
- Reuse the existing "workspace" isolation model in OpenWork as the underlying object; UI may call it "worker".
- Deploy (if/when exposed) means "stateless blueprint portability" (export/import + engine reload). No SSH / remote execution concept.
- Identities: Slack + Telegram only via owpenbot. Must support **multiple identities** (multiple Telegram bots, multiple Slack apps) and **identity-scoped routing** (identity + peer -> directory). No workspace concept inside owpenbot.
- OpenCode does not hot-reload config today; we must make reload legible and fixable from OpenWork.

Test harness (non-negotiable)
- Every milestone must be verifiable in the web harness: `scripts/dev-headless-web.ts`.
  - This runs `openwrk` + the web app.
  - Verification is performed via Chrome MCP (UI flows) and curl (REST flows).

Concrete harness invocation (OpenWork repo)
- From `_repos/openwork`:
  - `pnpm dev:headless-web`

Notes:
- The harness is the default environment for Agent Lab iteration.
- When a milestone touches `packages/server/src`, rebuild the server binary:
  - `pnpm --filter openwork-server build:bin`

Where we are today (repo-grounded)

OpenWork already provides most of the substrate we need:

- Reload signals + cursor store: `GET /workspace/:id/events` (server ring buffer) in `_repos/openwork/packages/server/src/events.ts`.
- Engine reload action: `POST /workspace/:id/engine/reload` which calls OpenCode `POST /instance/dispose?directory=...`.
- Workspace export/import: `GET /workspace/:id/export`, `POST /workspace/:id/import`.
- Owpenbot proxy: `/owpenbot/*` and `/w/:id/owpenbot/*`.
- Owpenbot helper endpoints (persist + apply + status):
  - `POST /workspace/:id/owpenbot/telegram-token`
  - `POST /workspace/:id/owpenbot/slack-tokens`
- Desktop watcher (Tauri): emits `openwork://reload-required` when `.opencode/*` changes.

We also have working experimental work in a branch:

- `different-ai/openwork` PR #504 (`feat/agent-lab`) that adds `packages/agent-lab` and expands the server Toy UI to cover Share/Automations/Skills/etc.

The plan below assumes we will land this work in smaller, safer slices.

Strategy: ship by layers

Layer 1: Host contract correctness (OpenWork server)
- security and auth boundaries
- reload observability and fix path
- owpenbot observability and configuration
- export/import stays stateless

Layer 2: Proto experience surface (UI)
- App-first: implement an "Agent Lab view" inside `packages/app`.
  - Initially shipped as a proto/mode (a dedicated route or feature-flagged layout) so we can iterate without destabilizing the default experience.
  - Later promoted to the default once the workflow is stable.
  - Use existing session layout components and state where possible.
  - Keep server Toy UI as a fallback harness only.

Layer 3 (optional): Worker lifecycle integration
- Only needed if "Create worker" must be a UI-first, one-click flow that starts/stops host stacks.
- If we accept "create/start via CLI" initially, we can skip this layer and still test the feel.
- If we need it later, prefer desktop-native orchestration (Tauri) or `openwrk daemon` over inventing a new long-lived manager.

Incremental milestones (each merge should feel big)

Milestone 1: Security baseline + test harness parity

Goal: make sharing safe by default and prevent collaborator self-approval.

Deliverables (OpenWork repo)
- Proxy gating: collaborators/viewers cannot call OpenCode permission reply endpoints via `/opencode/*` and `/w/:id/opencode/*`.
- Skills uninstall endpoint (if missing on dev): `DELETE /workspace/:id/skills/:name`.
- Toy UI shows "Owner vs collaborator" clearly (even if still utilitarian).

Harness gate (`dev:headless-web`)

Start harness
- `pnpm dev:headless-web`

UI verification (Chrome MCP)
- Navigate to the running web app URL printed by the harness.
- Open the Share UI and mint a viewer token (owner flow).
- Validate that collaborator tokens cannot self-approve OpenCode permission prompts.

Suggested Chrome MCP checks
- Open the app and confirm no console errors on load.
- In the Share surface, mint a viewer token and confirm it appears.
- Try to perform an OpenCode permission reply using a collaborator token and observe the UI error (403).

REST verification (curl)
- Get workspace id:
  - `GET /workspaces`
- Collaborator should be blocked:
  - `POST /w/:id/opencode/permission/req123/reply` -> 403
- Owner should not be blocked by OpenWork:
  - same request -> not 403 (may still fail with 400/502 if OpenCode is unconfigured)

Demo script (what feels like a big step)
1) Start a host with `openwrk start --detach`.
2) Mint a viewer token from the UI as owner.
3) Attempt a permission reply through the proxy as collaborator: expect 403.

Reliability checks
- curl: `POST /w/:id/opencode/permission/<req>/reply` returns 403 for collaborator.
- typecheck/build: `pnpm --filter openwork-server typecheck && pnpm --filter openwork-server build:bin`.

Milestone 2: Living system reload (make it legible)

Goal: make "config changes require reload" a first-class user-visible state, and provide a single reliable fix action.

Deliverables
- App UI: a persistent "Reload required" banner driven by:
  - desktop event `openwork://reload-required` (desktop mode), AND
  - `GET /workspace/:id/events` polling (headless-web/server mode)
- App UI: primary action "Reload engine" -> `POST /workspace/:id/engine/reload`
- Server: add a Bun workspace watcher (server-only mode) that records reload events when `.opencode/*` or `opencode.json{c}` changes.
  - Conservative reasons should mirror the desktop watcher.
  - Ignore db files and `openwork.json`.

Demo script
1) Ask the agent to create a skill by writing `.opencode/skills/<name>/SKILL.md`.
2) UI shows "Reload required" (without the user needing to understand why).
3) Click "Reload engine"; the skill appears in the Skills pane.

Reliability checks
- Unit smoke: create a file under `.opencode/skills` and confirm `GET /workspace/:id/events?since=<cursor>` yields a reload event.
- Engine reload: `POST /workspace/:id/engine/reload` returns 200 and subsequent prompts work.

Milestone 3: Identities that feel real (observability first)

Goal: Slack/Telegram identities feel first-class, support multiple bots/apps, and routing is identity-scoped. Everything is testable via REST.

Deliverables
- App UI: Identities pane driven by REST calls (no OpenCode tool calls required):
  - `GET /owpenbot/health` for status
  - `GET /owpenbot/bindings` for routing (identity + peer -> directory)
  - Slack identities (multiple) via new endpoints (server proxies to owpenbot):
    - `GET /owpenbot/identities/slack`
    - `POST /owpenbot/identities/slack`
    - `DELETE /owpenbot/identities/slack/:id`
  - Telegram identities (multiple) via new endpoints (server proxies to owpenbot):
    - `GET /owpenbot/identities/telegram`
    - `POST /owpenbot/identities/telegram`
    - `DELETE /owpenbot/identities/telegram/:id`
  - Routing management (identity-scoped):
    - `GET /owpenbot/bindings`
    - `POST /owpenbot/bindings`
    - `DELETE /owpenbot/bindings`
- Auth: allow collaborators to read identity observability endpoints needed for the pane:
  - `GET /owpenbot/health`
  - `GET /owpenbot/bindings` (currently host-auth; make read-only client-auth)

Optional but high-leverage (observability feed)
- Add `GET /owpenbot/events` (ring buffer) or extend the health snapshot to include recent inbound/outbound/status lines.
  - This makes the UI feel alive and makes debugging pairing issues trivial.

Demo script
1) Open Identities pane.
2) See Slack + Telegram identities immediately (list of configured bots/apps).
3) Add a Telegram bot token and see it appear with `getMe` metadata.
4) Add a Slack app token pair and see it appear with auth metadata.
5) See bindings and confirm which directory a peer routes to (identity-scoped).

Reliability checks
- `GET /owpenbot/health` works with collaborator token.
- `GET /owpenbot/bindings` works with collaborator token and returns stable mapping.

Milestone 4: Automations are per-workspace

Goal: scheduled jobs/automations are not shared across all workspaces; they belong to the active workspace.

Deliverables
- Persist a workspace scoping key on every job (directory or workspaceId).
- UI filters job list by active workspace.
- UI job creation stamps the active workspace scope.

Reliability checks
- Create a job in workspace A; confirm it does not appear in workspace B.
- Jobs remain runnable via the existing scheduler integration.

Milestone 5 (later): Sandbox hardening (Docker) for worker stacks

Goal: improve isolation by running per-worker stacks inside Docker when available.

Notes
- Not required for correctness of identities/routing or automation scoping.
- Must degrade gracefully when Docker is unavailable.

Deliverables
- openwrk starts a worker stack with `--sandbox auto` (docker when available; none otherwise).
- Per-worker data dirs remain isolated; owpenbot identities/routing continue to work.

Goal: "Deploy" feels like a real action, but it is purely export/import/reload.

Deliverables
- App UI: Deploy wizard that produces:
  - Bundle JSON (based on `GET /workspace/:id/export` + entrypoints plan)
  - Apply recipe:
    - start a host on the target machine (user-driven, no remote exec)
    - `POST /workspace/:id/import`
    - `POST /workspace/:id/engine/reload`
- Bundle must be stateless:
  - do not include owpenbot credentials (`owpenbot.json` is host-local)
  - do not include tokens

Demo script
1) Export bundle from worker A.
2) Start a new local host (worker B) on another port.
3) Import bundle into worker B, reload engine, run a prompt.

Reliability checks
- `GET /workspace/:id/export` output remains stable and diffable.
- Import followed by engine reload yields a consistent skills list.

Milestone 6 (optional): Create worker from the app (desktop-only)

Goal: make "create worker" a UI-first flow while keeping the CLI testability.

Preferred approach
- Desktop app (Tauri) provides commands to:
  - provision a workspace directory
  - start/stop `openwrk` with `--detach`
  - return the connect artifact (baseUrl + token)
- App then adds it as a remote workspace (worker) and navigates into the Agent Lab view.

Fallback approaches
- Use `openwrk daemon` and create multiple workspaces under one router.
- Keep creation in CLI and make the app focus on the worker experience only.

PR slicing (how we keep momentum)

We should aim for 4-8 PRs instead of 1 huge merge:

1) security + skills delete + minimal app copy tweaks
2) server-side watcher + reload UX in app
3) owpenbot bindings read access + identities pane in app
4) deploy bundle wizard in app
5) owpenbot events feed (if not already)
6) desktop-only create worker flow (optional)

Each PR should include:
- a 3-minute demo script
- curl-based smoke verification
- `pnpm typecheck` and `openwork-server build:bin` when server changes

Risks and mitigations

- Token mismatch between `openwrk` and UI
  - Mitigation: always derive UI deep links from the tokens printed by `openwrk start` or minted via host token.

- Reload loops / interrupting active sessions
  - Mitigation: queue reload signals when a session is running and only reload when idle.

- Owpenbot routes require host auth (collaborators can't see identity state)
  - Mitigation: explicitly promote read-only endpoints (`/health`, `/bindings`, `/events`) to client-auth.

- Session list for the left rail
  - Mitigation: first implement a simple "recent sessions" cache in the UI.
  - Follow-up: add an OpenWork server endpoint that reads `.opencode/opencode.db` for session metadata (no OpenCode changes).
