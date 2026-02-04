---
name: openwork-chrome-mcp-testing
description: |
  Use Chrome MCP to verify OpenWork UI flows, especially any feature that touches remote behavior.

  Triggers when user mentions:
  - "test with chrome mcp"
  - "ui verification"
  - "remote behavior test"
---

## Quick Usage (Already Configured)

### 1) Start headless + web UI (default pairing)

```bash
mkdir -p /tmp/openwork-headless-test
nohup pnpm --filter openwrk dev -- start --workspace "/tmp/openwork-headless-test" > /tmp/openwrk-headless.log 2>&1 &
nohup pnpm dev:web > /tmp/openwork-dev-web.log 2>&1 &
```

### 2) Connect the UI to headless via Chrome MCP

- Open `http://localhost:5173/`.
- Go to Settings -> Remote.
- From `/tmp/openwrk-headless.log` copy:
  - OpenWork server URL (example: `http://127.0.0.1:8787`)
  - Client token
- Click **Test connection** and confirm **Connected**.
- Confirm Debug shows **OpenCode Engine: Connected** and **OpenWork Server: Ready**.

### 3) Test the feature in the UI

- Navigate to the relevant screen.
- Perform the feature flow end-to-end.
- If the change touches remote behavior, verify the remote effect is visible in the UI.

### 4) Capture evidence

- Take a Chrome MCP snapshot.
- Pull console logs with Chrome MCP.
- Attach logs if something fails:
  - `/tmp/openwrk-headless.log`
  - `/tmp/openwork-dev-web.log`

## Required Gate (Non-Negotiable)

- Any feature that changes remote behavior MUST be validated through Chrome MCP.
- The feature is NOT done until the UI action succeeds in the browser via Chrome MCP.
- If Chrome MCP validation is skipped, the change is considered incomplete and must not be merged.

## Common Gotchas

- If OpenCode Engine stays disconnected, ensure the OpenWork URL is clean and the client token is correct.
- If you see CORS errors, check OpenWork server CORS headers for custom OpenCode headers.
