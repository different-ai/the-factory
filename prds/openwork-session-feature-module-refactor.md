---
title: OpenWork Session Surface Feature-Module Refactor
description: Reduce the mental overhead of working in the session surface by turning the current monolithic page into a feature module with explicit page, layout, left pane, center pane, right pane, overlays, hooks, and services.
---

## Summary

This PRD proposes a structural refactor of the OpenWork app session surface in `_repos/openwork/apps/app/src/app/pages/session.tsx`.

The goal is not to redesign the UI. The goal is to make the code map cleanly to the product mental model:

- `page`
- `layout`
- `left sidebar`
- `center`
- `right sidebar`

Today, the session route mixes route wiring, layout, workspace navigation, conversation rendering, search, scrolling, run lifecycle, remote file sync, share/export flows, command palette logic, modals, permission overlays, and performance instrumentation into one large file. That raises the cost of every future change.

This refactor creates a dedicated session feature module so contributors can understand and change one region or one behavior without loading the entire session surface into working memory.

## Problem statement

The current session surface is difficult to reason about because one route file owns too many concerns at once.

Examples inside `_repos/openwork/apps/app/src/app/pages/session.tsx`:

- giant route prop contract starting at `SessionViewProps`
- search indexing and hit navigation
- message windowing and earlier-message reveal
- viewport anchoring and jump controls
- streaming run lifecycle and stall detection
- remote file mirror sync loop for worker files
- share/export publishing flows
- command palette state and keyboard handling
- provider auth, rename/delete, permission, question, and share overlays
- the actual visual three-column shell

As a result:

- the file is hard to scan top-to-bottom
- behavior ownership is unclear
- UI regions do not correspond to file boundaries
- side effects and rendering are tightly interleaved
- changing one area requires understanding unrelated logic
- dead or semi-redundant components are harder to evaluate because the current page does not present clear seams

## Goals

- Make the session surface map directly to the user-facing layout and contributor mental model.
- Keep behavior unchanged unless a structural cleanup requires a tiny mechanical adjustment.
- Preserve existing visual design and user flows.
- Isolate side effects into hooks and services.
- Replace the single giant page file with a small route shim and a session feature folder.
- Group state and actions into explicit view-model contracts instead of forwarding a huge flat prop bag through the tree.
- Make future work on left rail, conversation center, right rail, or overlays mostly local to one folder.

## Non-goals

- No major visual redesign.
- No new interaction model for sessions.
- No migration to a new state library.
- No rewrite of existing reusable components like `MessageList`, `Composer`, or `WorkspaceSessionList` unless required for cleaner boundaries.
- No product-scope change to remote file behavior, sharing, permissions, or provider auth.

## Design principle

The session surface should be organized by **ownership**, not by whatever happened to be added first.

The top-level code should read like this:

```tsx
page -> layout -> left sidebar | center | right sidebar -> overlays
```

Any logic that does not help a reader understand that skeleton should move out of the page component.

## Current responsibility map

The current route file owns at least these domains:

### Route and composition

- route props and page entry
- high-level workspace and session actions

### Conversation mechanics

- search query state and hit navigation
- message window slicing
- earlier-message reveal
- message batching during streaming
- jump-to-latest behavior
- initial bottom anchor behavior
- clipped-message detection

### Run lifecycle

- thinking/responding status derivation
- elapsed timers
- stall detection
- run footer status
- abort/retry behavior

### Remote worker file support

- mirror session creation
- local mirror hydration
- sync loop
- conflict handling
- cleanup on workspace changes

### Workspace sharing/export

- derive shareable fields
- resolve worker identifiers
- publish workspace profile bundles
- publish skills bundles
- export gating

### Overlays and interruption layers

- command palette
- provider auth
- rename modal
- delete modal
- share modal
- permission overlay
- question modal
- flyouts

### Shell and navigation

- left rail width
- right rail expand/collapse
- mobile right drawer
- update pill presentation
- header actions
- status bar wiring

This responsibility spread is the core refactor target.

## Proposed feature-module structure

Keep the current route file as a thin entry point, then move all real implementation under a dedicated folder.

```text
_repos/openwork/apps/app/src/app/pages/
  session.tsx

_repos/openwork/apps/app/src/app/pages/session/
  session-page.tsx
  session-controller.ts
  session-layout.tsx
  session-types.ts

  panes/
    session-left-pane.tsx
    session-center-pane.tsx
    session-right-pane.tsx

  center/
    session-header.tsx
    conversation-pane.tsx
    conversation-empty-state.tsx
    conversation-jump-controls.tsx
    session-todo-tray.tsx
    session-run-footer.tsx

  overlays/
    session-overlays.tsx
    session-command-palette.tsx
    session-provider-auth-layer.tsx
    session-share-layer.tsx
    session-rename-layer.tsx
    session-delete-layer.tsx
    session-permission-layer.tsx
    session-question-layer.tsx
    session-flyouts-layer.tsx

  hooks/
    use-session-search.ts
    use-session-windowing.ts
    use-session-viewport.ts
    use-session-run-state.ts
    use-session-command-palette.ts
    use-session-agent-picker.ts
    use-session-share.ts
    use-session-remote-mirror.ts
    use-session-flyouts.ts

  lib/
    session-search.ts
    session-run.ts
    session-share.ts
    session-scroll.ts
```

## Top-level ownership model

### `session.tsx`

Responsibilities:

- keep the current route export stable
- import the existing route props type if needed
- render `SessionPage`

Rules:

- no feature logic
- no side effects
- no layout code beyond the handoff

### `session-page.tsx`

Responsibilities:

- compose the controller, layout, panes, and overlays
- stay readable in one screenful if possible

The intended shape is:

```tsx
const vm = createSessionController(routeProps)

return (
  <>
    <SessionLayout
      left={<SessionLeftPane vm={vm.leftPane} />}
      center={<SessionCenterPane vm={vm.centerPane} />}
      right={<SessionRightPane vm={vm.rightPane} />}
    />
    <SessionOverlays vm={vm.overlays} />
  </>
)
```

### `session-layout.tsx`

Responsibilities:

- shell only
- left width, center region, right width, mobile drawer slotting
- no domain behavior

This file should answer only: how are the three regions arranged?

### `session-controller.ts`

Responsibilities:

- adapt the route prop bag into grouped view models
- compose feature hooks
- expose grouped state and callbacks to panes and overlays

This file is the single place where the route contract is translated into session-module contracts.

## Pane contracts

The current giant flat prop surface should be replaced with grouped contracts.

### Left pane

`SessionLeftPaneVm` should own:

- workspace/session list state
- active workspace/session ids
- create session in workspace
- open session from workspace
- rename/delete/share/reveal workspace actions
- update pill state shown in the left rail
- resize-handle wiring

### Center pane

`SessionCenterPaneVm` should own:

- header title and badges
- search bar state
- reload banner state
- conversation viewport state
- hidden/earlier message actions
- run indicator/footer state
- todo tray state
- composer state
- status bar state

This is the highest-value split because the center region is where most session work happens.

### Right pane

`SessionRightPaneVm` should own:

- right sidebar expand/collapse state
- right-rail nav buttons and actions
- mobile drawer close behavior
- remote inbox panel visibility and toast callback wiring

### Overlay contract

`SessionOverlayVm` should own:

- command palette open state and items
- provider auth state
- rename state
- delete state
- share modal state
- permission overlay state
- question overlay state
- flyouts

## Hook extraction plan

### `use-session-search.ts`

Move search-specific state and behavior out of the page.

Owns:

- `searchOpen`
- `searchQuery`
- debounced query
- search hit generation
- active hit index
- active hit label
- open/close search actions
- next/previous hit navigation
- search result scroll targeting

Inputs:

- current messages
- developer mode flag
- optional message scroll API

Outputs:

- `searchVm`

Reason:

Search is a coherent feature and should be understood independently from layout.

### `use-session-windowing.ts`

Owns:

- `messageWindowStart`
- `messageWindowExpanded`
- session-scoped initialization of the message window
- hidden message count
- next reveal count
- earlier-message loading behavior
- batched rendered messages during streaming

Reason:

This logic is important, but it is conceptually separate from rendering the actual message list.

### `use-session-viewport.ts`

Owns:

- scroll container refs
- end sentinel refs
- initial bottom anchor behavior
- clipped-message detection
- `isViewingLatest`
- jump controls state
- jump-to-latest behavior
- jump-to-start-of-message behavior
- scroll scheduling
- observer setup/cleanup

Reason:

Scroll behavior is one of the highest-regression areas. It should be isolated and named as its own concern.

### `use-session-run-state.ts`

Owns:

- run baseline capture
- response-start detection
- run phase derivation
- run timer tick
- thinking status text
- progress signature tracking
- stall thresholds and stage
- abort/retry wrappers
- run footer display state

Reason:

The run-state block is currently dense and highly stateful. Extracting it creates immediate readability gains.

### `use-session-command-palette.ts`

Owns:

- open/close state
- mode switching
- query state
- active index
- filtered root/session/thinking items
- keyboard stepping helpers

Reason:

The command palette is a self-contained overlay feature.

### `use-session-agent-picker.ts`

Owns:

- agent picker open state
- load-on-open behavior
- busy/error/options state
- outside-click close behavior
- session agent application helper

Reason:

The agent picker is logically part of the composer domain, but it has enough async behavior to merit a small hook.

### `use-session-share.ts`

Owns:

- share modal workspace selection
- share fields derivation
- local/remote worker resolution logic
- workspace profile publishing
- skills set publishing
- export gating

Reason:

Sharing is a mini-feature and is almost completely independent from the conversation viewport.

### `use-session-remote-mirror.ts`

Owns:

- file session lifecycle
- worker-relative path resolution
- local mirror hydration
- sync timer loop
- conflict file creation
- cleanup on workspace/server changes

Reason:

This logic is not page logic. It is remote file infrastructure logic and should be isolated accordingly.

### `use-session-flyouts.ts`

Owns:

- flyout list state
- flyout creation/removal timing
- todo/file count transition observers

Reason:

Small but highly visual effect logic should stay out of the main page body.

## Reusable component strategy

Existing reusable components should remain reusable and mostly unchanged in the first pass.

### Reuse as-is where possible

- `_repos/openwork/apps/app/src/app/components/session/workspace-session-list.tsx`
- `_repos/openwork/apps/app/src/app/components/session/message-list.tsx`
- `_repos/openwork/apps/app/src/app/components/session/composer.tsx`
- `_repos/openwork/apps/app/src/app/components/session/inbox-panel.tsx`
- `_repos/openwork/apps/app/src/app/components/status-bar.tsx`
- existing generic modal components

### Important note on existing unused session components

There are already files that suggest an earlier attempt at stronger boundaries, such as:

- `_repos/openwork/apps/app/src/app/components/session/sidebar.tsx`
- `_repos/openwork/apps/app/src/app/components/session/context-panel.tsx`

These should **not** be folded into the first-pass extraction automatically.

Plan:

- do the feature-module extraction first
- keep these files untouched during the main move
- evaluate afterward whether to reuse, relocate, or remove them

Reason:

Mixing a structural refactor with a resurrection/deletion decision for partially-unused components will increase risk and noise.

## Detailed pane plan

### Left pane plan

Create `panes/session-left-pane.tsx`.

It should contain only:

- left update pill presentation
- `WorkspaceSessionList`
- left resize handle

It should not own:

- search state
- run state
- remote mirror logic
- share publishing logic

### Center pane plan

Create `panes/session-center-pane.tsx`.

Subdivide it into:

- `center/session-header.tsx`
- `center/conversation-pane.tsx`
- `center/conversation-empty-state.tsx`
- `center/conversation-jump-controls.tsx`
- `center/session-todo-tray.tsx`
- `center/session-run-footer.tsx`

This pane should own the entire center vertical stack:

- header
- optional search bar
- optional reload banner
- conversation body
- optional jump controls
- optional todo tray
- composer
- status bar

That gives contributors one obvious home for all center-column work.

### Right pane plan

Create `panes/session-right-pane.tsx`.

It should absorb the current right sidebar render helper.

Owns:

- expand/collapse button
- nav buttons to other dashboard surfaces
- inbox panel for remote workers
- mobile drawer close callback

It should not know about the center conversation internals.

## Overlay plan

Create `overlays/session-overlays.tsx` to compose the layer files.

Then move each overlay into a small file with a narrow prop contract.

### `session-command-palette.tsx`

Owns the command palette modal render only.

### `session-provider-auth-layer.tsx`

Owns `ProviderAuthModal` wiring only.

### `session-share-layer.tsx`

Owns `ShareWorkspaceModal` wiring only.

### `session-rename-layer.tsx`

Owns `RenameSessionModal` wiring only.

### `session-delete-layer.tsx`

Owns delete confirmation wiring only.

### `session-permission-layer.tsx`

Owns the permission interruption overlay only.

### `session-question-layer.tsx`

Owns `QuestionModal` wiring only.

### `session-flyouts-layer.tsx`

Owns rendering current flyouts only.

Reason:

This keeps interruptions and overlays from polluting the main page composition.

## Migration sequence

This refactor should be delivered in small phases.

### Phase 1: introduce the folder and route shim

Changes:

- add `pages/session/` folder
- create `session-page.tsx`, `session-layout.tsx`, `session-types.ts`
- reduce `pages/session.tsx` to a route shim

Expected result:

- no user-visible change
- stable routing
- better place to continue extraction

### Phase 2: extract pure helpers into `lib/`

Move pure, side-effect-free helpers first:

- message search text building
- workspace/session labeling helpers
- thinking/run label formatting helpers
- share payload builders where possible

Expected result:

- fewer inline utility functions
- easier later hook extraction

### Phase 3: extract center behavior hooks

Move:

- search
- windowing
- viewport/scroll
- run lifecycle

Expected result:

- largest readability improvement
- page/controller becomes substantially smaller

### Phase 4: extract remote mirror and share logic

Move:

- remote file mirror infrastructure
- share/export infrastructure

Expected result:

- server-facing side effects no longer mixed with JSX

### Phase 5: extract pane components

Create and wire:

- left pane
- center pane
- right pane

Expected result:

- code layout finally matches visual layout

### Phase 6: extract overlays

Move:

- command palette
- provider auth
- rename/delete/share layers
- permission/question layers
- flyouts

Expected result:

- session page reads as shell + panes + overlays

### Phase 7: contract tightening and cleanup

After the structural split is stable:

- reduce prop spread further
- remove obsolete local helpers
- decide whether old unused session components should be reused or deleted

## Verification plan

This refactor is structural, so verification must focus on behavior parity.

After each phase, verify:

### Session navigation

- open a session in the active workspace
- switch to another session in the same workspace
- switch workspaces and open a session there

### Conversation behavior

- send a prompt
- observe streaming output
- stop a run
- retry a run
- undo and redo the last user message
- compact session context

### Search and command palette

- open search with `Cmd/Ctrl+F`
- navigate matches
- close search
- open quick actions with `Cmd/Ctrl+K`
- navigate with arrow keys and Enter

### Message windowing and scroll

- load earlier messages
- verify jump-to-start and jump-to-latest controls
- verify initial load anchors to the bottom correctly

### Overlays

- rename session
- delete session
- open provider auth modal
- open share modal
- answer a pending question if available
- respond to a permission prompt if available

### Remote-only behavior

- open the right sidebar on a remote workspace
- verify inbox panel loads and refreshes
- if desktop remote-file flows are available, verify remote file mirror behavior still works after workspace switch

### Mobile behavior

- open and close mobile right drawer
- verify no header action becomes inaccessible on smaller widths

## Risks and mitigations

### Risk: scroll regressions

Reason:

- anchor and jump behavior are subtle and timing-sensitive

Mitigation:

- isolate in `use-session-viewport.ts`
- preserve behavior before optimizing
- verify initial anchor, search scroll, jump controls, and streaming auto-follow after each step

### Risk: keyboard shortcut regressions

Reason:

- the current page has overlapping key handling for search and command palette

Mitigation:

- centralize shortcut ownership in the relevant overlay hooks
- test `Cmd/Ctrl+K`, `Cmd/Ctrl+F`, arrow keys, Enter, Escape, and `Cmd/Ctrl+G`

### Risk: remote mirror cleanup leaks

Reason:

- file session cleanup and interval timers are easy to break during extraction

Mitigation:

- give remote mirror a dedicated hook with explicit cleanup tests on workspace changes and unmount

### Risk: focus restore regressions

Reason:

- rename/provider auth/search/command palette all currently restore focus in slightly different ways

Mitigation:

- define focus-restore behavior per overlay contract
- keep composer focus logic centralized

### Risk: structural churn without enough payoff

Reason:

- if the refactor only moves files without cleaning interfaces, the mental overhead remains

Mitigation:

- require grouped view models
- require page-level files to become visibly smaller and easier to scan

## Acceptance criteria

This refactor is complete when all of the following are true:

- `_repos/openwork/apps/app/src/app/pages/session.tsx` is reduced to a minimal route shim.
- the session feature lives in a dedicated `pages/session/` folder.
- the session page is composed from explicit layout, panes, and overlays.
- left, center, and right regions each have a primary file boundary.
- search, windowing, viewport, run state, sharing, and remote mirror logic are extracted from the page into hooks/services.
- the app behaves the same from a user perspective for the core session flows.
- the new structure makes it possible to change one region without reading the full feature.

## Final recommendation

Proceed with the feature-module refactor, but sequence it around behavior isolation first and JSX moves second.

Recommended order:

1. route shim and feature folder
2. pure helper extraction
3. center behavior hooks
4. remote/share hooks
5. pane extraction
6. overlay extraction
7. contract cleanup and dead-code review

This order gives OpenWork the biggest reduction in mental overhead with the lowest risk of session behavior regressions.
