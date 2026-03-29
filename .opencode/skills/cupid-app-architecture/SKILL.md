---
name: cupid-app-architecture
description: CUPID app architecture guidance for apps/app/src/app/**
---

## Purpose

Use this skill when changing ownership, file placement, or structure inside `apps/app/src/app/**`.

This is an incremental migration guide, not a rewrite mandate.

Goals:

- keep the OpenWork app simple and predictable
- stop defaulting to `app.tsx`, `pages/*`, and generic `utils/*`
- move touched code toward colocated domain ownership with minimal behavior churn

## Applies to

- app architecture work in `apps/app/src/app/**`
- refactors that move code between files or clarify ownership
- changes in `app.tsx`, `pages/dashboard.tsx`, `pages/session.tsx`, `pages/settings.tsx`

Do not use this skill to justify broad rewrites. Move one coherent slice at a time.

## Core rules

- Pick the owning domain before writing code.
- Keep public surfaces small and obvious.
- Prefer colocating UI, state, helpers, and transport code that belong to one workflow.
- Keep dependency direction shallow and predictable.
- Preserve behavior first; improve placement second.
- Promote code to shared only after multiple real consumers exist.

## Target domain map

Use these domains for `apps/app/src/app/**` work:

### shell

Owns app-wide composition only:

- routing and view switching
- top-level modal mounting
- runtime boot / wiring
- reload, updater, and host lifecycle surfaces
- global layout chrome

Examples today:

- `apps/app/src/app/app.tsx`
- `apps/app/src/app/entry.tsx`
- global platform/runtime providers in `context/*.tsx`

Shell should orchestrate domains, not absorb their feature logic.

### workspace

Owns workspace lifecycle and workspace-scoped controls:

- create/import/export workspace
- rename workspace
- edit workspace connection
- connect remote workspace
- workspace switching and recovery
- workspace config / blueprint flows

Examples today:

- `context/workspace.ts`
- `components/create-workspace-modal.tsx`
- `components/create-remote-workspace-modal.tsx`
- `components/rename-workspace-modal.tsx`
- `lib/workspace-blueprints.ts`

### session

Owns active task/session experience:

- session list and selection
- composer and attachments
- message list and step rendering
- retry / abort / revert / compact
- session-scoped model behavior

Examples today:

- `pages/session.tsx`
- `components/session/*`
- `context/session.ts`
- `lib/opencode-session.ts`
- `lib/session-title.ts`

### connections

Owns connections to external capabilities and providers:

- provider auth
- provider connection status
- MCP listing, creation, auth, and config edits
- remote server connectivity details that are not generic shell boot logic

Examples today:

- `components/provider-auth-modal.tsx`
- `components/mcp-auth-modal.tsx`
- `components/add-mcp-modal.tsx`
- `mcp.ts`
- `utils/providers.ts`

Practical rule:

- provider auth lives in `connections`
- MCP flows live in `connections`

### automations

Owns scheduled or repeatable work setup:

- scheduled jobs
- automation-specific UI and storage
- future workflow runners that are not session-chat interactions

Examples today:

- `context/automations.ts`
- `pages/scheduled.tsx`

### cloud

Owns hosted OpenWork and Den-specific flows:

- cloud worker creation
- hosted auth and deployment-aware UX
- template/cloud onboarding that depends on hosted control plane behavior

Examples today:

- `lib/den.ts`
- `lib/den-template-cache.ts`
- `components/den-settings-panel.tsx`
- `lib/openwork-deployment.ts`

### app-settings

Owns app-wide preferences and local app controls:

- theme, language, updates, font zoom
- engine source/runtime preferences
- app defaults
- authorized folders and app-wide config editing

Examples today:

- `pages/settings.tsx`
- `theme.ts`
- `lib/font-zoom.ts`

### kernel

Kernel is the smallest shared layer.

Only put code here when all of the following are true:

- it is used by multiple domains
- it is not owned by one workflow
- it has a stable, narrow API
- it is mostly framework-light or product-primitive level

Good fits:

- tiny formatting helpers
- narrow type helpers
- low-level primitives with no domain story

Bad fits:

- half-understood feature logic moved to `utils`
- domain-specific state hidden as a “shared helper”
- transport code shared by accident rather than design

## Ownership rules

Use these defaults when deciding where code belongs:

- Workspace rename, edit, connect, recover, and import/export live in `workspace`.
- Provider auth lives in `connections`, even if launched from dashboard or settings.
- MCP creation/auth/config lives in `connections`.
- Active chat/task flow lives in `session`.
- Hosted worker and Den flows live in `cloud`.
- App preferences and host controls live in `app-settings`.
- Shell only coordinates domains and mounts shared surfaces.

If a feature has one clear user-facing owner, keep its state, view pieces, and helpers there.

## Dependency direction

Prefer this direction:

`shell -> domain public API -> local domain internals`

Rules:

- Domains may depend on `kernel` primitives.
- Domains should not reach into another domain's internals.
- If one domain needs another, expose a tiny public surface such as `index.ts`, `api.ts`, or a clearly named module.
- Avoid bidirectional imports.
- Avoid creating “super util” files that silently become cross-domain hubs.

## Colocation rules

Within one domain, colocate:

- view components
- local state/store/context
- domain-specific helpers
- transport/adapters for that workflow
- tests for that domain when present

Do not split code across `components/`, `context/`, `lib/`, and `utils/` just because those buckets already exist.

When touching existing generic folders, prefer creating a domain subfolder and moving only the code you are already changing.

## When to keep code in shell

Keep code in shell only if it is truly app-global:

- route/view dispatch
- app bootstrap
- global modal registry
- top-level reload/update banners
- runtime selection and provider wiring that all domains consume equally

If logic answers a domain question like “how do workspaces connect?” or “how does provider auth start?”, it probably does not belong in shell.

## When a new domain is warranted

Create a new domain only when the work has:

- a clear product concept
- multiple related files or states
- a user-facing workflow that will keep growing

Do not create a new domain for one helper or one modal.

If the work is still clearly part of workspace/session/connections/automations/cloud/app-settings, use a subfolder there instead.

## Migration heuristics

When touching existing app architecture:

1. Identify the owning workflow.
2. Pick the smallest slice you can move safely.
3. Create or extend a local domain folder.
4. Move state, view, and helpers together when practical.
5. Leave a thin adapter behind if needed to keep imports stable.
6. Verify behavior before considering any further cleanup.

Good incremental moves:

- extract one provider-auth flow out of `pages/settings.tsx` into `connections/providers/*`
- extract one workspace action cluster out of `app.tsx` into `workspace/*`
- move one session-only helper next to `components/session/*`

Bad moves:

- reorganizing the whole app in one PR
- renaming many files without changing ownership clarity
- moving code to `utils/` because the correct domain feels inconvenient

## Anti-patterns to avoid

- adding more feature logic directly to `app.tsx`
- leaving domain code in `pages/*` because it is already there
- adding new generic `hooks.ts`, `helpers.ts`, or `utils.ts` files without a domain owner
- importing deep internals across domains
- creating “shared” abstractions before there are multiple real consumers
- using framework buckets as the primary architecture

## Step-by-step refactor procedure

For app-architecture work:

1. Confirm the exact workflow you are changing.
2. Name the owning domain.
3. Check whether shell is doing domain work that should move out.
4. Move the smallest coherent slice possible.
5. Keep public imports small and intention-revealing.
6. Avoid behavior rewrites during moves.
7. Run the nearest focused verification.
8. Leave follow-up cleanup for a later change unless it directly blocks the move.

## PR acceptance checklist

- Is the owning domain obvious from the file path?
- Did the change avoid adding more feature logic to `app.tsx`?
- Are state, UI, and helpers colocated with the owning workflow?
- Are cross-domain imports going through a small public surface?
- Did we avoid creating a generic shared helper too early?
- Was the change incremental rather than a broad architectural rewrite?
- If a shell file still contains domain logic, is there a clear reason?

If the answer to several of these is “no”, stop and simplify the move.
