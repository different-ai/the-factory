---
name: update-context-repo-to-latest
description: |
  Fetch and fast-forward the OpenWork enterprise repo and its subrepos to their latest remote heads when it is safe to do so.

  Triggers when user mentions:
  - "get latest changes"
  - "update context repo to latest"
  - "pull all subrepos"
---

## Quick Usage (Already Configured)

### Update the root repo and subrepos to their remote heads
```bash
.opencode/skills/update-context-repo-to-latest/scripts/update-context-repo-to-latest.sh
```

## What This Does

- Fetches `origin` in the root repo and every initialized submodule.
- Fast-forwards clean repos to `origin/<current-branch>` with `git pull --ff-only`.
- Skips repos that are dirty, detached, missing `origin`, or missing a matching remote branch.
- Prints a clear summary of what was updated and what needs manual attention.

## Common Gotchas

- Dirty repos are skipped on purpose so local work is not overwritten.
- Detached HEAD submodules are fetched but not moved automatically.
- This skill updates repos to their current branch heads, not the superproject's pinned submodule SHAs.
- If you need pinned submodule sync instead, use `.opencode/skills/sync-submodules/SKILL.md`.

## First-Time Setup (If Not Configured)

1. Make sure the root repo and target subrepos have an `origin` remote.
2. Initialize submodules if needed:
```bash
git submodule update --init --recursive
```
3. Run the script from the root of `openwork-enterprise`.
