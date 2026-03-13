---
name: chrome-mcp-bootstrap
description: |
  Recover or verify Chrome MCP before UI-flow testing.

  Triggers when user mentions:
  - "chrome mcp is broken"
  - "chrome mcp bootstrap"
  - "browser broker missing"
  - "cannot connect to chrome mcp"
---

## Quick Usage

Use this skill before any Chrome-driven verification when the browser connection is flaky or missing.

### 1) Check which browser path is available

- Try the browser plugin path first if the current session exposes it.
- If the plugin path is unavailable, use Chrome DevTools MCP directly.

### 2) Repair common local issues

Run these in order:

```bash
pkill -f "chrome-devtools-mcp" || true
pkill -f "/Users/$USER/.cache/chrome-devtools-mcp/chrome-profile" || true
npx @different-ai/opencode-browser install
open -a "Google Chrome"
```

If the extension path is still broken, prefer direct Chrome DevTools MCP:

```bash
npx -y chrome-devtools-mcp@latest --help
```

### 3) Minimal readiness check

- Browser plugin path: confirm `browser_status` or `browser_get_tabs` succeeds.
- Direct Chrome DevTools MCP path: confirm `initialize` and `tools/list` succeed, then open a page.

### 4) If recovery fails

- Document the exact blocker.
- Fall back to HTTP-level verification plus screenshots.
- Do not silently skip the UI verification requirement.

## Common Gotchas

- The browser extension may be loaded but its native broker may still need a full Chrome restart.
- A stale `chrome-devtools-mcp` process or profile can block new sessions.
- Remote-debugging URLs like `http://127.0.0.1:9222` only work if Chrome was started with remote debugging enabled.
- In headless mode, prefer screenshots and page text assertions over visual-only checks.
