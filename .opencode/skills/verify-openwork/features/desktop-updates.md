# Desktop update controls

A desktop user can discover a newer release without losing a staged download, choose Download or Install & restart, and cancel a restart confirmation without installing anything.

## Sub-features

- `updates-auto`: a newer background release replaces the staged download.
- `updates-check`: Check now preserves the staged release while showing the newer one.
- `updates-download`: explicit Download replaces the staged release.
- `updates-install`: Install & restart fetches the newer version before installing.
- `updates-cancel`: Keep working installs nothing.
- `updates-layout`: readable version rows/buttons stay stable within a narrow window.

## How to get to it (user POV)

- Open Settings updates; on macOS use Release channel → Alpha where the fixture selects alpha.
- Use Check automatically, Check now, Download, or Install & restart.
- In the titlebar choose Restart to update → Restart OpenWork? → Keep working or Restart & update.

## Driving it with @openwork/testkit

Preconditions:

- `desktopUpdateCheckNowWorld` is explicitly local-only native Electron, no Den services.
- The real renderer uses a **deterministic fake updater/download/installer bridge** arranged by the world before acts. Never substitute production update endpoints or actually install/restart the user's app.
- The world publishes staged/newer versions and exposes the scoped observation witness. Release/version values come from `world.releases` in the existing spec, not guessed release numbers.

```sh
pnpm -C _repos/openwork evals:e2e desktop-update-check-now --local --engine v1 --surface electron
```

- **Stage baseline.** Use the world's `openSettings()` user path. On alpha, click `{ role: "combobox", label: "Release channel" }` → `{ role: "option", label: "Alpha" }`; toggle `{ role: "switch", label: "Check automatically" }` as the spec directs to arm its interval witness. Click `{ role: "button", text: "Check now" }`; see You're up to date, then the fixture's published initial release and Ready to install state. Capture screenshot.
- **Automatic update.** Let the fixture advance its feed and deterministic timer; the staged capsule disappears during the replacement download, then Restart to update returns. Read `world.snapshot()` and require download history contains staged then newer versions; no install yet.
- **Cancel restart.** Click Restart to update; see Restart OpenWork?; choose Keep working. Witness `installs` remains empty and the staged update remains available.
- **Explicit update.** Choose Check now; separate staged/newer versions remain visible. Depending on the existing test case, click Download then Install & restart, or directly Install & restart. The witness must show the newer download **before** the one newer-version install. Confirm via Restart & update only in this fake-installer world.
- **Layout and proof.** Current read selectors: `[data-testid="updates-latest-version"]`, `[data-testid="updates-versions"]`, `[data-testid="updates-actions"]`, `[data-testid="updates-status"]`, `header [data-update-button]`, `[role="alertdialog"]`. The spec checks stable row/button geometry at 860px, captures screenshots and explicit assertion evidence. Inspect all test cases' screenshots and scoped witness outputs.

## Gotchas

- Source: `evals/specs/desktop-update-check-now.e2e.test.ts`, `evals/worlds/desktop-update-check-now.ts`.
- This is **UI orchestration with a fake installer**, not release discovery/download/signature validation, actual installation, packaged updater or native application replacement proof. Report that boundary with every verdict.
- Never click Install & restart on an ambient desktop. Only this fixture guarantees no actual installation. Mock behavior must be observed (`downloads`/`installs` history), not trusted from a dry-run label.
- Initial skill-generation proof does not execute this map. A failed fixture requirement is a failed/Incomplete journey, not permission to run against the installed app.
