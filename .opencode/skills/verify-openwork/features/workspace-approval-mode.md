# Workspace approval mode

A desktop user can expose a workspace-wide approval control, ask before actions, explicitly confirm Keep going, and restore inherited defaults. Hiding the control must not silently change saved permissions.

## Sub-features

- `run-mode-opt-in`: Advanced setting reveals the control without writing policy.
- `run-mode-ask`: Ask before actions persists an ask catch-all and reaches the engine.
- `run-mode-cancel`: opening/cancelling Keep going changes nothing.
- `run-mode-confirm`: only explicit confirmation persists allow.
- `run-mode-defaults`: Workspace defaults removes the catch-all and restores inherited policy.
- `run-mode-hide`: disabling visibility preserves saved policy, including after reload.

## How to get to it (user POV)

- Open the account menu → Settings → Advanced → Show workspace run mode.
- Choose Back to app; open the workspace run-mode button in the composer.
- Choose Ask before actions, Keep going, or Workspace defaults. Keep going opens Let OpenWork keep going?; choose Cancel or Enable Keep going.
- Return to Advanced and disable Show workspace run mode to hide the control.

## Driving it with @openwork/testkit

Preconditions:

- Isolated native desktop with standard **v1** engine. A headless app has this control disabled.
- Fixture `emptyDesktopSession` creates a new scratch workspace (`create: true`) outside the source tree and a session before acts; no account, model call or Den is required.
- A seeded session is not a verified New task/create-workspace entry path.

Run from the enterprise root:

```sh
pnpm -C _repos/openwork evals:e2e composer-run-mode --local --engine v1 --surface electron
```

- **Doctor/before.** `user.see("composer", { editable: true })`; GET the workspace `config`, `permissions/mode`, `permissions/effective` with `probe.desktopApi`. Require status 200, supported default mode, inherited MCP row. Record route and baseline screenshot before changing settings.
- **Expose.** `user.click({ testId: "account-status-menu" })`, `user.click("Settings")`, `user.click("Advanced")`, `user.click({ testId: "workspace-run-mode-flag", label: "Show workspace run mode" })`, `user.click("Back to app")`. Open `{ testId: "workspace-run-mode-trigger" }`. See Workspace defaults and footer Applies to every chat in this workspace. Specific workspace rules still apply. Saved policy equals the pre-action read; capture the menu.
- **Ask and persist.** Click `{ testId: "run-mode-approve" }`; see trigger label `Workspace run mode: Ask before actions`, reload and see it again. The exact scoped read is ``probe.desktopApi(`/workspace/${encodeURIComponent(world.workspace.workspaceId)}/permissions/mode`)``; it must report `mode: "approve"`, `catchAll: "ask"`, `refreshPending !== true`. `config.opencode.permission["*"]` is `ask`; effective MCP row is `{ action: "ask", source: "workspace" }`.
- **Cancel.** Open the trigger and click `{ testId: "run-mode-run-everything" }`. Screenshot the Let OpenWork keep going? confirmation; click `{ role: "button", label: "Cancel" }`. Compare full saved mode/config/effective MCP reads before/after: unchanged, still Ask before actions.
- **Confirm.** Repeat Keep going; click `{ role: "button", label: "Enable Keep going" }`. See trigger label `Workspace run mode: Keep going`. Observe `mode: "run-everything"`, `catchAll: "allow"`, saved catch-all `allow` and effective workspace MCP `allow`; capture result.
- **Restore defaults.** Open trigger → `{ testId: "run-mode-default" }`; saved catch-all absent, mode and effective MCP match baseline. Capture result.
- **Hide safely.** Set Ask again; disable the Advanced flag; Back to app; reload. Trigger remains absent and saved/effective policy equals the pre-hide read. Capture result and assertion evidence. Dispose only this spec's native profile/workspace.

## Gotchas

- This control changes **all chats in the fixture workspace**. Never do it on the user's workspace, and never send a model prompt just to test the control.
- Every local API route is scoped with `const mount = '/workspace/' + encodeURIComponent(world.workspace.workspaceId)`; use the executable spec rather than guessing IDs/tokens. `probe.desktopApi` is GET-only. The spec bounds policy propagation at 60 seconds.
- Compare config values, not `updatedAt`: engine reattachment changes that clock on reload.
- Reusing a source-root workspace inherits the repo's permissive config and invalidates the default-policy precondition. The existing world explicitly creates at a scratch path; preserve that.
- Source: `evals/specs/composer-run-mode.e2e.test.ts`, `evals/worlds/desktop.ts`, product `workspace-run-mode-menu.tsx`. Evidence-only additions in this task capture before/action/after and observed policy; no production code changes.
