---
title: OpenWork landing demo embed
description: Embed a live OpenWork demo on the landing site with a hosted OpenCode server and safe proxying.
---

## Summary
OpenWork is an open-source alternative to Claude Cowork that is mobile-first, purpose-first, and premium for non-technical users (see `_repos/openwork/AGENTS.md`).
This PRD specifies a landing-site demo that embeds the OpenWork Web UI and defaults to a hosted OpenCode server without exposing credentials.

## Problem statement
- The landing page needs a live demo to show OpenWork capabilities without requiring local installs.
- We need a hosted OpenCode server that is safe, rate-limited, and does not expose credentials in the browser.
- The demo experience must feel fast and premium while remaining locked down for safety.

## Goals
- Add a `/demo` route on the landing site that embeds the OpenWork Web UI.
- Default the server picker to a hosted OpenCode instance using env-configured labels.
- Proxy credentials server-side to avoid exposing secrets.
- Lock down OpenCode permissions to prevent destructive actions.

## Non-goals
- Building a fully multi-tenant production environment.
- Allowing authenticated user accounts or persistence across sessions.
- Supporting full OpenWork feature parity in the demo (limited by safety locks).

## Experience principles
- Demo should work on mobile and desktop.
- The experience should feel "live" but safe and constrained.
- Always show where the demo is running and what it can do.

## UX overview
### Landing site
- Add a `/demo` route that loads the OpenWork Web UI in an iframe first.
- Add a clear banner: "Live demo, limited permissions".

### OpenWork Web UI
- Default server picker to "OpenWork Cloud Demo".
- If proxy fails, show a clean error with retry.

## Architecture overview
### Landing site (Next.js on Vercel)
- Add a `/demo` route with an iframe to the OpenWork Web UI.
- Add a server proxy route at `/api/opencode` to attach credentials.

### OpenCode demo server
- Run `opencode web` or `opencode serve` on a VPS.
- Enable CORS for `https://openwork.ai`.
- Lock down permissions in `opencode.json` (deny `bash`, `edit`, and other destructive tools).

## Env configuration
```
NEXT_PUBLIC_OPENCODE_SERVER_URL=https://opencode-demo.openwork.ai
NEXT_PUBLIC_OPENCODE_SERVER_LABEL=OpenWork Cloud Demo
NEXT_PUBLIC_OPENCODE_PROXY_URL=/api/opencode
OPENCODE_SERVER_USERNAME=opencode
OPENCODE_SERVER_PASSWORD=change-me
```

## Security and permissions
- Proxy credentials server-side only; never embed them in client code.
- Rate limit demo requests at the proxy.
- Disable destructive OpenCode tools in `opencode.json`.
- Add a request timeout to avoid hanging the UI.

## Infrastructure plan
- VPS recommendation: Hetzner CX23 or CPX11.
- Use a simple systemd unit for `opencode serve`.
- Set up monitoring for uptime and basic latency.

## Rollout plan
- Phase 1: Hidden `/demo` route for internal validation.
- Phase 2: Public demo with rate limits.
- Phase 3: Iterate on UI polish and reliability.

## Test plan
- Validate iframe demo loads and server picker defaults correctly.
- Verify proxy route attaches credentials and strips them from responses.
- Confirm destructive tools are blocked in the demo environment.
- Load test with basic concurrency to confirm stability.

## Acceptance criteria
- `/demo` route exists and embeds OpenWork Web UI.
- Server picker defaults to the hosted demo server label.
- No credentials are exposed in client code or network logs.
- Destructive tools are blocked in the demo environment.

## Open questions
- Do we need a separate domain for the OpenCode demo server?
- What is the maximum safe concurrency for the VPS tier?
- Should the demo reset state after each session?
