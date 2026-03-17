---
title: OpenWork CPU thrift mode
description: Make OpenWork dramatically lighter on CPU by eliminating frame-rate event flushes, always-on polling, recursive watcher churn, and unbounded log work across the app, desktop host, server, and router.
---

## Summary

This PRD treats "1000x less CPU" as a forcing function, not a literal promise for every workload.

The practical product goal is:

1. Hidden or disconnected OpenWork should do almost no work.
2. Visible but idle OpenWork should run one small shared heartbeat instead of many unrelated timers.
3. Active sessions should update on meaningful boundaries and explicit budgets, not at frame cadence.
4. File watching and log handling should be bounded, deduplicated, and scoped to active work.

Research across `_repos/openwork` shows five likely CPU sinks:

- app session rendering and event flushing at near-frame cadence
- fragmented background polling across multiple UI surfaces
- recursive watcher fan-out in both server and desktop layers
- router event subscription fan-out plus typing/health timers
- repeated string and array copying in log pipelines

If we execute this well, hidden/idle scenarios can approach the spirit of "1000x lighter" because many current wakeups can go to near-zero. Active streaming scenarios are more realistically a 2x-10x CPU reduction, with the biggest wins coming from event budgeting and virtualization.

## Why this PRD exists

OpenWork is supposed to feel premium, mobile-first, and local-first, not like a laptop heater.

Today the product already has performance targets in `_repos/openwork/AGENTS.md`, but the architecture still includes many recurring wakeups:

- renderer loops that flush events every ~16ms
- a 50ms session status timer while runs are visible
- several 10s-20s polling loops in app-level state
- recursive file watchers that rescan directory trees
- router subscriptions and typing loops that stay alive beyond the minimum needed

That pattern makes OpenWork feel heavier than it needs to be on CPU, battery, and thermals, especially on laptops and during long-running agent sessions.

## Problem statement

OpenWork spends CPU on coordination overhead that is not the core product value.

We want CPU to go to:

- actual agent work
- visible user feedback
- deliberate file reload events

We do not want CPU to go to:

- idle polling that says "nothing changed"
- full-tree rescans after every watcher event
- whole-thread rerenders for tiny token updates
- log buffer copying on every line
- subscriptions that stay active for directories with no live work

## Product decision

Adopt a cross-stack "CPU thrift mode" strategy with four rules:

1. `Hidden means paused.` If the user cannot see the UI, recurring UI polls stop.
2. `Idle means consolidated.` One scheduler owns background checks and backoff.
3. `Streaming means budgeted.` Event application and rendering happen at explicit semantic budgets, not at frame cadence by default.
4. `Watching means scoped.` Watch only the roots and sessions that can produce user-visible value right now.

## Goals

- Reduce hidden-window and disconnected-state CPU to near-zero meaningful work.
- Reduce visible idle CPU by consolidating polling and background refresh logic.
- Reduce active-session renderer CPU without making streaming feel laggy.
- Reduce watcher and log overhead in server, desktop, and router processes.
- Add measurement so CPU regressions become visible before they ship.

## Non-goals

- Reduce LLM inference CPU inside external model providers.
- Rewrite OpenCode itself.
- Change core OpenWork product positioning or user flows.
- Promise a literal 1000x improvement in every active workload.

## Research findings (exact mapping)

### 1) Session rendering is budgeted like animation, not like text streaming

Evidence:

- `_repos/openwork/packages/app/src/app/context/session.ts:923` flushes queued SSE events on a 16ms timer.
- `_repos/openwork/packages/app/src/app/context/session.ts:955` processes the stream continuously and yields every ~8ms.
- `_repos/openwork/packages/app/src/app/pages/session.tsx:921` starts a 50ms interval while the run indicator is shown.
- `_repos/openwork/packages/app/src/app/components/session/message-list.tsx:201` rebuilds message blocks from `props.messages`.
- `_repos/openwork/packages/app/src/app/components/session/message-list.tsx:409` renders the full message block list with nested `For` loops.
- `_repos/openwork/packages/app/src/app/components/session/minimap.tsx:15` queries every rendered message bubble, reads layout, and updates on scroll and resize.

Why this is likely expensive:

- frame-rate flushing is great for animation, but too expensive for long text/tool streams
- a 50ms interval keeps reactive work hot even when nothing visually important changed
- long sessions pay full-list recomputation and DOM/layout costs
- minimap work scales with message count and scroll frequency

Most promising mitigation:

- switch session updates to semantic budgets: token batches, tool boundary updates, or 100-250ms cadence
- replace the 50ms run-stall loop with CSS animation plus a coarse 1s heartbeat
- virtualize long session lists and lazy-enable the minimap only for large threads or on demand
- update only changed message segments instead of rebuilding all blocks

### 2) The app uses many separate polling loops instead of one scheduler

Evidence:

- `_repos/openwork/packages/app/src/app/app.tsx:373` checks OpenWork server health on a recurring timer.
- `_repos/openwork/packages/app/src/app/app.tsx:427` polls host info every 10s.
- `_repos/openwork/packages/app/src/app/app.tsx:449` polls diagnostics every 10s.
- `_repos/openwork/packages/app/src/app/app.tsx:487` refreshes engine state every 10s in developer mode.
- `_repos/openwork/packages/app/src/app/app.tsx:511` polls router info every 10s.
- `_repos/openwork/packages/app/src/app/app.tsx:538` polls openwrk status every 10s.
- `_repos/openwork/packages/app/src/app/app.tsx:2096` polls audit entries every 15s.
- `_repos/openwork/packages/app/src/app/context/server.tsx:126` polls server health every 10s.
- `_repos/openwork/packages/app/src/app/components/status-bar.tsx:175` polls router status every 15s.
- `_repos/openwork/packages/app/src/app/pages/identities.tsx:655` refreshes messaging state every 10s.

Why this is likely expensive:

- even when each poll is cheap, many independent timers create constant wakeups, fetches, JSON parsing, and store writes
- visibility gating is inconsistent; some surfaces pause when hidden and others do not
- disconnected states still spend work proving they are disconnected

Most promising mitigation:

- create one background scheduler service with priorities, visibility awareness, and exponential backoff
- share snapshots between status bar, settings, identities, and devtools instead of having each surface poll independently
- make hidden/disconnected state zero-poll by default except for explicit user actions or coarse reconnect probes

### 3) File watching is recursive and directory-count-scaled

Evidence:

- `_repos/openwork/packages/server/src/reload-watcher.ts:275` creates one watcher per directory.
- `_repos/openwork/packages/server/src/reload-watcher.ts:311` scans the full directory tree.
- `_repos/openwork/packages/server/src/reload-watcher.ts:333` rescans to keep watcher lists in sync.
- `_repos/openwork/packages/server/src/reload-watcher.ts:382` schedules rescans after file events.
- `_repos/openwork/packages/desktop/src-tauri/src/workspace/watch.rs:77` replaces the active workspace watcher.
- `_repos/openwork/packages/desktop/src-tauri/src/workspace/watch.rs:106` processes every native event path.
- `_repos/openwork/packages/desktop/src-tauri/src/workspace/watch.rs:161` watches `.opencode` recursively.

Why this is likely expensive:

- watcher cost scales with directory count instead of with the tiny number of files that actually matter to reload semantics
- server-side rescans after events make watcher churn worse in busy workspaces
- desktop still pays path normalization and filtering on every event before debounce eliminates emissions

Most promising mitigation:

- watch a smaller explicit manifest of reload-relevant roots and filenames
- prefer one recursive watcher per root where platform behavior is acceptable, rather than one watcher per directory
- debounce harder (500-1000ms) and only rescan on topology changes
- treat SQLite/log/temp churn as ignorable at the watcher edge, not after callback work starts

### 4) Router work scales with bound directories and active timers

Evidence:

- `_repos/openwork/packages/opencode-router/src/bridge.ts:432` starts typing loops.
- `_repos/openwork/packages/opencode-router/src/bridge.ts:444` sends typing every interval.
- `_repos/openwork/packages/opencode-router/src/bridge.ts:463` polls OpenCode health.
- `_repos/openwork/packages/opencode-router/src/bridge.ts:479` keeps a 30s health interval after startup.
- `_repos/openwork/packages/opencode-router/src/bridge.ts:1132` ensures one event subscription per directory.
- `_repos/openwork/packages/opencode-router/src/bridge.ts:1143` streams all events for that directory.
- `_repos/openwork/packages/opencode-router/src/bridge.ts:1191` inspects message part updates and can emit outbound tool text.

Why this is likely expensive:

- directory subscriptions stay alive even if only a small subset is active
- typing loops create recurring wakeups per active run
- health polling keeps background activity alive even when the router is stable

Most promising mitigation:

- subscribe only for active session directories and aggressively unsubscribe when runs finish
- replace periodic typing loops with event-triggered typing windows and long silence cutoffs
- turn health checks into lifecycle-triggered probes with very slow idle backoff

### 5) Log handling does repeated copying in hot paths

Evidence:

- `_repos/openwork/packages/desktop/src-tauri/src/openwork_server/mod.rs:101` appends stdout by rebuilding the buffered string.
- `_repos/openwork/packages/desktop/src-tauri/src/openwork_server/mod.rs:108` does the same for stderr.
- `_repos/openwork/packages/headless/src/cli.ts:890` splits incoming stream chunks into lines and logs each line.
- `_repos/openwork/packages/headless/src/cli.ts:4242` forwards every log event into the TUI.
- `_repos/openwork/packages/headless/src/tui/app.tsx:218` appends logs by copying the array.
- `_repos/openwork/packages/headless/src/tui/app.tsx:364` refilters the full log set for every update.

Why this is likely expensive:

- O(n) string concatenation and array copying compounds under noisy logs
- log filtering work continues even if the logs view is not the current view

Most promising mitigation:

- use bounded ring buffers for bytes/lines instead of repeated concatenation
- pre-filter before UI insertion when possible
- compute filtered logs lazily only while the logs view is active

## What "1000x lighter" means in practice

The literal 1000x number is realistic mainly for hidden or disconnected states where the correct answer is "do almost nothing."

Reasonable expectations by mode:

- `Hidden / disconnected`: potentially 100x-1000x lighter if current wakeups and polls drop close to zero.
- `Visible / idle`: more like 10x-50x lighter if we collapse many timers into one scheduler and slow background work down.
- `Active streaming`: more like 2x-10x lighter because we still need live UI, but we can stop doing frame-rate work for text and tool updates.
- `Large workspace churn`: 5x-50x lighter if watcher rescans and duplicate watchers are removed.

This is still worth doing. The best product story is not a marketing number; it is fans staying quiet and battery lasting longer while the app still feels fast.

## Success metrics

We should track both user-visible CPU and the leading indicators that cause CPU.

### Lagging metrics

| Scenario | Target |
| --- | --- |
| Desktop app hidden, no active sessions | Combined CPU for app + desktop host + openwork-server + router stays near idle baseline on a reference laptop; no periodic UI polling |
| Desktop app visible, no active sessions | CPU materially lower than current baseline; no repeated timer storms |
| One long streaming session | Noticeably lower renderer CPU with no perceived streaming lag and no frame drops in core interactions |
| Large workspace with config churn | No full-tree rescans on every file change; CPU remains bounded during repeated reload-trigger edits |

### Leading indicators

- hidden-window recurring network polls per minute: `0`
- renderer recurring timers in hidden state: `0`
- session event flush cadence during active streaming: `<= 4-10 Hz` unless a tool phase explicitly opts into faster updates
- run-stall indicator timer cadence: `<= 1 Hz`
- router event subscriptions: only active directories, not every bound directory forever
- watcher count per workspace: bounded to explicit roots instead of scaling with every subdirectory
- log append complexity: O(1) per entry with bounded buffers

## Scope

### In scope

1. Measurement and CPU profiling across app, desktop host, server, router, and openwrk.
2. Background polling consolidation and hidden/disconnected throttling.
3. Session rendering and SSE update budgeting.
4. Watcher architecture simplification.
5. Router subscription and timer lifecycle cleanup.
6. Bounded log pipelines.

### Out of scope

1. Rewriting OpenCode engine internals.
2. Changing model/provider-side inference behavior.
3. Shipping a net-new user-facing product surface unrelated to performance.

## Proposed execution plan

### Phase 0: perf lab and baseline instrumentation

Goal: stop guessing.

Deliverables:

- define a repeatable benchmark matrix:
  - hidden idle
  - visible idle
  - one streaming session
  - two concurrent streaming sessions
  - identities/dashboard open in background
  - large workspace file churn in `.opencode`
- capture per-process CPU, timer counts, event rates, watcher counts, and network request counts
- produce a top-offender dashboard so we can verify improvements phase by phase

Why first:

- this PRD has strong hotspot evidence, but we still need exact percentages before sequencing engineering work

### Phase 1: near-zero hidden and disconnected mode

Goal: when the user is not looking at OpenWork, OpenWork mostly stops moving.

Changes:

- centralize background polling into one scheduler service
- make all app-level polls obey visibility and connection state
- share fetched state between status bar, settings, identities, and devtools
- use exponential backoff plus explicit user-triggered refresh after repeated disconnects
- make router health probing lifecycle-driven and much slower when stable

Expected impact:

- biggest immediate battery and fan win
- easiest user-visible story: "OpenWork no longer burns CPU while idle"

### Phase 2: session streaming budgeter

Goal: active sessions feel live without paying 60fps coordination costs.

Changes:

- replace 16ms SSE flush timers with semantic batching or a lower adaptive cadence
- replace the 50ms run indicator timer with coarse heartbeats and CSS-only motion where possible
- virtualize long message threads and step lists
- lazy-enable minimap and other layout-scanning helpers only when useful
- keep tool updates high signal and low frequency

Expected impact:

- biggest improvement for long sessions, large transcripts, and laptop thermals during active work

### Phase 3: watcher reset

Goal: watching configuration changes should not mean recursively watching half the workspace.

Changes:

- define the exact reload graph: which paths truly matter for skills, commands, agents, config, and workspace metadata
- replace per-directory watcher fan-out with bounded root watchers or a manifest-driven approach
- raise debounce budgets and dedupe duplicate change bursts
- skip topology rescans unless directory structure actually changed

Expected impact:

- biggest win for large workspaces, self-modifying flows, and background CPU during file churn

### Phase 4: router and log thrift mode

Goal: messaging and logs cost CPU only when they are actively providing value.

Changes:

- subscribe to events only for active directories/sessions
- convert typing to event-window semantics instead of recurring heartbeat loops where channel APIs allow it
- turn health polling into sparse idle probes
- replace string and array copy log buffers with ring buffers
- filter/render logs lazily only when the log UI is visible

Expected impact:

- steadier multi-chat behavior and lower host CPU under verbose logging

## Prioritization

Recommended order:

1. Phase 0 measurement
2. Phase 1 hidden/idle scheduler
3. Phase 2 session streaming budgeter
4. Phase 3 watcher reset
5. Phase 4 router/log thrift mode

Reasoning:

- Phase 1 is the fastest path to the "why is this app hot while doing nothing?" complaint.
- Phase 2 attacks the main active-use CPU sink.
- Phase 3 and Phase 4 clean up the infrastructure layers that keep background CPU elevated.

## Risks and mitigations

- `Risk:` lower poll frequency hides real state changes.
  - `Mitigation:` use shared cache invalidation, explicit refresh buttons, and event-driven updates where available.
- `Risk:` slower streaming updates feel less responsive.
  - `Mitigation:` keep adaptive budgets for visible active sessions and measure perceived latency, not just raw CPU.
- `Risk:` watcher simplification misses a real reload trigger.
  - `Mitigation:` define the reload graph explicitly and validate against existing hot reload expectations in `_repos/openwork/AGENTS.md`.
- `Risk:` router unsubscribe rules break background messaging expectations.
  - `Mitigation:` keep subscription policy keyed to active runs and bound conversations, then soak-test multi-channel flows.

## Open questions

1. Which process is hottest today in real-world use: renderer, desktop host, openwork-server, router, or openwrk?
2. How much of active-session CPU is caused by message rendering versus SSE event application versus minimap/layout work?
3. Can the server-side reload model move from recursive watching to a manifest of exact files without hurting the living-system workflow?
4. Which router channels truly require periodic typing updates versus one-shot or sparse updates?

## Recommendation

Approve a CPU-thrift initiative with measurement first and implementation second.

The most important product promise should be:

- OpenWork is quiet when idle.
- OpenWork stays cool during long sessions.
- OpenWork still feels premium and live.

That is more credible and more valuable than chasing a blanket numeric claim without changing the architecture that causes the waste.

## Sources

### Internal research

- `_repos/openwork/AGENTS.md`
- `_repos/openwork/ARCHITECTURE.md`
- `_repos/openwork/packages/app/pr/openwork-10x-audit.md`
- `_repos/openwork/packages/app/src/app/context/session.ts`
- `_repos/openwork/packages/app/src/app/pages/session.tsx`
- `_repos/openwork/packages/app/src/app/components/session/message-list.tsx`
- `_repos/openwork/packages/app/src/app/components/session/minimap.tsx`
- `_repos/openwork/packages/app/src/app/app.tsx`
- `_repos/openwork/packages/app/src/app/context/server.tsx`
- `_repos/openwork/packages/app/src/app/components/status-bar.tsx`
- `_repos/openwork/packages/app/src/app/pages/identities.tsx`
- `_repos/openwork/packages/server/src/reload-watcher.ts`
- `_repos/openwork/packages/desktop/src-tauri/src/workspace/watch.rs`
- `_repos/openwork/packages/opencode-router/src/bridge.ts`
- `_repos/openwork/packages/desktop/src-tauri/src/openwork_server/mod.rs`
- `_repos/openwork/packages/headless/src/cli.ts`
- `_repos/openwork/packages/headless/src/tui/app.tsx`

### External references

- MDN, Page Visibility API: https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
- web.dev, Virtualize large lists with react-window: https://web.dev/articles/virtualize-long-lists-react-window
- Node.js docs, `fs.watch()` caveats: https://nodejs.org/api/fs.html#fswatchfilename-options-listener
- Tauri plugins workspace PR reducing watch overhead: https://github.com/tauri-apps/plugins-workspace/pull/2613
- Roo Code PR reducing watcher CPU load: https://github.com/RooCodeInc/Roo-Code/pull/7596
