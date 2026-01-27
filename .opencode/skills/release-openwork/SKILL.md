---
name: release-openwork
description: Standardize OpenWork patch releases and GitHub notes.
---

## Quick Usage (Already Configured)

### Patch release flow
1. Check the latest release tag and the commits since it.
2. Switch to the `dev` branch and pull the latest from origin.
3. Run `pnpm bump:patch` to update:
   - packages/app/package.json
   - packages/desktop/package.json
   - packages/desktop/src-tauri/tauri.conf.json
   - packages/desktop/src-tauri/Cargo.toml
   - Cargo.lock
4. Commit the version bump: `chore: bump version to X.Y.Z`.
5. Tag `vX.Y.Z` and push `dev` plus the tag to GitHub (triggers Release App).
6. Draft release notes from the commit list since the last tag with a short title plus Highlights and Fixes.
7. If GitHub auto-created the release, edit it to use the human-readable notes.

### Suggested commands
```bash
git fetch --tags --prune
git tag --list "v*" --sort=-v:refname | head -n 1
git log <last-tag>..HEAD --oneline
git switch dev
git pull --ff-only origin dev
pnpm bump:patch
git commit -am "chore: bump version to X.Y.Z"
git tag vX.Y.Z
git push origin dev --tags
gh release edit vX.Y.Z --title "OpenWork vX.Y.Z" --notes-file release-notes.md
```

## Common Gotchas

- The release workflow auto-creates the GitHub release after tag push; edit it instead of creating a new one.
- Make sure you are not in a detached HEAD before running the bump script.

## First-Time Setup (If Not Configured)

1. Install dependencies with `pnpm install`.
2. Ensure `gh auth login` is complete so release edits succeed.
