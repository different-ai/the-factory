---
name: release-openwork
description: Standardize OpenWork patch releases and GitHub notes.
---

## Quick Usage (Already Configured)

### Patch release flow
1. Fetch tags and create a fresh worktree from `origin/dev` for the release.
2. In the worktree, ensure `dev` is up to date with origin.
3. Check the latest release tag and the commits since it.
4. Run `pnpm bump:patch` to update:
   - packages/app/package.json
   - packages/desktop/package.json
   - packages/desktop/src-tauri/tauri.conf.json
   - packages/desktop/src-tauri/Cargo.toml
   - Cargo.lock
5. Commit the version bump: `chore: bump version to X.Y.Z`.
6. Tag `vX.Y.Z` and push `dev` plus the tag to GitHub (triggers Release App).
7. Draft release notes from the commit list since the last tag with a short title plus Highlights and Fixes.
8. If GitHub auto-created the release, edit it to use the human-readable notes.

### Suggested commands
```bash
git fetch origin --tags --prune
git worktree add -b release/openwork-YYYY-MM-DD _worktrees/release-openwork-YYYY-MM-DD origin/dev
cd _worktrees/release-openwork-YYYY-MM-DD
git pull --ff-only origin dev
git for-each-ref --sort=-v:refname --count=1 --format="%(refname:short)" "refs/tags/v[0-9]*.[0-9]*.[0-9]*"
git log <last-tag>..HEAD --oneline
pnpm bump:patch
git commit -am "chore: bump version to X.Y.Z"
git tag vX.Y.Z
git push origin HEAD:dev --tags
gh release edit vX.Y.Z --title "OpenWork vX.Y.Z" --notes-file release-notes.md
```

## Common Gotchas

- The release workflow auto-creates the GitHub release after tag push; edit it instead of creating a new one.
- Always run release steps from a fresh worktree to avoid dirty local state.
- Make sure you are not in a detached HEAD before running the bump script.

## First-Time Setup (If Not Configured)

1. Install dependencies with `pnpm install`.
2. Ensure `gh auth login` is complete so release edits succeed.
