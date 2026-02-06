---
title: Workspace sharing (multi-server workspaces)
description: Share a workspace via an invite or raw server credentials; evolve openwrk to expose multiple workspace servers safely.
---

## Summary
OpenWork is an open-source alternative to Claude Cowork with a mobile-first, premium UX focus (see `_repos/openwork/AGENTS.md`).
We should be able to share a workspace with other people from the `...` menu next to a workspace.

This PRD proposes:
- A new **Share workspace** modal that either (a) creates a shareable invite (link/QR/share sheet) or (b) reveals the raw OpenWork/openwrk connection credentials.
- A reframe of **workspace == server endpoint** so a single openwrk instance can expose **multiple independently connectable workspace servers** (one per workspace), allowing each workspace to be accessed independently by clients.

This is intentionally a major shift: sharing becomes a first-class capability and it forces the runtime to stop assuming there is only one globally active workspace per host.

## Problem statement
- There is no product surface to share a workspace with another human (beyond ad-hoc copying URLs/tokens).
- The current remote model trends toward “one host, one active workspace” semantics. If multiple clients connect, they can collide (workspace switches, approvals, runtime state).
- Tokens/credentials are opaque: users cannot easily see what they are sharing, what it grants, or revoke it.

## Goals
- Add a simple, safe **Share workspace** flow that works on mobile and desktop.
- Make each workspace independently connectable so a single openwrk host can expose multiple workspaces without global-switch side effects.
- Support “share by invite” (preferred) and “share by credential” (manual fallback).
- Provide a clear access story: who has access, what role they have, and how to revoke.
- Preserve OpenWork principles: parity with OpenCode primitives, least privilege, transparent permissions, graceful degradation.

## Non-goals
- Real-time collaborative editing (cursors, conflict resolution) inside a single session.
- A hosted SaaS accounts system (orgs, SSO, billing) or true cloud multi-tenancy.
- Solving NAT traversal (tunnels/VPNs are allowed as an external dependency; we can document best practices).
- End-to-end encryption of traffic (HTTPS is recommended; transport hardening is phased).

## Definitions
- Workspace: a named project environment (directory + OpenCode runtime + config surfaces) reachable via an OpenWork server endpoint.
- Workspace server: an OpenWork server instance bound to exactly one workspace.
- Host manager: the openwrk control-plane that can start/stop/list workspace servers and mint invites.
- Member: an authenticated principal (token) with a role.
- Invite: an expiring or one-time token used to join a workspace.

## User experience
### Entry point
- In the workspace row `...` menu (sidebar/workspace hub): add `Share`.

### Share workspace modal
Use a two-mode modal (segmented control):

1) `Invite` (default)
- Role selector: `Viewer` (recommended default), `Operator`, `Admin` (advanced).
- Expiry selector: `1 hour`, `1 day`, `7 days`, `Never` (advanced).
- Primary CTA: `Create invite`.
- Output:
  - Copyable join link (deep link) + QR code.
  - `Share…` action uses the OS share sheet when available.
  - List active invites and members; allow revoke.

2) `Credentials` (manual)
- Show OpenWork server connect URL(s) and token (copy buttons).
- Hide secrets by default; require reveal/confirm before showing.
- Advanced: show host/admin credential separately with explicit warnings.
- Optional: `Rotate token` action (invalidates previously shared tokens).

### Join flow (recipient)
- Recipient opens a join link (or scans QR) which launches OpenWork (deep link).
- OpenWork:
  - Prompts for a workspace name (suggested by host).
  - Tests connection and shows what this grants (role + host name + workspace name).
  - Saves it as a new workspace entry and connects.

### Clear safety copy
- “Only share with trusted people. Anyone with this invite can access files and run actions within the workspace’s allowed roots.”
- If LAN-only: “This link works only on the same network (or via VPN/tunnel).”

## Functional requirements
### Sharing
- A workspace has a `Share` action.
- The share modal can create an invite, show a QR, and copy/share the join payload.
- The share modal can reveal connection credentials (URL + token).
- Owner can revoke:
  - a specific invite
  - a specific member
  - all shared access (rotate)

### Access roles (minimum viable)
- `Viewer`: read-only (can view sessions/messages/artifacts; cannot run commands; cannot modify config).
- `Operator`: can create sessions/prompts but cannot perform privileged actions (config mutations, engine reload, token rotation).
- `Admin`: can do everything the owner can, including managing members/invites.

### Workspace isolation
- A workspace connection must not be impacted by another workspace’s “active selection.”
- Multiple clients can connect to the same workspace server concurrently.

### Visibility
- Workspace list shows shared state (e.g., small “Shared” badge or member count).
- Owner can see who has access and last active time (best-effort).

## Architecture (major shift)
OpenWork already trends toward “remote-first” where the app always speaks to an OpenWork server (see `prds/remote-first-openwork.md`).
Sharing pushes this further:

### Proposed model (recommended)
**Workspace == server endpoint.**

Instead of one OpenWork server that has a global “active workspace,” openwrk can expose multiple *workspace servers* in parallel. Each workspace server:
- binds to a single workspace directory
- owns its own OpenCode server instance/connection descriptor
- has its own auth surface (members/invites)

Clients treat each workspace as an independent remote in the UI.

### Why this model
- Eliminates cross-client collisions from a global “active workspace.”
- Makes “share workspace” mechanically equivalent to “share this server endpoint.”
- Keeps parity with the remote-first descriptor contract: `/connect/active` is now scoped to the workspace server.
- Allows a single openwrk host to serve many workspaces without forcing users to run multiple daemons.

### Alternative (not recommended for v1)
Keep one OpenWork server and scope everything by `workspaceId` (multi-tenant server).
- Pros: single port, simpler networking.
- Cons: requires refactoring most server state to be per-workspace/per-member; makes collisions and authorization harder to reason about.

## System changes by component
### `packages/app` (OpenWork UI)
- Treat “workspace list” as “saved workspace server connections.”
- Add `Share workspace` menu item + modal.
- Add deep link/QR join handling.
- Persist credentials securely (OS keychain) and metadata in IndexedDB (avoid plaintext tokens in localStorage).
- Add UI for members/invites + revoke.
- Ensure connection clarity stays strong (see `prds/openwork-remote-workspace-clarity.md`).

### `packages/desktop` (Tauri shell)
- Expose OS share sheet integration for share payload.
- Ensure local openwrk host can expose LAN URLs when the user explicitly enables sharing.
- Potentially add a “Local sharing enabled” indicator and a quick way to copy the LAN join QR.

### `packages/headless` (openwrk orchestrator)
- Evolve openwrk from “single runtime” to a **workspace host manager**:
  - create/start/stop/list workspace servers
  - allocate ports per workspace server (OpenWork + OpenCode)
  - surface stable connect URLs for LAN and loopback
  - mint/revoke invites (and optionally exchange them for member tokens)
- Maintain a registry of workspaces and their runtime state.
- Provide a safe default: workspace servers bind to loopback unless sharing is explicitly enabled.

### `packages/server` (OpenWork server)
- Add an auth layer that supports:
  - member tokens with roles
  - invite exchange (one-time/expiring)
  - token revocation + rotation
- Enforce authorization per endpoint category:
  - read-only endpoints available to Viewer
  - session execution endpoints available to Operator+
  - config/engine control endpoints restricted to Admin+
- Ensure permission prompts/approvals stay safe in multi-client scenarios:
  - Viewer/Operator should not be able to auto-approve expanded permissions
  - approvals should be explicitly surfaced and attributable to a member

### `packages/owpenbot`
- Decide whether owpenbot connects as a workspace member (recommended) rather than using a host token.
- If owpenbot is enabled, ensure it is scoped to a workspace server and cannot “hop” workspaces implicitly.

## API sketch (conceptual)
This PRD intentionally does not lock exact routes, but we need two distinct surfaces:

1) Host manager API (openwrk)
- `GET /host/workspaces` -> list workspace servers and their connect URLs
- `POST /host/workspaces` -> create/start a workspace server
- `POST /host/workspaces/:id/share/invites` -> mint invite
- `POST /host/workspaces/:id/share/revoke` -> revoke invite/member

2) Workspace server API (OpenWork server)
- Existing OpenWork APIs are scoped to the workspace.
- New auth endpoints:
  - `POST /auth/exchange-invite` -> invite -> member token
  - `GET /share/members` (admin)
  - `POST /share/members/:id/revoke` (admin)
  - `POST /share/rotate` (admin)

## Storage model
- Workspace server stores:
  - workspace metadata (id, name, path)
  - access control list (members, invites, roles, expiry)
  - audit events for membership and privileged actions
- Storage location should be outside the git repo (e.g., `.openwork/`), and default to a local-only file store.

## Security requirements
- Default to loopback-only binding; explicit user action required to enable LAN binding.
- No secrets committed to git.
- Tokens are treated as bearer secrets; UI must not accidentally log them.
- Token rotation must invalidate old tokens.
- Support least-privilege roles from day one.

## Migration
- Existing “saved server” connections map directly to workspace server connections.
- If the current server model still supports multiple workspaces:
  - introduce an upgrade path that creates one workspace server per existing workspace and updates the client’s saved entries.
  - keep old endpoints temporarily for compatibility, but mark as deprecated.

## Rollout plan
1) UI-only: Share modal that reveals raw credentials and can invoke OS share sheet.
2) Host/runtime: openwrk host manager + multiple workspace servers (one host, many workspaces).
3) Auth hardening: invite exchange + roles + revocation UI.
4) Multi-client approvals: make permission prompts attributable and admin-gated.

## Testing plan
- E2E (local LAN):
  - Start openwrk with two workspaces hosted.
  - From device A, create invite for workspace 1.
  - From device B, join via QR/link and verify access.
  - Verify switching workspaces on device A does not affect device B.
- Security:
  - Viewer cannot execute prompts or change config.
  - Operator cannot rotate tokens or manage members.
  - Rotation immediately disconnects old tokens.
- Reliability:
  - Host manager restart can reconstruct workspace servers from registry.

## Open questions
- Do we need a “single port gateway” (path-based routing) to avoid multiple LAN ports, or is per-workspace port acceptable for v1?
- How do we attribute OpenCode permission prompts to a specific member when OpenCode is the engine and events are shared?
- What is the minimum acceptable role set for v1 (Viewer-only sharing vs Operator)?
- Should invites be one-time by default?
