---
title: remote-first OpenWork connection
description: Treat every OpenWork connection as a remote, local or external.
---

## Summary
OpenWork is an open-source alternative to Claude Cowork (see `AGENTS.md`).
This PRD makes the app always talk to an OpenWork server endpoint, even when it is running locally.
The only difference between local and external is who instantiates the server (desktop sidecar or a
remote host). openwrk becomes the single source of truth for runtime details, and the app always
consumes a connection descriptor from the OpenWork server.

## User intent (restated)
- The app should always behave like a remote client.
- Local and external remotes must look identical to the app.
- openwrk should publish all runtime information (OpenCode auth, owpenbot URLs, write URLs, workdir).
- The app should never need a separate “host mode.”

## Goals
- Remove app-level host/client modes; always connect to an OpenWork server.
- Local OpenWork server is just another remote (loopback) that the desktop starts.
- openwrk is the source of truth for runtime data (OpenCode auth + URLs + workspace data).
- A single “connection descriptor” API provides the app with everything it needs.
- Remote and local behave identically, with predictable reconnect logic.

## Non-goals
- Persisting runtime secrets on disk.
- Changing OpenCode APIs.
- Supporting direct OpenCode connections without an OpenWork server.
- Modifying OpenCode server or SDK behavior beyond supported config/flags.

## Definitions
- Remote: any OpenWork server endpoint (local or external).
- Local remote: an OpenWork server started by the desktop sidecar on this device.
- openwrk daemon: orchestrator that starts OpenCode/owpenbot/OpenWork server and owns runtime data.
- Connection descriptor: canonical payload the app uses to connect and render status.

## Actors and responsibilities
- `packages/app` (app client): consumes OpenWork server APIs and OpenCode SDK using the descriptor only.
- `packages/desktop` (desktop shell): starts local sidecars so a local remote exists at app launch.
- `packages/headless` (openwrk orchestrator): starts OpenCode server + owpenbot + OpenWork server and owns runtime state.
- `packages/server` (OpenWork server): control plane that exposes `/connect/active` and config bridging APIs.
- OpenCode SDK (client library): used by the app to talk to OpenCode server, external to our control.
- OpenCode server/engine (process): external service started by openwrk, configured via flags only.
- Owpenbot (sidecar): messaging bridge started by openwrk/desktop.

## Control boundaries
- We control: `packages/app`, `packages/desktop`, `packages/headless`, `packages/server`, owpenbot.
- We do not control: OpenCode SDK behavior, OpenCode server internals.
- We only control OpenCode through config, flags, and the connection descriptor.

## Ownership matrix
| Actor | Owned | Responsibilities |
| --- | --- | --- |
| `packages/app` | Yes | Remote-only UI client, connects via descriptor |
| `packages/desktop` | Yes | Launch local remote sidecars |
| `packages/headless` | Yes | Orchestrate OpenCode/owpenbot/server + runtime state |
| `packages/server` | Yes | Descriptor + config/approvals control plane |
| OpenCode SDK | No | Client transport for OpenCode APIs |
| OpenCode server | No | Engine runtime, started/configured by openwrk |
| Owpenbot | Yes | Messaging bridge service |

## Architecture overview
### Local remote (desktop)
1) Desktop starts openwrk daemon.
2) openwrk starts OpenCode + owpenbot + OpenWork server.
3) openwrk publishes runtime to OpenWork server (in memory).
4) App connects to OpenWork server, fetches connection descriptor.
5) App uses OpenWork server for all operations (skills, plugins, approvals, commands, sessions).

### External remote
1) User enters OpenWork server URL + token.
2) App connects to OpenWork server, fetches connection descriptor.
3) App uses OpenWork server for all operations (same code path).

## Connection descriptor (server API)
Introduce a single endpoint on OpenWork server (example):

`GET /connect/active`

Payload:
```
{
  "updatedAt": 1738540000000,
  "workspace": {
    "id": "ws-abc",
    "name": "openwork2",
    "path": "/Users/benjaminshafii/openwork2"
  },
  "opencode": {
    "baseUrl": "http://127.0.0.1:51142",
    "connectUrl": "http://127.0.0.1:51142",
    "directory": "/Users/benjaminshafii/openwork2",
    "username": "openwork",
    "password": "***",
    "port": 51142
  },
  "openwork": {
    "baseUrl": "http://127.0.0.1:51140",
    "connectUrl": "http://10.0.0.184:51140",
    "token": "client-token",
    "hostToken": "host-token",
    "port": 51140
  },
  "owpenbot": {
    "healthUrl": "http://127.0.0.1:58928",
    "healthPort": 58928
  }
}
```

Notes:
- Secrets are in-memory only. The server may redact fields in logs.
- The app uses this descriptor to connect to OpenCode (via SDK) and render status.
- The app never attempts to infer runtime from Tauri state.
- OpenCode server/SDK are external; the descriptor is the only integration contract.

## openwrk responsibilities
- Maintain runtime state in memory (`/runtime`).
- On changes (engine start, restart, workspace switch), publish runtime to OpenWork server.
- Provide a restart hook (`/opencode/restart`) that desktop can call for debugging.

## App responsibilities
- Treat any OpenWork server URL as the single source of truth.
- Poll `GET /connect/active` (or subscribe) to update OpenCode connection.
- Never connect to OpenCode without a valid descriptor payload.
- Never branch UI on host/client; show “Remote status” + “Local” badge when the endpoint is loopback.
- Use OpenWork server endpoints for skills/plugins/commands/scheduled tasks.

## UI/UX changes
- Onboarding: single “Connect to OpenWork server” step.
  - Local remote: “Start local server” action uses sidecar, then connects.
  - External remote: URL + token.
- Settings: remove Host/Client toggle. Show Remote status + connection descriptor.
- Devtools: “Restart engine” action stays, but is framed as “Restart remote engine.”

## Reliability & predictability
- One code path for all sessions (local and external).
- The app does not guess or derive engine details; it always reads the descriptor.
- If the descriptor changes, reconnect OpenCode automatically.
- Use `updatedAt` to debounce redundant reconnects.

## Migration
- Replace stored host/client preferences with a single `remoteEndpoint` + `token`.
- For local installs, auto-start local remote and connect immediately.

## Test plan
- openwrk CLI tests validate `/runtime` updates and `/opencode/restart`.
- New E2E: local remote flow (openwrk -> OpenWork server -> app) through `/connect/active`.
- New E2E: external remote flow (OpenWork server already running).

## Acceptance criteria
- The app has no host/client mode switch.
- Local and external remotes use the same connection logic and UI surface.
- All engine/server/owpenbot connection data comes from `/connect/active`.
- The app only uses OpenCode SDK connections derived from the descriptor.
- openwrk updates the descriptor whenever runtime changes.
