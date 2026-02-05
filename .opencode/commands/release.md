---
description: Run the OpenWork release flow
---

You are running the OpenWork release flow in this repo.

Arguments: `$ARGUMENTS`
- If empty, default to a patch release.
- If set to `minor` or `major`, use that bump type.

Do the following, in order, and stop on any failure:

1. Sync `dev` and ensure the working tree is clean.
2. Bump unified release versions (app + desktop + Tauri + Cargo + `openwrk`) using `pnpm bump:$ARGUMENTS` (or `pnpm bump:patch` if empty).
3. If any dependencies were pinned or changed, run `pnpm install --lockfile-only`.
4. Run `pnpm release:review` and resolve any mismatches (this now includes `openwrk`).
5. Commit the version bump.
6. Tag and push: `git tag vX.Y.Z`, `git push origin dev`, then `git push origin vX.Y.Z`.
7. Watch the Release App GitHub Actions workflow to completion.
8. Release App should publish sidecars + npm packages when enabled (including `openwrk`, `openwork-server`, and `owpenwork`).
9. Manual recovery only: if GHA publishing is disabled or failed, publish sidecars to `openwrk-vX.Y.Z` and publish npm packages.

Report what you changed, the tag created, and the GHA status.
