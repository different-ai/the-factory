---
title: OpenWork JIT Worker Files PRD
description: Stream-first, no-forced-daemon file access for remote workers across Den and openwork-orchestrator, with optional mirror mode for offline-heavy workflows.
---

## 1) Executive summary

Users should be able to browse and open remote worker files in local tools (Obsidian, editors, Finder/Explorer) without downloading an entire workspace first.

This PRD defines a dual-mode file system experience:

- **Default: Stream mode (JIT)** for "cloud-drive style" behavior (open-on-demand, minimal local disk use).
- **Optional: Mirror mode** for offline-heavy workflows and aggressive local performance.

The key design choice is to avoid file-by-file REST in the hot path. REST remains control plane only. File data path uses a filesystem-native protocol (SSH/SFTP) with managed sidecars (no user-managed daemon setup).

## 2) Problem statement

Current remote file open behavior is improving (Phase 1 on-demand mirror for single files), but it does not yet provide a seamless filesystem experience:

- No transparent, folder-level, JIT file hydration.
- No consistent local path semantics across Den and openwork-orchestrator remote workers.
- REST file APIs are too chatty and expensive as a primary sync/stream transport.

We need a path that feels like iCloud/Drive/Dropbox while staying predictable and not forcing users to install/run extra infrastructure manually.

## 3) Product goals

1. **No full workspace download by default**.
2. **Open any visible worker file on first access** with automatic hydration.
3. **No required user-managed service** (all background processes app-managed).
4. **One mental model across Den and openwork-orchestrator**.
5. **Safe writes and conflicts** (never silent overwrite).

## 4) Non-goals (v1)

1. Perfect native placeholder integration on all OSes on day one.
2. Replacing all existing OpenWork server file APIs.
3. Supporting every enterprise filesystem edge case in initial release.

## 5) Research findings

### 5.1 Sync engines are strong, but not inherently JIT

- **Mutagen**: highly capable bidirectional sync with low-latency cycles, conflict modes, and safe reconciliation.
- **Syncthing**: robust block-level replication and conflict files, excellent for multi-device continuous replication.

Both are strong for mirror/replication, but neither is a true cloud-files placeholder system by default. They tend to keep folder content synchronized, not lazily projected file-by-file on open.

### 5.2 Cloud-file UX depends on placeholder/hydration semantics

- Windows Cloud Files API (CfAPI) supports placeholders and hydration states (online-only, local, pinned).
- Dropbox/OneDrive/Google Drive UX patterns all converge on:
  - file visibility first,
  - hydrate on access,
  - optional pin for offline,
  - clear status icons.

### 5.3 Mount-based streaming is practical but has tradeoffs

- FUSE/WinFSP mounts (for example via rclone or similar) can provide JIT access with local cache.
- Tradeoffs: reliability/locking semantics vary by app and OS; cache mode tuning is required for write-heavy tools.

## 6) Final decision

Adopt a **dual-mode architecture** with one control plane and two data-plane behaviors, both on a shared SSH/SFTP transport:

1. **Stream mode (default)**
   - JIT, mount-like access with local cache.
   - Minimal initial disk footprint.
   - Best match for "don’t download everything".

2. **Mirror mode (optional)**
   - Full or targeted replication for offline/performance workflows.
   - Implemented with a mature sync engine (Mutagen first-class, Syncthing optional/BYO).

## 7) Architecture

### 7.1 Planes

- **Control plane** (OpenWork app + Den control APIs + openwork-orchestrator):
  - session setup,
  - token issuance,
  - policy,
  - lifecycle,
  - audit metadata.

- **Data plane** (SSH/SFTP filesystem transport):
  - file reads/writes and directory traversal over a mount-friendly protocol.
  - not REST-per-file in steady state.

### 7.2 Core components

1. **Worker File Session Broker**
   - Returns ephemeral credentials + endpoint for a worker file session.
   - Unified for Den and openwork-orchestrator remote workers.

2. **Worker File Gateway (SFTP)**
   - Worker exposes a scoped SFTP root for the active workspace.
   - Same endpoint serves both Stream mode (mount/cache) and Mirror mode (sync).

3. **Local File Access Manager (app-managed sidecar lifecycle)**
   - Starts/stops stream or mirror backend automatically.
   - No user daemon setup required.

4. **Cache Manager**
   - LRU eviction, pin/unpin, size limits.
   - Background warm-up for hot paths.

5. **Writeback + conflict manager**
   - Atomic local staging, retries, explicit conflict artifacts/notifications.

## 8) UX model

Remote worker files expose three states:

1. **Online-only** (metadata only, negligible local size)
2. **Locally available** (recently hydrated)
3. **Always available** (user-pinned)

Primary actions:

- Open in Obsidian/editor
- Make available offline
- Free up space
- Show sync/conflict status

## 9) Den and openwork-orchestrator behavior

### 9.1 Den

- Den provisions worker endpoint and short-lived file-session credentials.
- OpenWork app starts stream mode by default when user connects.
- For large/offline workflows, user can switch worker to mirror mode.

### 9.2 openwork-orchestrator

- **Local sandbox worker**: bypass (direct local filesystem).
- **Remote worker**: same broker/session contract as Den.
- Orchestrator emits sync lifecycle states to UI.

## 10) Why not REST as primary transport

REST remains useful for control and narrow operations, but not for high-churn file IO because:

- excessive round-trips,
- poor editor compatibility at scale,
- expensive conflict and cache coherence management in app code.

Use REST as fallback/escape hatch, not the primary filesystem data plane.

## 11) Rollout plan

### M0 (done)

- Phase 1 single-file remote open in Obsidian via local mirror.

### M1

- Stream mode alpha (JIT open, directory browse, read/write cache).
- Markdown + common text first.

### M2

- Pin/unpin, status badges, LRU controls, conflict UX.

### M3

- Mirror mode (Mutagen-managed) for offline-heavy and large-write workflows.

### M4

- Native placeholder integrations where justified (Windows CfAPI first; macOS File Provider evaluation).

## 12) Success metrics

1. Initial mount/session setup under 10s p50.
2. First open for uncached small text file under 2s p50.
3. No mandatory full workspace hydration.
4. Conflict detection accuracy 100% (no silent overwrite incidents).
5. At least 80% of remote-file user actions served by Stream mode without fallback.
6. At least 95% of file-path operations in connected sessions avoid REST file-content APIs.

## 13) Risks and mitigations

1. **Mount backend variability across OSes**
   - Mitigation: capability probing + per-OS defaults + fallback to current on-demand mirror.

2. **Write semantics for complex editors**
   - Mitigation: conservative cache/writeback defaults, fsync-safe paths, targeted app compatibility tests.

3. **Credential leakage risk**
   - Mitigation: short-lived tokens, scoped permissions, secure local keychain storage, strict audit trail.

4. **User confusion between stream and mirror**
   - Mitigation: clear mode labels and one-click mode switch with recommendations.

5. **SFTP endpoint hardening and auth scope**
   - Mitigation: short TTL credentials, workspace-scoped roots, rate limits, and full audit correlation IDs.

## 14) Open questions

1. Which OS should receive native placeholder integration first after M3?
2. Should mirror mode support selective directory replication only in v1, or full-worker by default?
3. Do we expose Stream/Mirror mode as a per-worker setting only, or also per-folder profile?

## 15) Final recommendation

Ship **Stream mode first** as the default user experience, with **Mirror mode** as an opt-in reliability/performance mode.

This gives the iCloud/Drive feel (JIT, low local footprint) without forcing users to install/manage separate services, while still giving a robust path for offline-heavy teams.
