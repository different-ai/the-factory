---
title: Minimal containerization for OpenWork (nanoclaw-style)
description: Bring OS-level isolation to OpenWork host mode by running OpenCode/OpenWork sidecars inside Apple Container (macOS) or Docker (Linux); analyze whether OpenWork server can be replaced by pure OpenCode.
---

## Summary
OpenWork is an open-source alternative to Claude Cowork (see `_repos/openwork/AGENTS.md`). OpenCode is the engine; OpenWork is the experience layer.

This PRD proposes a *nanoclaw-style* approach to containerization for OpenWork host mode:
- Use *real* OS isolation (Linux containers/VMs) as the primary security boundary.
- Keep the host orchestrator (`openwrk`) and control-plane (`openwork-server`) small.
- Prefer existing container runtimes (Apple `container` on supported macOS, Docker elsewhere) over inventing a new runtime.

It also includes a candid analysis of whether OpenWork server (`packages/server`) can be replaced by a "pure OpenCode" approach.

## Why this exists
OpenWork today is intentionally sidecar-composable (see `_repos/openwork/INFRASTRUCTURE.md`):
- `openwrk` orchestrates `opencode` (engine) + `openwork-server` (filesystem-backed config + approvals + proxy) + optional `owpenbot` (messaging).
- These processes run directly on the host OS and typically have access to the host toolchain and filesystem.

That is powerful, but it expands blast radius:
- The OpenCode tool surface includes high-power primitives (e.g., shell execution). Even with app-level permissions, a mistake or prompt-injection can do real damage.
- Remote clients add another dimension: you want strong guarantees that a remote operator cannot silently escalate beyond the intended workspace.

We want the best part of NanoClaw's minimal philosophy: strong sandboxing by default, achieved with a tiny amount of glue.

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
- a runtime backend for the existing CLI surfaces
- a way to shrink the default trust boundary

## Goals
- Provide an optional "sandboxed host mode" where the OpenWork host stack runs inside a Linux container/VM.
- Default mounts are minimal: only the selected workspace (and explicitly approved additional roots) are visible.
- Support multiple backends:
  - Apple `container` on supported macOS (Apple silicon + macOS 26)
  - Docker on Linux (and as a fallback on macOS)
- Keep the implementation small:
  - no new daemon we own
  - no Kubernetes / compose requirement
  - no bespoke RPC system
- Preserve current remote-client behavior:
  - remote clients still connect via `openwork-server`
  - `openwork-server` still proxies OpenCode (`/opencode/*`) and gates writes via approvals

## Non-goals
- Building a general-purpose container platform.
- Replacing OCI standards.
- Turning OpenWork into a multi-tenant hosted service.
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
- `owpenbot` health port: host port 3005 (if enabled)

OpenCode:
- Ideally, OpenCode does not need a host-facing port in sandboxed mode.
- `openwork-server` can proxy `/opencode/*` internally.

This reduces exposed attack surface.

### Example Apple Container invocation (illustrative)
This is a *design sketch*, not final syntax:

```bash
container system start

container run -d --rm --name openwork-sandbox \
  -p 8787:8787 \
  -p 3005:3005 \
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
  -p 3005:3005 \
  -v /abs/workspace:/workspace \
  -v /abs/persist:/home/openwork \
  -v /abs/sidecars:/sidecars:ro \
  -v /abs/entrypoint.sh:/entrypoint.sh:ro \
  debian:bookworm-slim \
  bash /entrypoint.sh
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

Defaults:
- `--sandbox auto`
  - if Apple Container available + supported: use it
  - else if Docker available: use it
  - else: no sandbox

### OpenWork UI
Host settings add:
- "Run engine in sandbox" toggle
- "Sandbox runtime" selector (Auto / Apple Container / Docker / Off)
- "Authorized roots" remain the same concept, but now map to mounts.

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
Phase 0 (this PRD): align on design + boundaries.

Phase 1: sandbox runtime abstraction in `openwrk` (Docker backend first).

Phase 2: Apple Container backend.

Phase 3: mount allowlist + persistent data mounts.

Phase 4: UI surfaces + docs + default recommendation.

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
