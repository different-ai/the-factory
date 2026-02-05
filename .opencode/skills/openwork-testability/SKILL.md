name: openwork-testability
description: |
  Make testing sending a message via the UI a core part of OpenWork testability.
  Use dev:web + headless as the default testing pairing.

  Triggers when user mentions:
  - "testability toolbox"
  - "dev:web + headless"
  - "send a message via the ui"
---

## Core sequence (required)

1. Start headless in an empty workspace (always use a non-default port):

```bash
mkdir -p /tmp/openwork-headless-test
nohup pnpm --filter openwrk dev -- start --workspace "/tmp/openwork-headless-test" --port 8788 > /tmp/openwrk-headless.log 2>&1 &
```

2. Start the web UI (always use a non-default port):

```bash
nohup pnpm dev:web -- --port 5175 > /tmp/openwork-dev-web.log 2>&1 &
```

3. Connect the UI to headless (Chrome MCP preferred):

- Open `http://localhost:5175/`.
- Go to Settings -> Remote.
- From `/tmp/openwrk-headless.log` copy:
  - OpenWork server URL (example: `http://127.0.0.1:8787`)
  - Client token
- Click **Test connection** and confirm **Connected**.

4. Create a session and send a message:

- Go to Sessions.
- Click **New Task**.
- In the chat input, type a short message (e.g., "hello from testability") and press Enter.
- Confirm the message appears in the thread.

5. Capture logs if something fails:

- `/tmp/openwrk-headless.log`
- `/tmp/openwork-dev-web.log`
- Chrome DevTools console (Chrome MCP)

## Full test suite (run all)

```bash
pnpm test:health
pnpm test:sessions
pnpm test:refactor
pnpm test:events
pnpm test:todos
pnpm test:permissions
pnpm test:session-switch
pnpm test:fs-engine
pnpm test:e2e
pnpm test:openwrk
```

## Related skills

- For UI flow verification with Chrome MCP (remote behavior), use `.opencode/skills/openwork-chrome-mcp-testing/SKILL.md`.

## Notes

- dev:web + headless is the default pairing for OpenWork testing.
- Always use non-default ports for both headless and web so multiple runs can operate in parallel.
- The feature is not done until a UI message is sent successfully.
