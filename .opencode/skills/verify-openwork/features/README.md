# OpenWork verification map

This is the maintained user-facing verification source. Read the matching map before choosing a world/spec. All commands below are from the **enterprise root**, with product source at `_repos/openwork`; the native surface is macOS Electron unless marked headless.

## Baseline preconditions

- Follow `../SKILL.md` Launch and read-only Doctor for a unique, owned `preview-desktop` stage. Never drive an installed/personal desktop or attach to an arbitrary fixed CDP port.
- Native specs below launch **their own** isolated profiles through `@openwork/testkit`; they do not attach to the preview. Each has its own fixture readiness and read-only probes before acts. Do not use a preview doctor as authorization for a different instance.
- Root and eval workspaces are installed separately. Run one spec at a time with `--local`. Native-only worlds require the GUI shell; no Den/MySQL/provider keys are needed for these four seeded desktop journeys.
- World setup may create a scratch workspace/session or deterministic boundary fixture before the first act. That is not proof that the user-created-workspace journey passed. A missing precondition fails or skips explicitly; do not weaken claims.
- No injected real org credentials, external customer data or production profiles. Dependency/sidecar downloads during setup are real network activity; a no-inference journey is not an offline install proof.

## Driving conventions

- `user` drives real controls via trusted CDP input; `agent.actions()` discovers existing control-rail operations before `agent.run(action,args)`. Never invent an action ID.
- `probe` is observation only; local-server GETs through `probe.desktopApi` keep auth inside the renderer. Arrange through `seed` before acts, not runtime state setters.
- Exact selectors are copied from current specs; `testId`, `role`, `label` and well-known `"composer"` are supported testkit targets. Prefer these to coordinates.
- Commands name existing specs, not a second harness. `--surface electron` validates a declared desktop world and cannot turn `appWeb` into Electron.
- Observe side effects through a second read (saved config, engine permissions, persisted composer state, native browser document identity, or scoped updater witness). Restore/delete only the run's fixtures through its lifecycle. Keep evidence.

## Proof and skip reporting

Record feature ID, entry point, source HEAD/branch, local placement line, exact command, exit code, counts and gaps. Require action/result screenshots plus machine-checkable side effects. Read `test-run.json`, step captions, traces and images under `_repos/openwork/evals/results/test-runs/`; copy this run's records to the separate `outputs/verify-openwork` proof directory before scratch teardown. A spec that passes without adequate evidence is **Incomplete**, not an excuse to drop the proof requirement.

Only approval-mode was selected for this skill's initial native proof. Other feature maps are source-grounded recipes, **not claims of executed coverage**. Run every listed entry point before declaring a whole map verified; a convenient path does not certify alternatives. Pending visual judgments, missing fixture preconditions and selected skips are Incomplete; report the exact reason. On failure load product `diagnose-a-red-run`; do not call it pre-existing without a clean same-command control.

## Feature entry contract

Each file has an H1 and user-facing description, then exactly these four H2s, in order: `Sub-features`, `How to get to it (user POV)`, `Driving it with @openwork/testkit`, `Gotchas`. Drive starts with `Preconditions:`. Implementation citations belong in Gotchas, not substitutes for a user recipe.

## Features

| Map | Feature IDs | Surface and proof scope |
| --- | --- | --- |
| [Workspace approval mode](workspace-approval-mode.md) | `run-mode-*` | Native, real saved config and effective engine policy; initial proof target |
| [Prompt recall](prompt-recall.md) | `recall-*` | Native v1, persisted prompts, reload and real main-process restart; no model calls |
| [Built-in browser](built-in-browser.md) | `browser-*` | Native child browser view, local fixture pages, geometry/focus and retained input |
| [Update controls](desktop-updates.md) | `updates-*` | Native UI; fake updater/installer boundary, never a real application update |

Secondary surfaces are intentionally not conflated with these maps: gateway `/mcp/agent` search/execution and Den administration need separate seeded org/server worlds and auth. Discover `preview-den`/`preview-full` with the existing world CLI and read their specs before adding coverage. A signed-out standalone run cannot prove them.
