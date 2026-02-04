---
name: mcp-arch
description: |
  Explain how MCP is wired between OpenWork, OpenCode, and the OpenWork server, and guide config or auth troubleshooting.

  Triggers when user mentions:
  - "mcp wiring"
  - "mcp architecture"
  - "mcp config"
---

## Quick Usage (Already Configured)

### Provide wiring overview
- OpenWork UI uses the OpenCode SDK for runtime MCP calls and events.
- MCP config lives in `opencode.json` under `mcp`; OpenWork server only reads/writes config for remote clients.
- MCP auth tokens are managed by OpenCode and stored outside the repo.
- Remote UI traffic hits the OpenWork server at `/opencode/*`, which proxies to OpenCode.
- The OpenWork server must include the workspace directory (via `x-opencode-directory` or `directory` query) so OpenCode loads the correct config.

### Troubleshoot auth errors
- Confirm the MCP entry type and required fields (`local` needs `command[]`, `remote` needs `url`).
- If refresh tokens are invalid, re-auth via OpenCode and reload the engine after config edits.
- Avoid editing token files directly; use OpenCode commands or endpoints.
- If the UI says "does not support OAuth", verify the directory matches the on-disk `opencode.json` path.
- In remote mode, OpenWork approval gates apply for `mcp.add` and `engine.reload` unless auto-approve is explicitly enabled.

## Common Gotchas

- Engine reload only re-reads config; it does not refresh OAuth tokens.
- Remote clients need OpenWork server for config writes, but MCP runtime still routes through OpenCode.
- macOS can resolve temp paths as `/private/tmp/...` while config is under `/tmp/...`; normalize before calling MCP endpoints.

## First-Time Setup (If Not Configured)

1. Add the MCP entry to `opencode.json`.
2. Restart or reload the OpenCode engine.
3. Authenticate the MCP provider via OpenCode.
