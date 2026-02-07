---
title: Minimal host contract + sandboxing for OpenWork (nanoclaw-style)
description: Define a portable OpenWork Host contract (local-first, cloud-ready) with deploy adapters (SSH, PaaS, managed) and optional OS isolation (Apple Container/Docker). Include tool-provider routing (browser/files) and an analysis of replacing OpenWork server with pure OpenCode.
---

## Summary
OpenWork is an open-source alternative to Claude Cowork (see `_repos/openwork/AGENTS.md`). OpenCode is the engine; OpenWork is the experience layer.

This PRD proposes a *nanoclaw-style* architecture for OpenWork that stays minimal while becoming cloud-ready:
- Define a stable **OpenWork Host contract** (API + auth + persistence + capability advertisement).
- Implement **deploy adapters** that satisfy that contract (SSH box, Railway/Render-style PaaS, managed infra), without lock-in.
- Treat **sandboxing** as an optional runtime backend (containers/VMs) that shrinks blast radius, not as the product abstraction.
- Add **tool-provider routing** so capabilities like browser automation and file access can live either inside the sandbox or on a host/client machine.
- Keep the glue small: `openwrk` orchestrator + `openwork-server` control-plane remain thin.

It also includes a candid analysis of whether OpenWork server (`packages/server`) can be replaced by a "pure OpenCode" approach.

## Product principles (explicit)
These are the architectural goals this PRD optimizes for.

- Local-first, but cloud-ready: OpenWork works on your machine in one click; you can instantly run a task. The same setup can be deployed to a server.
- Pick and choose: desktop app, messaging connectors (WhatsApp/Slack/Telegram), and a server are composable. Users adopt only what they need.
- Ejectability: OpenWork is powered by OpenCode; anything you can do in `opencode` should work with OpenWork, even if the UI does not cover it yet.
- Sharing is caring: once your setup works solo, a single command (or a single button) creates an instantly shareable instance.
- Security is a core feature: least-privilege by default, explicit approvals for remote writes, auditable changes, and optional OS-level isolation.

## Core abstraction (what scales)
"Containers" are not the abstraction. The abstraction is:

- **OpenWork Host**: a composition of small services that exposes one stable, remote-safe control surface.
- **Deploy adapter**: a way to instantiate an OpenWork Host on a target environment (local machine, SSH server, PaaS, managed).
- **Tool providers**: optional capability sidecars (browser, file sync, secrets) that can run in different places and be routed to.

If we keep those three layers clean, we can stay minimal and still support: local-first, remote sharing, PaaS deployment, and managed hosting.

### Component roles (one edge, many workers)
To keep things Unix-like *and* understandable, we draw a hard line between:

- **Edge / control plane**: what clients talk to.
- **Workers**: internal processes started by a supervisor.

Recommended dependency direction:

```
Clients (Desktop/Web/Mobile)
  -> openwork-server (edge: auth + approvals + audit + config APIs)
      -> /opencode/*  -> opencode (engine, internal)
      -> /owpenbot/*  -> owpenbot (connectors, internal)

openwrk (supervisor/init)
  -> starts opencode + openwork-server + owpenbot
  -> chooses ports, writes env, manages sandboxing
```

This keeps the system composable:
- You can run the workers manually for debugging.
- UIs only need one base URL (`openwork-server`).
- We can swap runtimes (host vs sandbox) without changing the client contract.

## Implementation status (as of 2026-02-07)
This PRD covers both shipped behavior and planned work. This section tracks what is implemented in `_repos/openwork` and what remains.

Done (merged on `dev`):
- Host contract endpoints are implemented in `openwork-server`, including `/health`, `/status`, `/capabilities`, `/workspaces`, `/workspace/:id/events`, `/workspace/:id/engine/reload`, `/workspace/:id/export` + `/workspace/:id/import`.
- Scoped token management exists (`/tokens`, scopes: `owner|collaborator|viewer`) and approvals retain a distinct host boundary (`X-OpenWork-Host-Token` or `owner` bearer token).
- File injection + artifacts are implemented (`POST /workspace/:id/inbox`, `GET /workspace/:id/artifacts`, `GET /workspace/:id/artifacts/:artifactId`).
- Toy OpenWork UI is served by `openwork-server` (`/ui`, `/w/:id/ui`, `/ui/assets/*`) and exercises: session creation, SSE, approvals, inbox upload, artifacts download, and connect artifact JSON (`openwork.connect.v1`).
- Sandbox host mode exists in `openwrk` (Docker backend) and validates the host contract via `openwrk ... --sandbox docker --check`.

Done (implemented, pending merge):
- One-edge owpenbot surface: `openwork-server` proxies owpenbot under `/owpenbot/*` and `/w/:id/owpenbot/*`, so clients only need the edge URL (tracked in different-ai/openwork PR #499).
- Owpenbot onboarding/config flows moved off interactive CLI calls:
  - WhatsApp QR is fetched via `GET /owpenbot/whatsapp/qr` (UI renders; no stdout parsing).
  - Telegram token is set via `POST /owpenbot/config/telegram-token`.
- Sandbox keeps owpenbot internal (no extra published owpenbot port); `/owpenbot/health` remains reachable through the edge.

Left to do:
- Validate Apple Container backend end-to-end (`openwrk --sandbox container --check`) on a machine with the `container` CLI installed; document/runtime-fix any backend-specific mount + networking quirks.
- Deploy adapters: implement `openwrk deploy ssh` (Linux-first) and a minimal PaaS template (Railway/Render) so “deploy” returns the same connect artifact as local.
- Sharing UX in the primary clients (Desktop/Mobile/Web): QR/deeplink-first sharing (avoid manual token copy/paste), plus optional invite-code exchange hardening.
- Tool-provider routing (browser placement + client-machine provider) beyond basic capability advertisement.
- Owpenbot “TTY-first” operator UX (`owpenbot` as TUI) to manage channels/bindings via the local API (optional, but matches the PRD’s connector contract direction).

## Why this exists
OpenWork today is intentionally sidecar-composable (see `_repos/openwork/INFRASTRUCTURE.md`):
- `openwrk` orchestrates `opencode` (engine) + `openwork-server` (filesystem-backed config + approvals + proxy) + optional `owpenbot` (messaging).
- These processes run directly on the host OS and typically have access to the host toolchain and filesystem.

That is powerful, but it expands blast radius:
- The OpenCode tool surface includes high-power primitives (e.g., shell execution). Even with app-level permissions, a mistake or prompt-injection can do real damage.
- Remote clients add another dimension: you want strong guarantees that a remote operator cannot silently escalate beyond the intended workspace.

We want the best part of NanoClaw's minimal philosophy: strong sandboxing by default, achieved with a tiny amount of glue.

## OpenWork Host contract (portable + composable)
This is the core of "local-first, cloud-ready".

An **OpenWork Host** is any environment that can run:
- OpenCode (engine)
- OpenWork server (remote-safe control plane)
- optional connectors (owpenbot, Slack, etc.)

and expose one stable surface to clients.

### Single public surface
Principle: clients should connect to **OpenWork server**, not directly to OpenCode (or owpenbot).

OpenWork server already exists for this purpose (see `_repos/openwork/packages/server/README.md`):
- It proxies OpenCode under `/opencode/*`.
- It proxies owpenbot under `/owpenbot/*`.
- It provides filesystem-backed endpoints for skills/plugins/commands/MCP.
- It gates writes with a host-only approval token.

This becomes the *contract*:
- A host advertises a **base URL** (e.g., `https://host.example.com`).
- Clients use that base URL for:
  - health
  - capabilities
  - workspace addressing
  - OpenCode proxy
  - owpenbot proxy

Implication (keep it minimal, Unix-like):
- Multiple internal processes may exist, but there is exactly **one public network surface**.
- OpenCode and owpenbot bind to loopback only (host or sandbox loopback) and are reached via `openwork-server`.
- The desktop app and any other clients only need one URL and one auth model.

### URL layout (shareable instance)
OpenWork should treat a "shareable instance" as:

- **Host URL**: `https://host`
- **Workspace URL**: `https://host/w/<workspaceId>`

Where:
- `workspaceId` is stable (derived from path or configured) and allows multi-workspace hosting.
- The workspace URL is what users share.

### Host API contract (v1)
The goal is not to invent new APIs, but to codify a stable set that all adapters (local/SSH/PaaS/managed) can provide.

Existing OpenWork server endpoints already cover most of this (see `_repos/openwork/packages/server/README.md`).

Minimal required endpoints:
- `GET /health`
  - Purpose: fast liveness + version.
  - Must not require auth.
- `GET /status`
  - Purpose: richer diagnostics for the UI.
  - May require auth depending on policy.
- `GET /capabilities`
  - Purpose: feature detection + graceful degradation.
- `GET /workspaces`
  - Purpose: list workspaces and the active workspace id.
  - The UI uses this to build a stable workspace URL (`/w/<id>`).
- `GET /workspace/:id/events`
  - Purpose: server-side reload/engine/config events for clients.
- `POST /workspace/:id/engine/reload`
  - Purpose: force OpenCode to re-read config after changes.
- `GET /workspace/:id/export` / `POST /workspace/:id/import`
  - Purpose: portability (move config between hosts).
- Proxy: `/opencode/*`
  - Purpose: the client can treat the host as its OpenCode base URL without learning the upstream.
- Proxy: `/owpenbot/*`
  - Purpose: clients can configure connectors / onboarding flows without talking to a separate owpenbot port.

Recommended for Toy OpenWork (minimal UI):
- `GET /ui` and `GET /w/:id/ui`
  - Serve a minimal web UI (static assets) for zero-install sharing and experimentation.
- `GET /ui/assets/*`
  - Static JS/CSS assets for the Toy UI.

Recommended additional endpoints (to support sharing + portability cleanly):
- `POST /tokens` (host)
  - Create scoped share tokens (viewer/collaborator/owner).
- `GET /tokens` / `DELETE /tokens/:id`
  - List/revoke tokens.
- `POST /workspace/:id/inbox`
  - Upload/inject files into the remote workspace (see file injection).
- `GET /workspace/:id/artifacts`
  - Enumerate outputs for download/share.
- `GET /workspace/:id/artifacts/:artifactId`
  - Download a specific artifact.

### Owpenbot (connectors) contract (server-first, config-driven)
Owpenbot is an interface layer on top of OpenCode (Telegram/WhatsApp/Slack). The minimalness goal is:

- owpenbot does not "onboard" during orchestrator startup (no QR spam on stdout).
- owpenbot exposes a small **local control API** (HTTP) that UIs can consume.
- `openwork-server` is the only public edge: it proxies that owpenbot API under `/owpenbot/*`.

#### CLI shape
Owpenbot should split into:
- `owpenbot` (TTY-first): launches a TUI that talks to the owpenbot local API.
- `owpenbot serve`: runs headless (API server + adapters), suitable for `openwrk` and Desktop.

Compatibility rule:
- Keep `owpenbot start ...` as an alias for `serve` so existing orchestrators/sidecars continue to work.
- If `owpenbot` is launched with no TTY (stdio piped), it should behave like `serve` (quiet).

Sidecar integration rule:
- `openwrk` and the Desktop app should not shell out to interactive owpenbot subcommands (like printing QR) as part of startup.
- UIs should call `openwork-server` (either workspace-scoped endpoints or `/owpenbot/*` proxy) to:
  - fetch a WhatsApp QR payload
  - enable/disable channels
  - set tokens
  - manage bindings

This preserves the "one edge server" contract and avoids brittle stdout parsing.

#### Defaults
All adapters should be **disabled by default** and only enabled by config or explicit API calls.

This avoids accidental onboarding UX and keeps the system composable:
- UIs (desktop/web/TUI) decide when to trigger onboarding.
- The bridge stays stable and can run unattended.

#### Minimal owpenbot API surface (internal)
Owpenbot should bind to loopback only and expose endpoints like:
- `GET /health`
- `GET /config/*` and `POST /config/*` (enable/disable channels, set tokens)
- `GET /whatsapp/qr` (returns QR payload for UI rendering)

These are intentionally local-only. The remote-safe surface is the OpenWork Host contract.

#### One edge server (why proxy matters)
If clients can reach `/owpenbot/*` via `openwork-server`, then:
- the public port list stays minimal (usually just `8787`)
- auth/approvals/audit are centralized in `openwork-server`
- owpenbot can stay simple and Unix-like (local API + config)

Versioning rule:
- Capabilities must include `schemaVersion` and `serverVersion` so clients can gate behavior.

### Auth model (minimal, but extensible)
Today OpenWork server uses:
- `Authorization: Bearer <clientToken>` (remote client access)
- `X-OpenWork-Host-Token: <hostToken>` (host-only approvals + admin writes)

The minimal extension we should plan for (without building a new auth system) is **token scopes**:
- `owner`: can approve + mutate config
- `collaborator`: can run sessions + upload/inject files into workspace
- `viewer`: can view session history + artifacts

This can start as a simple server-side mapping of token hash -> scope, stored in the same config dir as the server config.

### Capability advertisement
Every client needs to know what is actually available (especially on cloud/PaaS).
The host contract should include a stable capabilities object returned by `GET /capabilities` that covers:

- config surfaces: skills/plugins/mcp/commands read/write
- approvals: manual/auto, timeout
- sandbox: on/off, backend (`docker`, `container`, `none`)
- tool providers (see below): browser/file injection availability

The key is that the UI/clients can degrade gracefully without special casing "Railway" vs "SSH".

### Persistence contract
To be deployable anywhere, OpenWork host needs predictable persistence boundaries:

- **Workspace dir** (user project)
- **Host data dir** (engine cache/state): OpenCode caches, plugin installs, MCP auth tokens, logs
- **Server config dir** (control plane): tokens, approvals config, audit log, mount allowlist (if sandboxed)

On PaaS, this maps to a persistent volume. On SSH, it maps to directories. On managed infra, it maps to volumes/object storage.

## Tool providers (placement + routing)
Some capabilities fundamentally live on different machines depending on the user's intent.

Instead of hard-coding "browser automation" or "local files", we treat them as **providers** that the host can route to.

### Provider model
Each provider has:
- a placement: `in-sandbox` | `host-machine` | `client-machine` | `external`
- a transport: `localhost` | `unix-socket` | `tcp+mtls` | `tunnel`
- declared limits: file size, domains, download policy, etc.

The host advertises configured providers in `GET /capabilities`, and the engine uses the correct one.

### Browser automation provider (correct model)
Browser automation is *not* a single mode.

We need to support at least:
- **In-sandbox headless browser** (good for shared remotes): Playwright/Chromium inside the sandbox/container.
- **Host-machine interactive browser** (good for local-first): connect to the user's real Chrome/Arc/Brave profile on the host machine.
- **Client-machine interactive browser** (remote host, but user wants their own logged-in browser): the client runs a browser provider and the host routes calls to it.

This matches your correction: sometimes it runs in the container, sometimes it must connect to the host machine.

#### Mapping to existing building blocks (today)
OpenWork already has an adjacent ecosystem component: `@different-ai/opencode-browser`.

It supports two backends:
- Extension/native-host backend: controls a real Chromium browser (Chrome/Arc/Brave/Edge) using the user's profile.
  - Placement: `host-machine` (or `client-machine` if the client runs the provider locally).
  - Great for "local-first".
  - Not viable for PaaS in the general case.
- Agent backend (alpha): headless automation powered by Playwright (`agent-browser`).
  - Placement: `in-sandbox` or `in-host`.
  - Supports a remote TCP gateway mode (useful for tailnet/remote hosts).

This PRD's recommendation:
- Default browser provider for shared remote instances: `in-sandbox` headless.
- Offer interactive browser control only when the provider is local/trusted (host-machine or client-machine placement).

#### Security considerations
Browser automation can exfiltrate data by design. If we allow it on shared instances:
- we must scope it (allowed domains, download policy, upload limits)
- we must audit it (record navigations, downloads, uploads)
- we must expose it explicitly in capabilities ("browser enabled")

If the provider is `client-machine`, we must treat it as a user-side capability, not as a host capability.

### File injection provider (remote-safe local files)
Remote execution cannot safely interpret a user's local `file://` paths.

We need an explicit, minimal mechanism:
- **Inject**: upload or sync a file into the remote workspace ("inbox").
- **Extract**: download outputs/artifacts from the remote workspace ("outbox").

This keeps security boundaries intact while supporting "copy a workload to a server".

#### Inbox/outbox conventions (minimal)
- Inbox directory (inside workspace): `.opencode/openwork/inbox/`
- Outbox directory (inside workspace): `.opencode/openwork/outbox/`

Rules:
- The UI only uploads into inbox paths.
- The UI only offers downloads from outbox paths (plus explicit artifacts list if we implement it).
- When sandboxed, these are just normal workspace paths, so no special mount is needed.

#### Why not "mount my laptop"?
If a remote shared host can see a user's laptop filesystem, the sandbox/security story collapses.
Explicit upload is the minimal, auditable, revocable alternative.

#### Attachment vs injection
OpenWork already supports message "attachments" (embedded data URLs) for limited file types.
That is useful for multimodal model input, but it does not create a file in the workspace.

For workflows that need tools (bash/grep/build) to operate on the file, injection is required.

## Deploy adapters (how a shareable instance is created)
The deploy surface should be adapter-based so OpenWork stays portable.

### Adapter A: SSH (user-managed server)
Assumption: user has `ssh` access to a Linux machine.

Deploy steps (minimal):
- ensure runtime (Node or a single `openwrk` binary)
- provision directories (workspace + host data + config)
- populate workspace:
  - git clone, or
  - upload a snapshot (tar/rsync)
- start the host contract:
  - systemd service recommended (restart + logs)
- print/share the workspace URL + token

### Adapter B: PaaS (Railway/Render style)
Assumption: the platform runs a container (or buildpack), has env vars, and supports a persistent volume.

Deploy steps (minimal):
- publish one canonical "OpenWork Host" container image (or template repo)
- set env vars for:
  - tokens
  - workspace source (git URL or pre-baked)
  - persistence paths
- attach volume
- expose port 8787

### Adapter C: Managed (we run it)
Assumption: we run the same host contract but add a control plane.

The contract stays the same; the difference is:
- identity + org sharing
- scoped tokens + revocation
- quotas
- stronger isolation options

This preserves ejectability: users can move from managed -> SSH/PaaS without changing client behavior.

## User experience flows (local-first -> share -> deploy)
This is the minimal UX arc we want to support without forcing users into a complex mode matrix.

### First run (local-first)
- Desktop app starts a local OpenWork Host (via `openwrk` or direct spawn) with a default workspace.
- User can send a message immediately.
- The app can later prompt to choose a real workspace directory, but it should not block "first task".

### Share (no token copy/paste)
The default share action should produce:
- a **workspace URL** (`https://host/w/<id>`) and
- a **connect artifact** (QR / deep link) that includes auth.

The recipient should be able to scan/click and land in the correct workspace without manual token entry.

In addition, the share action should surface a "zero-install" option:
- a minimal web UI at `https://host/w/<id>/ui` (Toy OpenWork) so recipients can use the instance from a browser.

Implementation detail:
- If tokens must be shared, prefer QR payload or a deep link that stores auth out-of-band.
- Avoid querystring tokens when possible; a QR that encodes JSON is fine.

### Deploy to remote (single command/button)
"Deploy" uses an adapter (SSH/PaaS/managed) but returns the *same* output:
- workspace URL
- token(s)
- capabilities

This means the desktop app can show a single "Deploy" button and pick adapters under the hood.

## Connect artifact (share payload)
Define a stable, explicit payload for sharing.

Minimal JSON payload (QR):

```json
{
  "kind": "openwork.connect.v1",
  "hostUrl": "https://host.example.com",
  "workspaceId": "ws_abcd1234",
  "workspaceUrl": "https://host.example.com/w/ws_abcd1234",
  "token": "<client-token>",
  "tokenScope": "collaborator",
  "createdAt": 1730000000000
}
```

Notes:
- The payload is meant for the client app, not for a browser.
- If we later add token IDs / exchange, the payload can stop embedding the raw token.

## Toy OpenWork (minimal web UI)
Toy OpenWork is a deliberately tiny UI served by the OpenWork Host itself.

Why it exists:
- **Share with anyone** requires a zero-install experience (browser access) for many teams.
- **Experimentation harness**: for big architecture changes, we need a way to iterate on new server capabilities and UI patterns without shipping the full desktop app.
- **Contract test**: a minimal UI is the fastest way to validate that the host contract is complete across SSH/PaaS/managed.

### Design constraints
- Must be served by `openwork-server` as static assets (no Tauri, no native APIs).
- Must use the OpenWork Host contract only (OpenWork server + `/opencode/*` proxy).
- Must be capability-driven: if the host cannot do something, the UI hides/locks it.
- Keep it intentionally small; prefer progressive enhancement over broad feature parity.

### URL layout
- Host-level UI (optional): `https://host/ui`
  - Behavior: redirect to active workspace UI or prompt for workspace selection.
- Workspace-scoped UI: `https://host/w/<id>/ui`
  - Behavior: minimal session UI for that workspace.

### Authentication UX (minimal)
- Toy UI should accept an auth token via URL fragment (not querystring) and store it locally:
  - `https://host/w/<id>/ui#token=<clientToken>`
- The fragment never hits server logs. The UI reads it and sets `Authorization: Bearer <token>`.

Future hardening path:
- replace raw token fragments with a short-lived invite code exchange (`/invite/<code>` -> `/tokens`), but do not block v1.

### Minimal features (v1)
The Toy UI should be able to:
- Send a prompt and stream responses (SSE) via `/w/<id>/opencode/*`.
- Render a basic timeline of steps/tool calls (even if simplified).
- Show host status and capabilities.
- Show pending approvals and allow/deny (when using an owner token).
- Upload/inject files into the workspace inbox (if enabled).
- List/download outputs/artifacts (outbox or explicit endpoint).
- Display share info (workspace URL + connect artifact JSON).

Non-goals (v1):
- Full desktop-quality UI.
- Complex workspace management UX.
- Rich plugin/skill editors.

### Serving model (implementation concept)
`openwork-server` serves a small, versioned asset bundle:
- `GET /w/:id/ui` -> HTML shell
- `GET /ui/assets/*` -> static JS/CSS

Because it is served by the host, it automatically works for:
- SSH servers
- PaaS deployments
- managed infra

### "Bleeding edge" experimentation policy
Toy OpenWork is a place to try new host contract extensions safely:
- Add a new endpoint or capability flag.
- Implement the minimal UI to exercise it.
- Only then integrate into the main OpenWork desktop/mobile UI.

This makes large changes reversible: the experiment stays isolated to Toy UI and capability-gated endpoints.

## `openwrk deploy` design (CLI-first)
This PRD does not require implementing it yet, but the architecture should make it natural.

Command shape:
- `openwrk deploy ssh --host <user@ip> --workspace <path|git-url> [--name <name>]`
- `openwrk deploy railway --workspace <git-url> --service <name>` (or "generate template")
- `openwrk deploy render --workspace <git-url> --service <name>`

Common behavior:
- Preflight: verify target OS/arch, reachable ports, persistence availability.
- Provision: create dirs/volume, place config, set env vars.
- Start: run the OpenWork Host contract (systemd, docker, or PaaS process).
- Output: print the connect artifact JSON + render QR in TTY when possible.

Workspace transfer strategies:
- Preferred: git URL (remote clones).
- Fallback: snapshot upload (tar/rsync).
- Future: workload bundle (see file injection section) for moving a single run.

## Research: apple/container
Source: https://github.com/apple/container

### What it is
Apple's `container` is a macOS tool to create and run Linux containers as *lightweight virtual machines* on a Mac:
- Consumes and produces OCI images.
- Written in Swift and optimized for Apple silicon.
- Uses the `Containerization` Swift package for low-level container/image/process management.

### Key architecture details (relevant to OpenWork)
From `docs/technical-overview.md`:
- Unlike the "shared Linux VM" model (common with Docker Desktop), `container` runs **a lightweight VM per container**.
- It integrates with:
  - Virtualization framework (Linux VM management)
  - vmnet (virtual network)
  - XPC (IPC)
  - launchd (service management)
  - Keychain (registry credentials)
  - Unified logging
- CLI talks to a launch agent, `container-apiserver`, which in turn starts helpers:
  - `container-core-images` (image mgmt + content store)
  - `container-network-vmnet` (network)
  - Per-container `container-runtime-linux` (runtime helper)

### Why this matters
If OpenWork wants a strong sandbox boundary on macOS without requiring Docker Desktop, Apple Container provides:
- VM-grade isolation per execution boundary.
- Explicit host-data sharing via mounts (privacy by default).
- A standard OCI interface, so the same images can run on other runtimes.

### Requirements / limitations (must design around)
From `README.md` and `docs/technical-overview.md`:
- Hardware: Apple silicon.
- OS: supported on **macOS 26** (older versions are not supported; macOS 15 has networking limitations).
- Memory ballooning is partial: freed memory inside the guest is not necessarily returned to the host.

Implication:
- Apple Container can be a first-class backend on *supported* Macs, but OpenWork must have a Docker (or "no sandbox") fallback.

### CLI surface inventory (what OpenWork would actually use)
From `docs/command-reference.md` and `docs/how-to.md`:

- Service lifecycle (macOS only):
  - `container system start|status|stop`
- Container lifecycle:
  - `container run` (foreground or `-d` detached)
  - `container stop|kill|delete` (cleanup)
  - `container logs` (stdio + `--boot`)
  - `container stats` (basic resource visibility)
- Mounts:
  - `-v host:guest` (bind mount)
  - `--mount type=bind,source=...,target=...,readonly` (readonly binds)
- Networking:
  - `-p hostPort:containerPort[/proto]` (port publishing)
  - networks (`container network *`) on macOS 26+
- Images:
  - `container image pull|list|inspect|load|save`
  - `container build` (BuildKit-based builder VM)

This is enough for a minimal "OpenWork host in a sandbox" implementation: start runtime, run a long-lived container, port-forward OpenWork server, mount the workspace and a persistent home/cache.

## Research: gavrielc/nanoclaw (minimalness analysis)
Source: https://github.com/gavrielc/nanoclaw

NanoClaw is not "a container runtime". It's a *product architecture* that uses containers as the security boundary.

### What makes it minimal
NanoClaw repeatedly chooses the smallest option that still yields strong guarantees:

1) One host process
- A single Node.js process handles:
  - message ingestion
  - persistence (SQLite)
  - scheduling loop
  - spawning containerized agent runs

2) OS isolation over app-level permissions
- The agent runs in a container. The host only mounts what the agent should see.
- This moves the security boundary from "permission checks" to the kernel/VM boundary.

3) Small, explicit surfaces
- The container runner is intentionally a small adapter around the Apple `container` CLI:
  - build args
  - mount rules
  - stdin/stdout envelope
- IPC is file-based (atomic writes + polling), not a message bus.

4) Minimal configuration philosophy
- Very few knobs; defaults in code.
- Customization is expected to happen via code edits (the repo is small enough).

5) "Skills over features" as an anti-bloat mechanism
- Instead of accepting feature PRs that broaden the product into a platform, NanoClaw encourages contributions as *skills* that transform a user's fork.

### Concrete patterns worth copying

#### A) Mount allowlist lives outside the project root
NanoClaw stores mount allowlist at `~/.config/nanoclaw/mount-allowlist.json` and *never mounts it into containers*.
Result: the agent cannot edit the policy that constrains it.

Equivalent OpenWork direction:
- Store sandbox mount policy outside any workspace.
- Ensure the policy is not mounted into the sandbox.

#### B) Main/admin identity gets extra power; others are default-deny
NanoClaw has a concept of "main" group with elevated powers (can mount project root, can manage other groups/tasks).

Equivalent OpenWork direction:
- Host operator (or host-mode OpenWork) is the "admin" principal.
- Remote clients are non-admin by default.
- Writes are gated by explicit approval (OpenWork already has this in `openwork-server`).

#### C) Defensive integration with Apple Container quirks
NanoClaw documents and codifies runtime-specific quirks:
- Apple Container readonly mounts require `--mount ... readonly` (not `:ro`).
- With `-i`, `-e` environment variables may be lost; NanoClaw mounts a filtered env file instead.

Equivalent OpenWork direction:
- Treat container runtimes as fallible.
- Encode known limitations and use "boring" workarounds.

#### D) Concrete code anatomy (the "8 minutes" claim is real)
The project really is a handful of files; the interesting parts are directly readable:

- Host process:
  - `nanoclaw/src/index.ts`: WhatsApp I/O, SQLite persistence, polling loops, scheduler wiring, IPC watcher.
  - `nanoclaw/src/container-runner.ts`: builds mounts + spawns `container run -i --rm`, writes logs, timeout handling.
  - `nanoclaw/src/mount-security.ts`: allowlist outside project root, deny patterns, symlink resolution, forced readonly.

- Container image:
  - `nanoclaw/container/Dockerfile`: installs Chromium + `agent-browser` + `@anthropic-ai/claude-code`; runs as non-root `node`.
  - `nanoclaw/container/agent-runner/src/index.ts`: reads JSON from stdin, runs Claude Agent SDK, emits structured JSON output.
  - `nanoclaw/container/agent-runner/src/ipc-mcp.ts`: MCP server implemented as "write JSON files into a mounted directory".

If we want "OpenWork as minimal things", NanoClaw shows that the glue can be:
- ~1 runner module for sandbox lifecycle
- ~1 policy module for mounts
- the rest is product logic

### What not to copy
NanoClaw is explicitly "built for one user". OpenWork needs to be:
- more stable
- multi-workspace
- multi-client
- easier to run across OSes

We should copy the *minimal boundary mindset*, not the exact product constraints.

## Product principle alignment (OpenWork)
From `_repos/openwork/INFRASTRUCTURE.md`:
- CLI-first
- Unix-like interfaces
- sidecar-composable
- local-first
- portable config
- security + scoping

Containerization fits these principles if we treat it as:
- a packaging format for "run the host contract anywhere" (especially PaaS/managed)
- an optional runtime backend for isolation (shrink the default trust boundary)

## Goals
- Standardize the OpenWork Host contract so local/SSH/PaaS/managed hosts behave the same for clients.
- Make sharing first-class: a workspace URL is the shareable unit (`/w/<id>`), and pairing does not require manual token copy/paste.
- Add deploy adapters that can create a host on:
  - a user-managed SSH server
  - a PaaS container platform (Railway/Render style)
  - managed infra (future), without breaking ejectability
- Provide an optional "sandboxed host mode" where the host stack runs with OS isolation and minimal mounts.
- Support multiple isolation backends:
  - Apple `container` on supported macOS (Apple silicon + macOS 26)
  - Docker/Podman on Linux
  - WSL2-based Linux sandboxing on Windows (optional path)
- Keep the glue small:
  - no new daemon we own
  - no Kubernetes required
  - no bespoke message bus
- Preserve current remote-client semantics:
  - clients connect to `openwork-server`
  - `openwork-server` proxies OpenCode (`/opencode/*`) and gates writes via approvals
  - OpenCode remains usable directly (ejectability)

## Non-goals
- Building a general-purpose container platform.
- Replacing OCI standards.
- Specifying a full managed control plane (billing, orgs, SSO) in this PRD.
- Perfect hermetic builds (this is sandboxing + scoping, not Nix).

## Proposed architecture

### Current (today)
`openwrk` spawns 2-3 host processes:
- `opencode serve` (engine)
- `openwork-server` (proxy + filesystem-backed config + approvals)
- optional: `owpenbot` (messaging bridge)

### Proposed (sandboxed host mode)
Add a "Sandbox Runtime" abstraction to `openwrk`:

```
openwrk (host)  --->  sandbox runtime (container|docker)
                         |
                         | runs
                         v
                    Linux VM/container
                    - opencode
                    - openwork-server (proxying opencode)
                    - owpenbot (optional)
```

Key idea: the sandbox boundary encloses the entire "agent execution environment".

### Detailed start sequence (high-level)
1) `openwrk start --sandbox auto --workspace /path/to/ws`
2) `openwrk` resolves sandbox backend:
   - if Apple Container supported and installed: use it
   - else if Docker installed: use it
   - else: fall back to current host-mode spawn
3) `openwrk` resolves sidecar *target for the sandbox* (Linux target), not host:
   - macOS Apple silicon + Apple Container -> `linux-arm64`
   - Linux x64 + Docker -> `linux-x64`
4) `openwrk` downloads Linux sidecar binaries (opencode/openwork-server/owpenbot) to its sidecar dir.
5) `openwrk` generates an entrypoint script that starts the three processes inside the sandbox.
6) `openwrk` runs a single long-lived container/VM:
   - mounts workspace
   - mounts a persistent sandbox home/cache dir
   - publishes ports
7) `openwrk` waits for `openwork-server /health` to become healthy and prints pairing details.

### Why one sandbox for the whole stack (recommended)
We want minimalness:
- One sandbox boundary is easier to reason about.
- OpenWork server can proxy OpenCode at `http://127.0.0.1:<port>` inside the sandbox.
- Only one set of mounts (workspace + caches).

Alternative (not recommended initially): separate sandboxes per service. It increases complexity and is the opposite of NanoClaw's "few moving parts" principle.

## Sandbox runtime: interface
`openwrk` adds a small backend interface:
- `ensureRuntimeReady()` (e.g., `container system start`)
- `runDetached(name, image, args, mounts, env, ports)`
- `stop(name)`
- `logs(name)`
- `status(name)`

Backends:
- Apple Container backend (uses `container` CLI)
- Docker backend (uses `docker` CLI)

The backend lives in `openwrk` only. Remote clients and `openwork-server` remain unchanged.

## Sandbox image strategy
We need a Linux environment to run Linux sidecars.

Two viable strategies:

### Strategy A (most minimal): "base runtime image" + mounted sidecar binaries
1) `openwrk` downloads **Linux** sidecar binaries (opencode/openwork-server/owpenbot).
2) `openwrk` mounts the sidecar directory into the sandbox.
3) A tiny entrypoint script inside the sandbox runs the sidecars.

Pros:
- No per-version container image publishing required.
- Keeps the host build pipeline closer to what already exists (sidecar manifests).

Cons:
- The base image must contain whatever dynamic libs the sidecars need.
- Need a small init/supervisor in the sandbox to keep processes alive and handle SIGTERM.

### Strategy B: build/publish an OCI image per OpenWork version
Build `ghcr.io/different-ai/openwork-host:<version>` containing:
- opencode + openwork-server + owpenbot (Linux binaries)

Pros:
- Simplest runtime: pull image, run.

Cons:
- Adds a new artifact type and release complexity.
- Harder to support dev overrides.

Recommendation: start with Strategy A.

### How Strategy A stays minimal (no custom image per release)
The most "NanoClaw-like" approach is to treat the sandbox as just a Linux environment plus mounts:
- Use a stable base image (e.g., Debian slim) that contains:
  - `bash` (or `sh`) + core utils
  - `ca-certificates`
  - optionally `git` and `curl` (useful for agent flows)
- Mount the Linux sidecar binaries into `/sidecars`.
- Mount a generated `entrypoint.sh` into the container.
- Run `bash /entrypoint.sh`.

This avoids publishing a new OCI image for every OpenWork version, while still keeping the runtime deterministic.

## Mount policy (copy NanoClaw's security posture)

### Default mounts
- Workspace root (required).
- OpenWork/OpenCode persistent data directory (recommended).

### Data that should persist across restarts
OpenCode and OpenWork often rely on host-side caches/state:
- plugin installs / node_modules cache
- MCP auth tokens
- logs, audit

In sandboxed mode, these should be persisted by mounting a host directory:
- host: `~/.openwork/sandbox/<workspaceId>/` (example)
- container: `/var/lib/openwork/` and/or `/home/<user>/.cache/*`

Exact paths should be aligned to how OpenCode stores state today.

### Mount allowlist + denylist
Adopt NanoClaw's pattern:
- Allowlist is stored outside the workspace and never mounted.
- Denylist includes obvious secret-bearing paths (e.g., `.ssh`, `.aws`, `.gnupg`, `.env`).

Where to store it:
- host: `~/.config/openwork/sandbox-mount-allowlist.json`

What drives it:
- For OpenWork, the UI already has a concept of authorized roots.
- The sandbox allowlist should be the *physical enforcement* of that policy.

## Networking / ports
In sandboxed mode, we expose only the minimum host ports:
- `openwork-server`: host port 8787 (or configured)

OpenCode:
- Ideally, OpenCode does not need a host-facing port in sandboxed mode.
- `openwork-server` can proxy `/opencode/*` internally.

Owpenbot:
- Ideally, owpenbot does not need a host-facing port either.
- `openwork-server` proxies `/owpenbot/*` internally to owpenbot's loopback API.

This reduces exposed attack surface.

### Example Apple Container invocation (illustrative)
This is a *design sketch*, not final syntax:

```bash
container system start

container run -d --rm --name openwork-sandbox \
  -p 8787:8787 \
  -v /abs/workspace:/workspace \
  -v /abs/persist:/home/openwork \
  -v /abs/sidecars:/sidecars:ro \
  --mount type=bind,source=/abs/entrypoint.sh,target=/entrypoint.sh,readonly \
  debian:bookworm-slim \
  bash /entrypoint.sh
```

Docker would be analogous:

```bash
docker run -d --rm --name openwork-sandbox \
  -p 8787:8787 \
  -v /abs/workspace:/workspace \
  -v /abs/persist:/home/openwork \
  -v /abs/sidecars:/sidecars:ro \
  -v /abs/entrypoint.sh:/entrypoint.sh:ro \
  debian:bookworm-slim \
  bash /entrypoint.sh

Optional debug-only port publishing:
- You may publish internal ports (OpenCode / owpenbot) for local debugging, but clients should not rely on them.
```

The important part is not the exact command; it's the boundary:
- only the workspace and explicit persistence are visible
- the engine and tools run *inside* that boundary

## CLI and UX changes

### openwrk flags (proposal)
- `--sandbox <mode>`: `auto | none | container | docker`
- `--sandbox-image <ref>`: base runtime image reference
- `--sandbox-persist-dir <path>`: host directory for persistent sandbox state
- `--sandbox-mount <hostPath:containerPath[:ro]>`: additional explicit mounts (validated)

Provider-related flags (proposal):
- `--browser-provider <mode>`: `auto | sandbox-headless | host-interactive | client-interactive | none`
- `--file-injection <mode>`: `auto | inbox-outbox | none`

Defaults:
- `--sandbox auto`
  - if Apple Container available + supported: use it
  - else if Docker available: use it
  - else: no sandbox

### openwrk subcommands (proposal)
These are not required to ship sandboxing, but they are the natural end state for "single command deploy".

- `openwrk share --workspace <path> [--scope collaborator]`
  - prints a workspace URL and a connect artifact (JSON + QR)
- `openwrk token create --scope <viewer|collaborator|owner>`
  - mints a token scoped to the current workspace (or host-wide)
- `openwrk token revoke <tokenId|hash>`
  - removes a token so a shared link stops working
- `openwrk deploy <ssh|railway|render|managed> ...`
  - creates a remote host instance and prints the connect artifact

### OpenWork UI
Host settings add (high-level):
- Share: show QR/deeplink + copy workspace URL
- Deploy: create a remote shareable instance using an adapter (SSH/PaaS/managed)
- Sandbox: on/off + backend selector; show what paths are mounted
- Tool providers: browser provider placement + file injection mode
- Authorized roots remain the same concept, but now map to physical mounts when sandboxed

## Security model
We want *defense in depth*:
1) Physical isolation boundary (container/VM): agent code cannot see host filesystem beyond mounts.
2) OpenWork server approvals: remote writes still require host approval token.
3) OpenCode permissions: still used for tool-level requests.

This aligns with NanoClaw's philosophy: isolation first, permissions second.

## Testing plan

### Unit / component tests (openwrk)
- Runtime detection (container vs docker vs none).
- Mount validation denylist.
- Port mapping correctness.

### Integration tests
- Start sandboxed host mode.
- Verify:
  - `GET /health` on `openwork-server` works.
  - `/opencode/*` proxy works (SSE + basic endpoints).
  - approvals flow works (remote write -> pending approval -> host approve -> mutation).

### E2E
- Remote OpenWork client connects to sandboxed host.
- Runs a simple session.
- Adds a skill/plugin via `openwork-server` and reloads engine.

## Rollout plan
Phase 0 (this PRD): align on host contract + boundaries.

Phase 1 (contract hardening):
- Ensure the OpenWork server endpoints and capabilities cover what clients need for remote parity.
- Add the connect artifact format (`openwork.connect.v1`) and make QR/deeplink the default share UX.
- Keep manual token entry as a fallback, not the primary flow.

Phase 1 must also ship a "Toy OpenWork" web UI as the contract test harness:
- Serve Toy UI from `openwork-server` (`/w/:id/ui`).
- Use it to validate:
  - streaming sessions via `/opencode/*`
  - approvals UX + host token boundary
  - inbox upload + outbox download
  - capabilities-driven feature gating
  - share artifacts (QR payload + workspace URL)

Phase 2 (sharing primitives):
- Token scopes (viewer/collaborator/owner) and server-side token management.
- Explicit file injection (inbox/outbox) + artifact download surface.

Phase 3 (deploy adapters):
- `openwrk deploy ssh` (Linux first): systemd + (binary or docker) install path.
- PaaS: publish a canonical host image and a template repo (Railway/Render) to prove portability.

Phase 4 (optional isolation):
- Sandbox runtime abstraction in `openwrk` (Docker/Podman backend first).
- Mount allowlist + denylist enforcement + persistent cache mounts.

Phase 5 (macOS isolation backend):
- Apple Container backend (where supported).

Phase 6 (tool-provider routing):
- Browser provider placement modes (headless in-host/sandbox; interactive local provider).
- Client-machine provider routing (tailnet/tunnel) if needed.

This ordering keeps rollback cheap: we ship contract + sharing first (most user-visible), and add isolation/providers behind capability checks.

## Reversibility and rollback cost
The intent is that each major capability is swappable and can be turned off without data loss.

### Design rule: keep the host contract stable
If clients only rely on the OpenWork Host contract (OpenWork server base URL + workspace URLs), we can swap internals freely.

Swap candidates (should be low-cost):
- sandbox backend: `none` <-> `docker` <-> `container`
- deploy adapter: `ssh` <-> `paas` <-> `managed`
- browser provider: `in-sandbox headless` <-> `host/client interactive` <-> `none`
- file injection: `inbox/outbox` <-> `none`

### What makes rollback cheap
- Sandbox is optional and defaults can remain "off" until stable.
- Sandbox does not change the client API surface; it changes only the process boundary.
- Deploy adapters do not change runtime behavior; they are just installers.
- Provider routing is capability-based; missing providers simply remove tools.

### What makes rollback expensive (avoid)
- Baking provider-specific logic into the client UI without capability checks.
- Treating PaaS-specific constraints as the new default (e.g., assuming ephemeral filesystem).
- Building a new auth system early and migrating tokens/identities.
- Coupling share links to infrastructure details (e.g., embedding raw tokens in URLs that end up in logs).

### Operational rollback playbooks (examples)
- Disable sandbox:
  - set `OPENWRK_SANDBOX=none` (or equivalent flag)
  - restart host
  - no client changes needed
- Move from remote -> local:
  - export workspace config (`/workspace/:id/export`)
  - run locally with `openwrk start --workspace <path>`
  - share a new connect artifact
- Stop browser automation:
  - set browser provider to `none`
  - clients lose browser tools but everything else works

### Cost estimate (engineering)
If implemented with the interfaces in this PRD:
- Swapping sandbox backend: low (one module behind `SandboxRuntime` interface).
- Swapping deploy adapter: low (separate command path).
- Swapping browser provider: medium (tool routing + provider lifecycle), but still isolated.
- Removing OpenWork server: high (requires upstream OpenCode changes). This is the one rollback-risky direction; we should not bet on it.

## Can we replace OpenWork server with a pure OpenCode approach?

### What OpenWork server does today
From `_repos/openwork/packages/server/README.md` and implementation (`packages/server/src/server.ts`):
- Filesystem-backed APIs for remote clients (skills/plugins/MCP/commands/config).
- Host approval gate for *writes*, via a distinct host token (`X-OpenWork-Host-Token`).
- Audit log for config mutations.
- Workspace scoping/authorization (authorized roots).
- Proxies the OpenCode HTTP API under `/opencode/*` and injects `x-opencode-directory` and optional OpenCode basic auth.

This is a very deliberate "patch layer" to bridge gaps in OpenCode (see `_repos/openwork/packages/app/pr/openwork-server.md`).

### What makes it hard to remove
To replace `openwork-server` entirely, OpenCode would need to provide *at least*:
- A stable, remote-safe API to create/update/delete:
  - `.opencode/skills/*`
  - `.opencode/commands/*`
  - project `opencode.json` plugin + MCP config
- A host-vs-remote approval boundary.
  - If the same remote client that requests a write can also approve it, approvals are meaningless for remote control.

OpenCode has a permissions system, but (in typical designs) permission prompts are answered by the connected client. That is not equivalent to OpenWork's host token boundary.

### Feasible "pure OpenCode" alternatives (and tradeoffs)

#### Option 1: Upstream the missing APIs into OpenCode (best long-term, highest dependency)
Work with OpenCode to add:
- filesystem-backed config endpoints (skills/commands/plugins/mcp)
- multi-client approvals or a dedicated host approval channel

If OpenCode accepts and stabilizes this surface area, OpenWork server could shrink to:
- just a proxy (or disappear)

Risk: OpenCode is not owned by OpenWork; timelines and design goals may not align.

#### Option 2: Replace OpenWork server with an OpenCode plugin (partial, still not enough)
Plugins primarily add tools/capabilities for agent execution.
They do not automatically provide a new HTTP API surface for the OpenWork UI.

Even if a plugin can mutate `.opencode/*`, you still need:
- a remote-safe way for the UI to call it
- host approvals separate from the remote client

So this does not remove the need for a control-plane server unless OpenCode supports extending its HTTP API with plugins.

#### Option 3: OpenCode-only + openwrk as a dedicated "approval client" (possible if OpenCode supports it)
In theory:
- Remote OpenWork clients connect directly to OpenCode.
- When a write-like operation is requested, OpenCode emits a permission event.
- `openwrk` (running on host) is the only entity allowed to reply to those permission events.

This requires OpenCode to support:
- multiple clients
- a way to bind "permission replies" to a trusted host identity

If OpenCode does not support this model, the remote client could self-approve.

### Recommendation
Do **not** plan on removing OpenWork server in the near term.

Instead:
- Keep `openwork-server` as the minimal patch layer.
- Make it *smaller over time* by delegating to OpenCode APIs whenever they become stable.
- Consider upstreaming missing pieces to OpenCode, but treat that as a long-term optimization.

## Open questions
- What is the minimal Linux base image that can run OpenWork's Linux sidecars reliably?
- Which OpenCode state directories must be persisted for good UX (plugins cache, MCP auth, session db)?
- Do we want to sandbox *only* tool execution, or the entire engine? (This PRD recommends the entire host stack boundary.)
- How do we handle host-only integrations (Keychain, SSH agent, local browsers) in a sandbox-first model?

## Appendix: sandbox target selection (host vs sandbox)
OpenWork already has a sidecar download system (`openwrk`) that selects binaries by target:
- `darwin-arm64`, `linux-x64`, etc.

In sandboxed mode, *the sandbox target is what matters*, not the host:
- Apple Container and Docker both run Linux userland.

Rule of thumb:
- Host = where `openwrk` orchestrator runs.
- Sandbox = where `opencode/openwork-server/owpenbot` run.

So `openwrk` must resolve:
- `hostTarget` (for itself / bundled assets)
- `sandboxTarget` (for the binaries it runs inside Linux)

This is required even on macOS, because Linux binaries are needed in the sandbox.
