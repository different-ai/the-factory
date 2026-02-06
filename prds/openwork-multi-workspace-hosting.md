---
title: Multi-workspace hosting (single port, concurrent)
description: Let one OpenWork host serve multiple workspaces concurrently via /w/:id mounts, with a single access token; includes UX vocabulary cleanup for "Messaging Bridge" -> "Chat Access".
---

## Summary
OpenWork is a mobile-first, premium UX layer on top of OpenCode (see `_repos/openwork/AGENTS.md`).

Today, a running host can only effectively expose one "active" workspace at a time because:
- `openwrk` spawns `openwork-server` with a single `--workspace`.
- `openwork-server` returns only the active workspace from `GET /workspaces` and proxies `/opencode/*` only for the active workspace.

This PRD defines the next step: **serve multiple workspaces at the same time** from a single OpenWork host/port. Remote clients can connect to a specific workspace via a stable workspace URL (`/w/<workspaceId>`) and run tasks without stepping on other workspaces.

This PRD also includes a naming cleanup: the UI term "Messaging Bridge" is jargon and overloaded in this repo. We will rename the user-facing concept to **Chat Access**.

## Goals
- One host instance exposes N workspaces concurrently on a single port.
- A shared link points to a specific workspace (not "whatever is active"): `http(s)://host:8787/w/<workspaceId>`.
- A single access token grants access to all workspaces on that host (Phase 1 simplicity).
- UI makes it obvious which settings are global vs workspace-scoped.
- Share UX (for local workspaces) includes the per-workspace URL.
- "Messaging Bridge" is renamed to "Chat Access" in user-facing UX and docs.

## Non-goals (for this PRD)
- Per-workspace tokens / ACLs / role systems.
- NAT traversal / public hosting (LAN/VPN/tunnel guidance is enough).
- Real-time collaborative editing.
- Fully eliminating the "active workspace" concept (we can keep it for host ergonomics).
- Running multiple owpenbot processes (one per workspace).

## Key decision
**Token model:** one bearer token grants access to all workspaces on a host.

Rationale:
- Simplest path to a working multi-workspace system.
- Compatible with current API auth (`Authorization: Bearer <token>`) which is host-global.
- Keeps the mental model straightforward for Phase 1.

Follow-up idea (future phase): workspace-scoped tokens + workspace visibility rules.

## Owpenbot (Chat Access) multi-workspace decision
We want Owpenbot to remain extractable as a standalone project.

Constraint:
- Owpenbot must not depend on OpenWork concepts (OpenWork workspace IDs, host tokens, /w/:id, OpenWork server APIs).
- Owpenbot may be opinionated toward OpenCode concepts (baseUrl, directory selection, sessions).

Decision:
- Owpenbot becomes multi-workspace by selecting an OpenCode directory per conversation/message.

Implications:
- One Owpenbot process can serve multiple OpenWork workspaces concurrently.
- Routing is expressed purely in OpenCode terms:
  - key: (channel, peerId) -> opencodeDirectory
  - opencodeDirectory is the only "workspace" identifier inside Owpenbot
- The mapping must be persisted (so restarts don't lose routing), and must have safe defaults.

Proposed Owpenbot routing model (high level):
- For each inbound message, resolve a directory:
  1) Lookup persisted mapping for (channel, peerId)
  2) If none exists, use a configured default directory (or deny until the user binds it)
- Provide a minimal management surface that does not mention OpenWork:
  - list bindings
  - set binding for (channel, peerId)
  - clear binding

Operational note:
- OpenWork server can still be the control plane that calls these Owpenbot management endpoints, but it must treat them as generic "bind chat peer to directory" operations.

## Terminology (canonical)
Use these terms consistently in UI, docs, and code comments.

- **Host**: the machine running OpenWork sidecars (`openwrk`, `openwork-server`, `opencode`, optionally `owpenbot`).
- **Client**: a device/UI connecting to the host over HTTP.
- **Server URL**: `http(s)://host:8787` (host-wide).
- **Workspace URL**: `http(s)://host:8787/w/<workspaceId>` (workspace-scoped base URL).
- **Workspace mount**: the `/w/:id` path prefix.

### Chat Access vocabulary (rename)
The term "bridge" is overloaded:
- There is an "OpenCode bridge" skill: `_repos/openwork/.opencode/skills/opencode-bridge/SKILL.md`.
- There is a "secure bridge" concept in host connection docs: `_repos/openwork/pr/web-only-mode-resilient-workspaces.md`.
- The UI label "Messaging Bridge" is actually: "the chatbot service (owpenbot) that connects WhatsApp/Telegram/Slack".

**User-facing term (recommended):** Chat Access

Also acceptable:
- Chat Apps
- Messaging Apps
- Chat Integrations

Reserve "bridge" for internal/dev-only docs (or stop using it entirely).

Standard explainer (use verbatim everywhere):
- "Chat Access lets you talk to your OpenWork host from WhatsApp, Telegram, or Slack. It runs on the host machine (the one doing the work) and relays messages to/from your OpenCode sessions."

Naming rule:
- UI/product: **Chat Access**
- Service/binary: **Owpenbot**
- Internal concept: **Connector** (telegram/slack/whatsapp connectors)
- Owpenbot routing key: **Binding** (channel + peerId -> opencodeDirectory)

## Current state (grounded in repo)

### openwork-server supports multiple workspaces internally but hides them from clients
The server config supports multiple workspaces:
- Workspace IDs are stable and derived from paths: `_repos/openwork/packages/server/src/workspaces.ts` (`workspaceIdForPath()` => `ws_<sha256prefix>`).

But:
- `GET /workspaces` returns only `config.workspaces[0]` today.
- `/opencode/*` proxies only `config.workspaces[0]` today.

### openwrk orchestrates a single workspace per run
`openwrk` spawns `openwork-server` with exactly one `--workspace`:
- `_repos/openwork/packages/headless/src/cli.ts` (`startOpenworkServer()` builds args with a single `--workspace`).

### opencode can serve many directories from one server
OpenCode selects its instance directory per request:
- `_repos/opencode/packages/opencode/src/server/server.ts` reads `?directory=` or `x-opencode-directory`.

This enables multi-workspace hosting without needing multiple opencode processes.

## Desired user experience

### Sharing
- In the workspace `Share...` modal for local workspaces, show:
  - "OpenWork workspace URL" (mounted `/w/<id>`)
  - "Access token"
- Sharing a workspace is copy/paste of that URL + token.

### Connecting
- A client can connect by:
  - Pasting a Workspace URL directly (best).
  - Or connecting to a Server URL + token and selecting a workspace from a list.

### Multi-workspace concurrency
- Two clients can connect to two different workspaces simultaneously.
- Running a long task in workspace A does not affect workspace B.
- Reload/config/audit/events are scoped by workspace ID.

## Technical plan (workstreams)

### Workstream 1: openwork-server (API + mounts)

#### 1.1 Make workspace discovery real
Change `GET /workspaces` to return all configured workspaces to an authorized client.

Proposed response:
```json
{
  "items": [<workspace>, <workspace>, ...],
  "activeId": "ws_..." | null
}
```

Compatibility:
- Existing clients that take `items[0]` will still work.
- Keep `activeId` (host convenience) but do not require it for correct behavior.

#### 1.2 Keep `/w/:id/workspaces` as "single-item view"
When a client uses a Workspace URL base (i.e., their baseUrl already includes `/w/<id>`), calls to `${baseUrl}/workspaces` map to `/w/:id/workspaces`.

Keep this endpoint returning only that one workspace:
```json
{ "items": [<workspace>], "activeId": "ws_..." }
```

This preserves the "workspace URL behaves like a single-workspace server" mental model.

#### 1.3 Ensure all workspace-scoped endpoints exist behind the mount
Today only a subset is mounted (`/w/:id/status`, `/w/:id/capabilities`, `/w/:id/workspaces`, `/w/:id/opencode/*`).

Critical implementation detail:
- The OpenWork UI client builds URLs by **string concatenation** (`${baseUrl}${path}`) in `_repos/openwork/packages/app/src/app/lib/openwork-server.ts`.
- If the UI uses a Workspace URL as its baseUrl (e.g. `http://host:8787/w/ws_123`) and then calls an endpoint like `/workspace/ws_123/plugins`, the actual request becomes:
  - `http://host:8787/w/ws_123/workspace/ws_123/plugins`
- Therefore, **either** the server must provide mounted aliases for the `/workspace/:id/*` routes, **or** the client must special-case path construction when baseUrl is mounted.

We need to decide if we also want mounted equivalents for the rest of the API surface:

Option A (minimal):
- Keep the API as `/workspace/:id/...` for everything except `status/workspaces/capabilities/opencode`.
- UI/SDK can still call `/workspace/:id/...` even when baseUrl includes `/w/:id`.
  - This requires client changes: detect mounted baseUrl and avoid duplicating the `/workspace/:id` prefix.

Option B (recommended):
- Provide mounted aliases for the workspace APIs so relative URLs work from the Workspace URL base.
- Examples:
  - `/w/:id/config` => equivalent of `/workspace/:id/config`
  - `/w/:id/audit` => `/workspace/:id/audit`
  - `/w/:id/plugins` => `/workspace/:id/plugins`
  - `/w/:id/skills` => `/workspace/:id/skills`
  - `/w/:id/commands` => `/workspace/:id/commands`
  - `/w/:id/mcp` => `/workspace/:id/mcp`
  - `/w/:id/scheduler/jobs` => `/workspace/:id/scheduler/jobs`
  - `/w/:id/events` => `/workspace/:id/events`
  - `/w/:id/engine/reload` => `/workspace/:id/engine/reload`
  - `/w/:id/export` + `/w/:id/import`

This makes "Workspace URL is a first-class base URL" true across the API.

#### 1.4 Proxy correctness
Keep `/w/:id/opencode/*` proxying with:
- `Authorization` stripped (do not forward the OpenWork token)
- `x-opencode-directory` set to the workspace directory

This is already the right direction in `_repos/openwork/packages/server/src/server.ts`.

Open question:
- Do we need websocket proxying for `/opencode/pty` in the future? (UI doesn't currently use it.)

### Workstream 2: openwrk orchestration (run with N workspaces)

#### 2.1 Spawn openwork-server with multiple workspaces
Extend `openwrk start/serve` to pass multiple workspaces to `openwork-server`.

Implementation options:
- Repeat `--workspace <path>` flags (most direct).
- Or set `OPENWORK_WORKSPACES` env (supported by `_repos/openwork/packages/server/src/config.ts`).

Workspaces source of truth:
- `openwrk` already maintains a workspace registry in its router state.
- For serving, we need a deterministic list of local workspace paths.

Proposed CLI behavior:
- Default (backwards compatible): `openwrk serve --workspace <path>` serves one.
- New: `openwrk serve --all-workspaces` serves all registered local workspaces.
- New: allow repeating `--workspace` to serve multiple explicitly.

#### 2.2 Keep one opencode server
Do not spawn multiple opencode processes.

Instead, rely on `x-opencode-directory` routing through `openwork-server`.
This keeps CPU/memory overhead low and matches OpenWork's "living system" direction.

Risk:
- If OpenCode has global mutable state that isn't fully isolated per directory, we may see cross-workspace leakage. We must validate with E2E.

### Workstream 3: UI (share + connect + config)

#### 3.1 Share modal for local workspaces must show Workspace URL
For local workspaces, Share currently shows Server URL + token.

Update it to show:
- "OpenWork workspace URL": `${serverUrl}/w/${workspaceId}`
- "Access token"

Workspace ID sources:
- Prefer server-provided IDs (from `GET /workspaces` once it returns all).
- Optional fallback: compute on host client using the same `sha256(path)` algorithm as `_repos/openwork/packages/server/src/workspaces.ts`.

#### 3.2 Remote connect should support workspace selection
When connecting to a Server URL (not a Workspace URL):
- Fetch `GET /workspaces` and let the user pick.

When connecting to a Workspace URL:
- The UI should treat it as already scoped and skip selection.

#### 3.3 Config vs Settings stays clean
Keep global app behavior in Settings; keep workspace-scoped controls in Config (already started in `packages/app/src/app/pages/config.tsx`).

### Workstream 4: Chat Access rename (UX + docs)

#### 4.1 UI copy
Replace "Messaging Bridge" with "Chat Access":
- Header labels
- Warnings ("bridge is offline" -> explain cause/action)
- "requires desktop app" messages

Replace "bridge" phrasing with cause + next action:
- "Chat Access is unavailable because the host isn't running Owpenbot. Start the host to activate Telegram/Slack."

Add an inline "How it works" disclosure (2-3 bullets) and move advanced knobs behind an "Advanced" fold.

#### 4.2 Documentation
Make docs match UI:
- Update `_repos/openwork/packages/owpenbot/README.md` to lead with what/where/why.
- Update `_repos/openwork/README.md`, `_repos/openwork/VISION.md` to use "Chat Access".
- Add a short section in `_repos/openwork/ARCHITECTURE.md` describing Owpenbot with the standard explainer + a diagram.

#### 4.3 Developer simplicity
Internal naming cleanup plan (optional but high leverage):
- Prefer "connector" over "bridge" in internal code concepts.
- Consider splitting large owpenbot modules into focused files.

## Success criteria

### User success
- A user shares a workspace link from the host UI.
- A second device connects directly to that workspace URL.
- Two workspaces can be used concurrently without switching/activating.
- A user sets up Telegram in <2 minutes without needing to understand the word "bridge".

### Developer success
- A new contributor can answer "where does inbound WhatsApp go?" in <5 minutes by following the Chat Access docs and module layout.

## Test plan

### Server + openwrk smoke
- Start host with 2 local workspaces.
- Verify:
  - `GET /workspaces` returns 2 items.
  - `GET /w/<id>/status` returns the correct workspace.
  - `GET /w/<id>/opencode/path` (or another lightweight endpoint) yields the correct directory context.

### UI E2E (Chrome MCP)
Required flows:
- Host UI shows Share modal for workspace A with a Workspace URL.
- "Connect to server" supports selecting workspace A vs B.
- Switching between remote workspaces does not require mutating a global token.

## Rollout
- Ship server changes first (API support, openwrk orchestration).
- Update UI share/connect flows.
- Add guardrails (clear copy about token scope, LAN-only guidance).

## Risks and mitigations
- Cross-workspace state leakage in OpenCode instance handling.
  - Mitigation: E2E with concurrent tasks across two directories; validate sessions isolation.
- Security: one token grants access to all workspaces.
  - Mitigation: strong UX warnings + future per-workspace tokens.
- Increased complexity in connect flow.
  - Mitigation: encourage Workspace URL sharing; keep Server URL connect as advanced path.

## Open questions
- Should `GET /status` continue to embed only the active workspace, or include a small "workspaces" list?
- Do we require mounted aliases for all `/workspace/:id/*` endpoints (Option B), or can we keep absolute paths only (Option A)?
- Should the server support workspace-friendly query selection (e.g. `/opencode?...workspaceId=`), or keep `/w/:id/opencode` as the only supported selector?
