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
- Include a `Title` subsection for every release.
- The `Title` must be concise, publish-ready, and reusable almost verbatim in the public changelog.
- The `Title`, `One-line summary`, and `Main changes` must complement each other instead of repeating the same wording at different lengths.

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

3. Read nearby published entries in `_repos/openwork/packages/docs/changelog.mdx` before drafting language so the tracker entry matches the current public changelog voice and you can verify whether the release is already published there.

4. Inspect any commit that looks user-facing before summarizing it:

   ```bash
   git show --stat --summary <sha>
   ```

5. Derive release values with these rules:
    - `Commit`: use the tag commit from `git rev-list -n 1 <tag>`, shortened to 8 characters.
    - `Title`: write one concise publish-ready line that states the release's core substance up front.
    - The `Title` should usually be 6-14 words, in sentence case, and focus on the most important user-facing or developer-facing outcome.
    - Lead the `Title` with the primary workflow, product surface, or capability that changed, not with a generic verb like `Improves several areas`.
    - The `Title` must be reusable almost verbatim as the release-level headline sentence in `_repos/openwork/packages/docs/changelog.mdx`, even though the public file does not have a separate `Title` field.
    - The `Title` should sound like a strong changelog headline: concrete, direct, and outcome-first.
    - Avoid version numbers, release-process wording, and filler such as `This release`, `Shipped`, `Various`, `Several`, or `Miscellaneous`.
    - Avoid internal-only implementation terms unless they are visible to users or directly relevant to developers, such as APIs, CLI flows, providers, MCP setup, or documented product surfaces.
    - Prefer visible nouns and surfaces such as `workspace switching`, `session loading`, `Settings`, `Cloud sign-in`, `skill editing`, `API auth`, or `MCP connections` over repo mechanics or internal package names.
    - If the public changelog entry is likely to be a single sentence, the `Title` should usually be close to that final sentence and the `One-line summary` should add a bit more scope.
    - If the public changelog entry is likely to be a 3-bullet release, use the `Title` as the release-level headline that introduces those bullets without awkwardly compressing every bullet into one overloaded sentence.
    - `One-line summary`: write exactly one sentence that expands the `Title` with the main outcome first, then adds the most relevant scope or secondary effects.
    - The `One-line summary` should add context, not restate the `Title` with only a few extra adjectives.
    - Prefer 18-30 words for the `One-line summary` unless the release is unusually simple.
    - `Main changes`: always write exactly 3 bullets, ordered by user impact.
    - Each `Main changes` bullet must describe a visible workflow, product surface, or developer-facing capability in user-friendly language.
    - Start each `Main changes` bullet with a strong action verb such as `Added`, `Fixed`, `Simplified`, `Restored`, `Hardened`, `Cleaned up`, `Made`, or `Improved`.
    - Keep the three `Main changes` bullets parallel in tone and structure when possible.
    - Prefer concrete workflow outcomes over internal implementation details. State what the release lets users do, what became clearer, or what became more reliable.
    - Only mention implementation details when they materially matter to developers using a visible surface such as the CLI, API, MCP configuration, auth providers, or documented settings.
    - `Lines of code changed since previous release`: use `git diff --shortstat <previous-tag>..<tag>` and rewrite it as `N lines changed since \`<previous-tag>\` (A insertions, D deletions).`
    - If git reports only insertions or only deletions, write the missing side as `0` so the sentence stays structurally consistent.
    - `Release importance`: always write exactly one sentence in one of these two forms:
      - `Minor release: <core reason this was released in one line>.`
      - `Major release: <core reason it is a major release in one line>.`
    - Do not decide major vs minor from line count alone.
    - Mark a release as `Major release:` when the user experience changes substantially, a major refactor or architecture/runtime change lands, a key security vulnerability is patched, multiple core features are deprecated/removed, or several shipped changes materially alter how users use OpenWork.
    - Mark a release as `Minor release:` for focused bug fixes, UX polish, isolated feature additions, local workflow improvements, packaging refreshes, or changes that improve reliability without materially changing the product's overall shape.
    - `Major Improvements`: set to `True` only for net-new user-facing capabilities or materially expanded workflows; max 5 items.
    - `Major Bugs Resolved`: set to `True` only for user-facing or release-blocking fixes; max 5 items.
    - `Deprecated Features`: set to `True` only when a user-facing feature or functionality was intentionally retired or replaced.
    - Ignore version bumps, lockfiles, screenshots, docs-only changes, and packaging-only changes when counting improvements or bugs.
    - If the release is mostly packaging, republishing, or metadata synchronization, say that directly instead of inventing user-visible impact.
    - Prefer present-tense, outcome-first changelog language similar to strong public changelogs: direct, concrete, and easy to scan.
    - Prefer parallel lists such as `Cleans up X, reduces Y, and fixes Z` over sequential framing such as `first, then`.
    - Sequential framing is still acceptable when the release genuinely has a primary change followed by supporting changes and that ordering is important to the story.
    - Use developer-friendly language when the change is visible to developers, but keep it anchored to a workflow they actually touch.
    - Do not let the `Title`, `One-line summary`, and `Main changes` collapse into three copies of the same sentence.
    - When a boolean is `False`, set the paired count to `0`.
    - When a details section has no items, write `None.` as plain text under its `####` heading.
    - `Published in changelog page` must always be `True` or `False`.
    - `Published in docs` must always be `True` or `False`.
    - If the release already appears in `_repos/openwork/packages/docs/changelog.mdx`, set `Published in changelog page` to `True`.
    - Only default `Published in changelog page` to `False` after checking `_repos/openwork/packages/docs/changelog.mdx`.
    - Default `Published in docs` to `False` unless you can verify a separate published docs surface for that release.

6. Write or update the tracker as direct markdown text in this order:
    - File title: `# Release Changelog Tracker`
    - Intro line: `Internal preparation file for release summaries. This is not yet published to the changelog page or docs.`
    - Keep the file-level intro line as-is even if some individual releases inside the tracker are already published.
    - One `## <version>` section per release
    - Inside each release section, include these `####` headings in this exact order:
      - `#### Commit`
      - `#### Released at`
      - `#### Title`
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

7. Match the current OpenWork tracker format. A valid release block looks like this in the final file:
    ```markdown
    ## v0.11.101

    #### Commit

    `87fda845`

    #### Released at

    `2026-02-19T21:26:55Z`

    #### Title

    Local recovery and Soul controls land with cleaner app chrome.

    #### One-line summary

    Improves local session reliability while adding clearer Soul controls and cleaner settings and sidebar actions.

    #### Main changes

    - Added a local recovery flow for broken OpenCode database migrations so local startup can repair itself.
    - Improved Soul starter observability and steering so users can inspect and guide Soul behavior more clearly.
    - Refreshed compact action buttons across settings and sidebars to make update and connection controls easier to scan.

    #### Lines of code changed since previous release

    1248 lines changed since `v0.11.100` (933 insertions, 315 deletions).

    #### Release importance

    Minor release: improves local recovery, Soul steering, and interface clarity without changing the product's core architecture.

    #### Major improvements

    True

    #### Number of major improvements

    2

    #### Major improvement details

    - Added a repair flow for failed local OpenCode database migrations from onboarding and Settings > Advanced.
    - Added stronger Soul starter steering and observability controls, including clearer status and improvement actions.

    #### Major bugs resolved

    True

    #### Number of major bugs resolved

    1

    #### Major bug fix details

    - Fixed a local startup failure path by letting users recover from OpenCode migration issues instead of getting stuck on a broken local flow.

    #### Deprecated features

    False

    #### Number of deprecated features

    0

    #### Deprecated details

    None.

    #### Published in changelog page

    False

    #### Published in docs

    False
    ```

8. Validate before committing:
    - `git diff --check`
    - confirm there are no lines starting with `|` in the tracker file
    - confirm subsection labels are `####` headings, not `- Label:` bullets
    - confirm every release block includes `#### Title`
    - confirm the `Title` is publish-ready, specific, and not just a shorter duplicate of the `One-line summary`
    - confirm the `One-line summary` expands the `Title` instead of repeating it
    - confirm the `Main changes` bullets add concrete workflow detail that is not already fully captured by the `Title`
    - confirm `#### Published in changelog page` and `#### Published in docs` are followed by `True` or `False`
    - confirm `#### Published in changelog page` matches whether the version appears in `_repos/openwork/packages/docs/changelog.mdx`
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
- Do not write a vague `Title` like `Improves reliability and fixes bugs`; the title should identify the actual workflow or surface that changed.
- Do not make the `Title`, `One-line summary`, and first `Main changes` bullet say the same thing three times with minor wording changes.
- Do not default `Published in changelog page` to `False` without checking `_repos/openwork/packages/docs/changelog.mdx`.
- When a release has little visible product impact, say that plainly instead of inflating the language.
