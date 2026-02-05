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

### 1) Start headless + web UI

Use `openwork-testability` to start headless + web and connect the UI to headless:
- See `.opencode/skills/openwork-testability/SKILL.md` steps 1-3.
- Confirm Settings -> Remote shows **Connected**.
- Confirm Debug shows **OpenCode Engine: Connected** and **OpenWork Server: Ready**.

### 2) Test the feature in the UI

- Navigate to the relevant screen.
- Perform the feature flow end-to-end.
- If the change touches remote behavior, verify the remote effect is visible in the UI.

### 3) Capture evidence

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
