---
name: share-docker-chrome-verify
description: |
  Start the OpenWork Docker stack and verify the local share flow through the browser.

  Triggers when user mentions:
  - "verify share"
  - "share docker flow"
  - "test share service"
  - "share chrome mcp"
---

## Quick Usage

Run from the OpenWork repo root:

```bash
cd _repos/openwork
./packaging/docker/dev-up.sh
```

This prints:
- OpenWork web URL
- OpenWork server URL
- local share service URL
- token file path
- exact teardown command

## Required Browser Flow

Use Chrome MCP after the stack is healthy.

1. Open the OpenWork app URL and confirm the main session surface loads.
2. Open the local share service URL.
3. Paste a sample skill or upload a skill file.
4. Generate a share link.
5. Open the live shared page.
6. Confirm the shared content, bundle details, and import action render.

## Minimum Evidence

- One screenshot of the app home or session surface.
- One screenshot of the share page before publish.
- One screenshot of the live share page after publish.

## Suggested Verification Checklist

- OpenWork app loads from Docker.
- Share page accepts pasted content.
- Share link generation succeeds.
- Live page renders the shared skill content.
- Live page includes the import action and bundle metadata.

## Cleanup

Use the exact `docker compose -p ... down` command printed by `dev-up.sh`.
