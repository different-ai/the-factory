---
title: Worker-as-sandbox orchestration + identity simplification
description: Default per-worker sandboxed stacks orchestrated by openwrk; remove WhatsApp; support multiple Telegram/Slack bots per worker; remove Deploy tab.
---

## Summary
OpenWork workers should feel like a single, isolated unit: one workspace, one sandboxed stack (OpenCode + OpenWork server + owpenbot), orchestrated by openwrk. The UI should stop exposing infrastructure concepts (ports, import/export jargon), and the identity surface should be clean: Telegram + Slack only, with support for multiple bots/apps per worker. WhatsApp is removed entirely.

This PRD defines the new architecture and the first implementation slice (Steps 1–5) to make it real.

## Goals
- Workers are isolated by default: each worker is its own sandboxed stack with its own OpenWork server + owpenbot.
- The UI does not show a Deploy tab; import/export jargon is removed from the primary navigation.
- WhatsApp is removed everywhere (API, owpenbot, UI, deps).
- Telegram + Slack support multiple bots/apps per worker.
- openwrk orchestrates worker stacks; the UI no longer manages ports directly.

## Non-goals (for this slice)
- Remote/cloud hosting workflow.
- Cross-device background hosting policy (stay local-first).
- Advanced tooling for container lifecycle (developer-only for now).

## Architecture (new)
### Worker = workspace + sandboxed stack
Each worker maps to a workspace folder and a sandboxed runtime stack:
- opencode (per worker)
- openwork-server (per worker)
- owpenbot (per worker)

openwrk orchestrates the stack for a worker and owns sandbox configuration. The desktop UI invokes openwrk to start/stop worker stacks.

### Identities
Owpenbot is per worker. Telegram and Slack can have multiple bots/apps per worker:
- Telegram: multiple bot tokens, each with its own status.
- Slack: multiple bot/app token pairs, each with its own status.

WhatsApp is removed.

### Volumes
Workers support extra volumes (host mounts) as an advanced per-worker setting. Default mounts are minimal, with explicit opt-in for additional paths.

## UX changes
- Remove Deploy tab entirely.
- Create Worker starts a sandboxed stack by default.
- Identities pane lists Telegram + Slack bots with add/remove controls.

## Implementation plan (Steps 1–5)
### Step 1: Remove Deploy tab
- Remove Deploy navigation entry and route.
- Remove any direct import/export UI references tied to Deploy.

### Step 2: Remove WhatsApp support
- Remove owpenbot WhatsApp adapter code and config entries.
- Remove server endpoints that proxy WhatsApp QR / config.
- Remove UI WhatsApp sections.
- Remove WhatsApp dependencies.

### Step 3: Multi-bot Telegram + Slack (owpenbot)
- Update owpenbot config schema to allow multiple Telegram tokens and Slack bot/app pairs.
- Expose list/add/remove endpoints in owpenbot API.
- Keep backwards compatibility by migrating single-token config to multi-bot format on load.

### Step 4: Multi-bot identities in OpenWork server + UI
- Update openwork-server proxy + type definitions to surface multi-bot info.
- Update Identities pane to list bots, add new bot/app, remove existing.

### Step 5: Sandbox default for Create Worker
- Create Worker should start `openwrk start` with `--sandbox auto` and per-worker data dir.
- Ensure worker owpenbot data dir is per worker (even in sandbox mode).
- Add a user-visible warning if sandbox tooling is unavailable and we fall back to host mode.

## Risks
- Removing WhatsApp may break existing setups; we should surface a clear UI note in settings.
- Multiple bot configs require careful migration to avoid losing tokens.
- Sandbox tooling is not guaranteed; we need a graceful fallback.

## Success criteria
- Deploy tab gone; users no longer see import/export jargon in nav.
- WhatsApp code and endpoints removed; owpenbot builds without baileys.
- Identities pane supports multiple Telegram/Slack entries per worker.
- Create Worker uses sandbox by default; openwrk passes `--sandbox auto`.
