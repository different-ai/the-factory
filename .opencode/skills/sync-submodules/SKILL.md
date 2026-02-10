---
name: sync-submodules
description: |
  Safely sync/pull the superproject and update git submodules, including handling dirty submodules (e.g. a modified Cargo.lock) via stash.

  Triggers when user mentions:
  - "sync submodules"
  - "submodule update failed"
  - "local changes would be overwritten by checkout"
  - "not our ref"
---

## Quick Usage (Already Configured)

### 1) See what is dirty (root + submodules)
```bash
date
git status --porcelain
git submodule foreach --recursive 'echo "--- $name ($path)"; git status --porcelain'
```

### 2) If a submodule is dirty, stash inside that submodule

Example for `_repos/openwork` when `Cargo.lock` blocks an update:
```bash
git -C _repos/openwork status --porcelain
git -C _repos/openwork stash push -u -m "wip: allow submodule update"
```

Notes:
- Stashes are per-repo. You must run `git stash` in the submodule itself.
- Use `-u` if untracked files exist.

### 3) Pull root + update submodules to the commits pinned by the root repo
```bash
git pull
git submodule sync --recursive
git submodule update --init --recursive
date
```

### 4) Re-apply the stash (optional)
Only do this if you actually want your local submodule changes back.
```bash
git -C _repos/openwork stash list
git -C _repos/openwork stash pop
```

## Common Gotchas

- `error: Your local changes ... would be overwritten by checkout` means the submodule has local changes and `git submodule update` is trying to move it to the commit pinned by the root repo.
- Avoid `git submodule foreach --recursive 'git pull'` for normal syncing. Submodules are typically pinned to specific commits; pulling inside them can move them off the pinned commit and make the root repo look dirty.
- If you *intend* to bump submodules to newer upstream commits, that is a different operation (it changes the root repo):
```bash
git submodule update --remote --recursive
git status
```

## Submodule Pin Is Unreachable ("not our ref")

Symptom:
- `fatal: remote error: upload-pack: not our ref <sha>` while fetching a submodule.

Meaning:
- The root repo points at a submodule commit SHA that the submodule remote no longer advertises (history rewrite, deleted branch/tag, or missing permissions).

Fix (safe, local):
1. Pull root without touching submodules:
```bash
git pull --recurse-submodules=no
```
2. Move the submodule to a reachable ref (example uses `origin/dev`):
```bash
git -C _repos/<name> fetch origin --prune
git -C _repos/<name> checkout dev
git -C _repos/<name> pull --ff-only origin dev
```
3. Stage the gitlink in the root repo:
```bash
git add _repos/<name>
git status
```

Fix (proper, shared):
- Open a PR that repins the submodule to a reachable commit and avoid force-pushing branches/tags that are used as submodule pins.

## One-Liner Helper (Conservative)
This prints dirty submodules without changing anything:
```bash
git submodule foreach --recursive 'test -z "$(git status --porcelain)" || echo "DIRTY: $name ($path)"'
```
