---
name: changelog-release-tracker
description: |
  Generate or update the internal OpenWork release changelog tracker as plain markdown release sections.

  Triggers when user mentions:
  - "generate changelog markdown"
  - "track this release"
  - "add a changelog entry"
---

## Purpose

Use this skill to add or update the OpenWork release tracker using release history from `_repos/openwork`.

Default output path from OpenWork enterprise: `_repos/openwork/changelog/release-tracker.md`

If you are operating inside the OpenWork repo directly, use `changelog/release-tracker.md`.

## Output Contract

- The output file must be plain markdown sections, not a pipe table.
- Do not use markdown pipe-table syntax anywhere in the file.
- Do not wrap the final file contents in triple backticks.
- Do not emit HTML tables.
- Keep release sections sorted oldest to newest so new versions append at the end.
- If the tracker file already exists, preserve its formatting and append or edit `## <version>` sections in place.
- Each subsection inside a release must use a `####` heading, not a leading `- Label:` bullet.
- Use plain text under scalar subsections; only use bullets for fields that are actual lists.
- Include a lines-of-code subsection and a release-importance subsection for every release.

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
   git diff --shortstat <previous-tag>..<tag>
   ```

3. Inspect any commit that looks user-facing before summarizing it:

   ```bash
   git show --stat --summary <sha>
   ```

4. Derive release values with these rules:
    - `Commit`: use the tag commit from `git rev-list -n 1 <tag>`, shortened to 8 characters.
    - `Main Changes (3 bullets)`: always write exactly 3 bullets, ordered by user impact.
    - `Lines of code changed since previous release`: use `git diff --shortstat <previous-tag>..<tag>` and rewrite it as `N lines changed since \`<previous-tag>\` (A insertions, D deletions).`
    - If git reports only insertions or only deletions, write the missing side as `0` so the sentence stays structurally consistent.
    - `Release importance`: always write exactly one sentence in one of these two forms:
      - `Minor release: <core reason this was released in one line>.`
      - `Major release: <core reason it is a major release in one line>.`
    - Do not decide major vs minor from line count alone.
    - Mark a release as `Major release:` when the user experience changes substantially, a major refactor or architecture/runtime change lands, a key security vulnerability is patched, multiple core features are deprecated/removed, or several shipped changes materially alter how users use OpenWork.
    - Mark a release as `Minor release:` for focused bug fixes, UX polish, isolated feature additions, local workflow improvements, packaging refreshes, or changes that improve reliability without materially changing the product's overall shape.
    - `One-Line Summary`: one sentence, with the main outcome first.
    - `Major Improvements`: set to `True` only for net-new user-facing capabilities or materially expanded workflows; max 5 items.
    - `Major Bugs Resolved`: set to `True` only for user-facing or release-blocking fixes; max 5 items.
    - `Deprecated Features`: set to `True` only when a user-facing feature or functionality was intentionally retired or replaced.
    - Ignore version bumps, lockfiles, screenshots, docs-only changes, and packaging-only changes when counting improvements or bugs.
    - When a boolean is `False`, set the paired count to `0`.
    - When a details section has no items, write `None.` as plain text under its `####` heading.
    - `Published in changelog page` must always be `True` or `False`.
    - `Published in docs` must always be `True` or `False`.
    - Default both publication fields to `False` unless the user explicitly says the release was published there.

5. Write or update the tracker as direct markdown text in this order:
    - File title: `# Release Changelog Tracker`
    - Intro line: `Internal preparation file for release summaries. This is not yet published to the changelog page or docs.`
    - One `## <version>` section per release
    - Inside each release section, include these `####` headings in this exact order:
      - `#### Commit`
      - `#### Released at`
      - `#### One-line summary`
      - `#### Main changes` followed by exactly 3 bullets
      - `#### Lines of code changed since previous release`
      - `#### Release importance`
      - `#### Major improvements`
      - `#### Number of major improvements`
      - `#### Major improvement details` followed by bullets only if needed
      - `#### Major bugs resolved`
      - `#### Number of major bugs resolved`
      - `#### Major bug fix details` followed by bullets only if needed
      - `#### Deprecated features`
      - `#### Number of deprecated features`
      - `#### Deprecated details` followed by bullets only if needed
      - `#### Published in changelog page`
      - `#### Published in docs`
    - Under each heading, write the value on the next line instead of `- Label: value`.
    - The two publication headings must contain boolean text, not blanks.

6. Match the current OpenWork tracker format. A valid release block looks like this in the final file:
    ```markdown
    ## v0.11.101

    #### Commit

    `87fda845`

    #### Released at

    `2026-02-19T21:26:55Z`

    #### One-line summary

    Improves local session reliability first, then adds clearer Soul controls and cleaner settings and sidebar actions.

    #### Main changes

    - Added a local recovery flow for broken OpenCode database migrations so local startup can repair itself.
    - Improved Soul starter observability and steering so users can inspect and guide Soul behavior more clearly.
    - Refreshed compact action buttons across settings and sidebars to make update and connection controls easier to scan.

    #### Lines of code changed since previous release

    1248 lines changed since `v0.11.100` (933 insertions, 315 deletions).

    #### Release importance

    Minor release: improves local recovery, Soul steering, and interface clarity without changing the product's core architecture.

    #### Published in changelog page

    False

    #### Published in docs

    False
    ```

7. Validate before committing:
    - `git diff --check`
    - confirm there are no lines starting with `|` in the tracker file
    - confirm subsection labels are `####` headings, not `- Label:` bullets
    - confirm `#### Published in changelog page` and `#### Published in docs` are followed by `True` or `False`
    - confirm `#### Release importance` starts with either `Minor release:` or `Major release:`

## Common Gotchas

- The final file is markdown text, not a markdown table embedded inside a markdown file.
- A fenced example inside the skill is fine for reference, but the generated tracker file itself must not contain fences.
- Do not treat `table in markdown` as acceptable; it is explicitly the wrong output shape.
- Do not fall back to `- Commit: ...` style labels; subsection headings are required so entries are easier to target programmatically.
- Do not leave the publication headings blank; they are booleans, not placeholders.
- Do not treat the release bump commit as a feature by itself.
- Use the release body to anchor the summary, but use commit inspection to verify the real user-facing changes.
- Keep every bullet user-facing; avoid internal implementation details unless they are visible in the product.
