# OpenWork + OpenCode Multi-Workspace + Runtime Topology (Dev Head)

## Summary
- OpenCode scopes every API request by `directory` and caches Instances per directory, so one `opencode serve` can safely handle multiple project roots.
- OpenWork desktop persists a local workspace list with local + remote entries; remote workspaces can target either OpenCode servers or OpenWork servers.
- The `openwrk` headless CLI is the daemon/router for multi-workspace host mode. It keeps one OpenCode process alive, switches directories via the API, and can spawn OpenWork server + Owpenbot.
- MCP quick-connect in the OpenWork UI is host-only because it edits local `opencode.json` and shells out to `opencode mcp auth`.
- Messaging bridge (Owpenbot) runs on the machine where it is started and connects to whatever `OPENCODE_URL` is configured.

## Repo State
- OpenWork submodule: `c0b2632` (origin/dev).
- OpenCode submodule: `e70d984` (origin/dev).

## OpenCode Multi-Directory Model
- The OpenCode server reads `directory` from the query/header and uses `Instance.provide` to scope requests; `path.get` returns the resolved directory/worktree so clients can discover roots.
- `Project.fromDirectory` derives a project ID from the git root commit and tracks multiple sandboxes (directories) in `Project.sandboxes`.
- `Worktree.create` generates a git worktree under `Global.Path.data/worktree/<projectId>` and registers it as a sandbox. Worktrees can be created/listed/removed via Experimental API routes.

## OpenWork Desktop Workspace Model
- Workspace state is local-only (stored under app data at `openwork-workspaces.json`) and supports `WorkspaceType` = local/remote, with `RemoteType` = opencode/openwork for remote entries.
- Local workspaces create a folder + `.opencode/openwork.json` for authorized roots; remote workspaces store `baseUrl` + `directory` + display name.
- When connecting to a remote OpenCode workspace, the UI calls `path.get` to discover the server-side directory if none is supplied.
- Host mode supports two runtimes: direct (spawn `opencode serve`) or `openwrk` (daemon-managed, multi-workspace routing).

## openwrk Daemon + OpenWork Server + Owpenbot
- `openwrk` (packages/headless) is the CLI-first host orchestrator. `openwrk start` spawns:
  - OpenCode server (`opencode serve`)
  - OpenWork server (`openwork-server`)
  - Owpenbot (WhatsApp/Telegram bridge)
- `openwrk daemon` is a router that keeps a single OpenCode process alive and exposes a small HTTP API to add/switch workspaces. It uses `directory` to target per-workspace requests (including `path.get` and `instance/dispose`).
- Desktop runtime `EngineRuntime::Openwrk` spawns the daemon, then starts OpenWork server and Owpenbot using the OpenCode base URL + credentials returned by the daemon.

## MCP + Messaging Bridge Locality
- OpenWork MCP quick-connect is gated to host mode and Tauri because it:
  - reads/writes local `opencode.json`
  - runs `opencode mcp auth` via the local CLI
- MCP servers of type `stdio` execute on the same machine as the OpenCode server (they are launched by OpenCode), so a remote OpenCode host cannot use a client-only bridge unless it is also installed on that host.
- Owpenbot runs wherever it is started (desktop host or `openwrk` host). It connects to the configured OpenCode URL; remote/local behavior depends on that URL, not the client device.

## Sources
- openwork packages/headless/README.md
- openwork packages/headless/src/cli.ts
- openwork packages/server/README.md
- openwork packages/server/src/server.ts
- openwork packages/server/src/mcp.ts
- openwork packages/desktop/src-tauri/src/types.rs
- openwork packages/desktop/src-tauri/src/workspace/state.rs
- openwork packages/desktop/src-tauri/src/commands/workspace.rs
- openwork packages/desktop/src-tauri/src/commands/engine.rs
- openwork packages/desktop/src-tauri/src/openwork_server/mod.rs
- openwork packages/desktop/src-tauri/src/owpenbot/spawn.rs
- openwork packages/owpenbot/README.md
- openwork packages/owpenbot/src/opencode.ts
- openwork packages/app/src/app/context/workspace.ts
- opencode packages/opencode/src/server/server.ts
- opencode packages/opencode/src/project/project.ts
- opencode packages/opencode/src/project/instance.ts
- opencode packages/opencode/src/worktree/index.ts
- opencode packages/opencode/src/server/routes/experimental.ts
- opencode packages/opencode/src/cli/cmd/serve.ts
