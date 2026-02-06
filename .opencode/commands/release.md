---
description: Run the OpenWork release flow
---

You are running the OpenWork release flow in this repo.

Arguments: `$ARGUMENTS`
- If empty, default to a patch release.
- If set to `minor` or `major`, use that bump type.

## Two-command release

The release uses two scripts that live in `_repos/openwork/scripts/release/`.
Both support `--dry-run` to preview without side effects.

### Step 1: Prepare

Run from the `_repos/openwork` worktree on the `dev` branch:

```bash
cd _repos/openwork
pnpm release:prepare            # defaults to patch
pnpm release:prepare minor      # for minor bump
pnpm release:prepare --dry-run  # preview only
```

This will:
1. Verify you're on `dev` with a clean tree, synced with `origin/dev`.
2. Bump all package versions (`pnpm bump:<type>`).
3. Update the lockfile if needed (`pnpm install --lockfile-only`).
4. Run `pnpm release:review --strict` and fail on any mismatch.
5. Commit: `chore: bump version to X.Y.Z`.
6. Tag: `vX.Y.Z`.
7. Print a summary and the next command to run.

At this point you can inspect the commit (`git log -1 --stat`, `git diff HEAD~1`) before shipping.

### Step 2: Ship

```bash
pnpm release:ship          # pushes tag + dev
pnpm release:ship --watch  # pushes and tails the GHA workflow
pnpm release:ship --dry-run
```

This will:
1. Verify HEAD is tagged with a `vX.Y.Z` tag.
2. Push the tag to origin.
3. Push `dev` to origin.
4. Print the GitHub Actions workflow and release URLs.
5. Optionally tail the workflow run (`--watch`).

### Step 3: Draft + Publish Release Notes (last step)

After `release:ship`, draft release notes from the git diff between the previous tag and the new tag, then update the GitHub Release.

1) Compute tag range + inspect changes:

```bash
cd _repos/openwork

# Current tag (the one you just shipped)
tag="$(git tag --points-at HEAD | head -n 1)"

# Previous version tag (best-effort: highest semver-ish v* tag excluding current)
prev="$(git tag --list 'v[0-9]*' --sort=-v:refname | grep -v "^${tag}$" | head -n 1)"

echo "Range: ${prev}..${tag}"
git log --reverse --pretty=format:'- %s (%h)' "${prev}..${tag}"
git diff --stat "${prev}..${tag}"
```

2) Update the GitHub Release title + body (edit the bullets based on the commit list):

```bash
cd _repos/openwork

gh release edit "${tag}" --repo different-ai/openwork \
  --title "OpenWork ${tag} - <short theme>" \
  --notes "$(cat <<'EOF'
## Highlights
- <1-2 user-facing bullets>

## Fixes & polish
- <1-3 bullets>

## Packaging / ops
- <optional bullets>

Compare:
https://github.com/different-ai/openwork/compare/<PREV>...<TAG>
EOF
)"
```

Notes:
- Replace `<PREV>` and `<TAG>` in the compare URL with the actual values (for example: `v0.11.21...v0.11.22`).
- If `gh` auth is missing, run `gh auth login` once and re-run the `gh release edit` command.

### What the CI workflow does

The `Release App` workflow (`.github/workflows/release-macos-aarch64.yml`) handles:
- Verifying tag matches package versions
- Building + uploading openwrk sidecars (creates `openwrk-vX.Y.Z` release)
- Publishing npm packages (`openwrk`, `openwork-server`, `owpenwork`) — **after** sidecars complete
- Building desktop binaries for all platforms (macOS arm64/x64, Linux, Windows)
- Publishing AUR package

### Available scripts

| Command | Description |
|---|---|
| `pnpm release:prepare` | Bump + review + commit + tag |
| `pnpm release:prepare:dry` | Dry run of prepare |
| `pnpm release:ship` | Push tag + dev to origin |
| `pnpm release:ship:watch` | Push + tail GHA workflow |
| `pnpm release:review` | Run version consistency checks |

### Recovery

If CI fails after `release:ship`:
- Re-run the workflow: `gh workflow run "Release App" --repo different-ai/openwork -f tag=vX.Y.Z --ref dev`
- Check status: `gh run list --repo different-ai/openwork --workflow "Release App" --limit 3`
- Verify release: `gh release view vX.Y.Z --repo different-ai/openwork`
- Verify npm: `npm view openwrk version`

Report what you changed, the tag created, and the GHA status.
