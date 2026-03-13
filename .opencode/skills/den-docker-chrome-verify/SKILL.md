---
name: den-docker-chrome-verify
description: |
  Start the Den Docker stack and verify the local Den flow through the browser.

  Triggers when user mentions:
  - "verify den"
  - "den docker flow"
  - "test den signup"
  - "den chrome mcp"
---

## Quick Usage

Run from the OpenWork repo root:

```bash
cd _repos/openwork
./packaging/docker/den-dev-up.sh
```

This prints:
- local Den web URL
- local Den API URL
- runtime env file path
- exact teardown command

## Required Browser Flow

Use Chrome MCP after the stack is healthy.

1. Open the printed Den web URL.
2. Sign up with a fresh local email.
3. Confirm the authenticated session loads.
4. Create a worker from the local Den flow.
5. Confirm the API returns the expected user and worker state.

## Minimum Evidence

- One screenshot after sign-up succeeds.
- One screenshot after worker creation succeeds.
- If browser automation fails, capture the blocking step and verify the same flow via HTTP.

## Suggested Verification Checklist

- `GET /health` returns `200`.
- Sign-up route succeeds.
- Session check succeeds.
- Worker create route succeeds.
- Browser shows the expected authenticated state.

## Cleanup

Use the exact `docker compose -p ... down` command printed by `den-dev-up.sh`.
