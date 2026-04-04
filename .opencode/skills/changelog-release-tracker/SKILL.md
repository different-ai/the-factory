---
name: changelog-release-tracker
description: |
  Generate or update the internal OpenWork release changelog tracker from tagged releases.

  Triggers when user mentions:
  - "generate changelog table"
  - "track this release"
  - "add a changelog row"
---

## Purpose

Use this skill to add or update rows in the OpenWork release tracker using release history from `_repos/openwork`.

## Inputs

- One or more release tags such as `v0.11.101`
- Optional output file path; default to `_repos/openwork/changelog/release-tracker.md` when working from OpenWork enterprise

## Steps

1. Work from a dedicated worktree and confirm the tracker file path.
2. In `_repos/openwork`, gather release metadata for each tag:

   ```bash
   gh release view <tag> --repo different-ai/openwork --json tagName,publishedAt,body
   git rev-list -n 1 <tag>
   git log --oneline --no-merges <previous-tag>..<tag>
   ```

3. Inspect any commit that looks user-facing before summarizing it:

   ```bash
   git show --stat --summary <sha>
   ```

4. Derive row values with these rules:
   - `Commit`: use the tag commit from `git rev-list -n 1 <tag>`, shortened to 8 characters.
   - `Main Changes (3 bullets)`: always write exactly 3 bullets, ordered by user impact.
   - `One-Line Summary`: one sentence, with the main outcome first.
   - `Major Improvements`: set to `True` only for net-new user-facing capabilities or materially expanded workflows; max 5 items.
   - `Major Bugs Resolved`: set to `True` only for user-facing or release-blocking fixes; max 5 items.
   - `Deprecated Features`: set to `True` only when a user-facing feature or functionality was intentionally retired or replaced.
   - Ignore version bumps, lockfiles, screenshots, docs-only changes, and packaging-only changes when counting improvements or bugs.
   - When a boolean is `False`, set the paired count to `0` and the paired list cell to `- None.`
   - Leave `Changelog Page Published` and `Docs Published` empty unless the user explicitly says they were published.

5. Update `_repos/openwork/changelog/release-tracker.md` with one row per release. If you are operating inside the OpenWork repo directly, use `changelog/release-tracker.md`. Use `<br>` between bullets inside cells so the table stays single-row per release.

6. Validate before committing:

   ```bash
   git diff --check
   ```

## Common Gotchas

- Do not treat the release bump commit as a feature by itself.
- Use the release body to anchor the summary, but use commit inspection to verify the real user-facing changes.
- Keep every bullet user-facing; avoid internal implementation details unless they are visible in the product.
