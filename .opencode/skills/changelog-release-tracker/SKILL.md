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

The tracker is split into files named `release-tracker-{YYYY-MM-DD}.md` in `_repos/openwork/changelog/`, where the date is the first release date in that file; append to the latest file, or create a new one (dated today) when the latest file already has 25 entries.

## Output Contract

- The output file must be plain markdown sections.
- Keep release sections sorted oldest to newest so new versions append at the end.
- If the tracker file already exists, preserve its formatting and append or edit `## <version>` sections in place.
- Each subsection inside a release must start and use a `####` heading.
- Use plain text under scalar subsections unless a subsection explicitly allows multiple markdown structures.
- Include a lines-of-code subsection and a release-importance subsection for every release.
- Include a `Title` subsection for every release.
- The `Title` must be concise, publish-ready, and reusable almost verbatim in the public changelog.
- The `Title`, `One-line summary`, and `Main changes` must complement each other instead of repeating the same wording at different lengths.
- `Main changes` may use the best-fit markdown structure described below instead of a fixed bullet count.

## Inputs

- One or more release tags such as `v0.11.101`
- Optional output file path; default to the latest `_repos/openwork/changelog/release-tracker-{YYYY-MM-DD}.md` file (or a new one if it has 25 entries)

## Steps

1. Work from a dedicated worktree and confirm the tracker file path.
2. In `_repos/openwork`, gather release metadata for each tag:

   ```bash
   gh release view <tag> --repo different-ai/openwork --json tagName,publishedAt,body
   git rev-list -n 1 <tag>
   git log --oneline --no-merges <previous-tag>..<tag>
   git diff --shortstat <previous-tag>..<tag>
   ```

3. Read nearby published entries in `_repos/openwork/packages/docs/changelog.mdx` before drafting language so the tracker entry matches the current public changelog voice.

4. Inspect any commit that looks user-facing before summarizing it:

   ```bash
   git show --stat --summary <sha>
   ```

5. Derive release values with these rules:
    - `Commit`: use the tag commit from `git rev-list -n 1 <tag>`, shortened to 8 characters.
    - `Title`: write one concise publish-ready line that states the release's core substance up front.
    - The `Title` should usually be 4-10 words, in sentence case, and focus on the most important user-facing or developer-facing outcome.
    - Lead the `Title` with the primary workflow, product surface, or capability that changed, not with a generic verb like `Improves several areas`.
    - The `Title` must be reusable almost verbatim as the release-level headline sentence in `_repos/openwork/packages/docs/changelog.mdx`, even though the public file does not have a separate `Title` field.
    - The `Title` should sound like a strong changelog headline: concrete, direct, and outcome-first.
    - Avoid version numbers, release-process wording, and filler such as `This release`, `Shipped`, `Various`, `Several`, or `Miscellaneous`.
    - Avoid internal-only implementation terms unless they are visible to users or directly relevant to developers, such as APIs, CLI flows, providers, MCP setup, or documented product surfaces.
    - Prefer visible nouns and surfaces such as `workspace switching`, `session loading`, `Settings`, `Cloud sign-in`, `skill editing`, `API auth`, or `MCP connections` over repo mechanics or internal package names.
    - If the public changelog entry is going to be a minor release, focus on the `Title`, which should usually be close to that final sentence and the `One-line summary` which adds a bit more scope.
    - If the public changelog is a major, use the `Title` as the release-level headline that introduces the `Main changes` section without awkwardly compressing every bullet into one overloaded sentence.
    - `One-line summary`: write exactly one sentence that expands the `Title` with the main outcome first, then adds the most relevant scope or secondary effects.
    - The `One-line summary` should add context, not restate the `Title` with only a few extra adjectives.
    - Keep the `One-line summary` between 10-25 words unless the release is unusually simple.
    - `Main changes`: choose exactly one best-fit structure for the section instead of defaulting to a fixed number of bullets.
    - Keep the entire natural-language content of `Main changes` under 80 words total, including labels such as `Also released:`.
    - Prefer concrete workflow outcomes over internal implementation details. State what the release lets users do, what became clearer, or what became more reliable.
    - Only mention implementation details when they materially matter to developers using a visible surface such as the CLI, API, MCP configuration, auth providers, or documented settings.
    - Valid `Main changes` structures:
      - `Compact bullets`: 2-4 short bullets ordered by user impact.
      - `Lead paragraph + bullets`: one short lead sentence or paragraph for the primary announcement, followed by a short list such as `Also released:` with 1-3 bullets.
      - `Compact paragraph`: one short paragraph when the release is cohesive enough that bullets would feel artificial.
      - `Paragraph + tiny code example`: one short paragraph plus one very small indented code snippet only when a command, API shape, setting name, or developer-facing surface is itself the important change.
    - The chosen `Main changes` structure must be the best fit for the release and must fully conform to one of the valid structures above.
    - Use `Compact bullets` for mixed but comparable improvements.
    - Use `Lead paragraph + bullets` when one primary announcement leads the story and the remaining changes are supporting additions.
    - Use `Compact paragraph` when the release reads more naturally as one tightly scoped explanation.
    - Use `Paragraph + tiny code example` only when the code itself communicates something user-facing or developer-facing that prose would make less clear.
    - If you use bullets, the bullets do not need to be exactly parallel or verb-first, but they must still be concise and easy to scan.
    - If you use a code snippet, keep it tiny and subordinate to the prose. Do not turn `Main changes` into a long reference block.
    - Count prose words toward the 80-word cap. Ignore the code tokens in a tiny indented snippet, but keep the overall section brief enough to scan in one glance.
    - Example valid `Main changes` structures:
      - `Compact bullets` example:
        - Fixed workspace switching so reconnects land in the right session.
        - Improved provider auth prompts so setup fails less often.
        - Cleaned up Settings copy around remote workers.
      - `Lead paragraph + bullets` example:
        Released GPT-5.4 and GPT-5.4 pro across the main API surfaces.
        Also released:
        - Tool search for large tool surfaces.
        - Built-in computer use support.
        - 1M token context and native compaction.
      - `Compact paragraph` example:
        Stabilizes sharing and session startup so reconnects, loading states, and worker handoffs feel steadier across the app.
      - `Paragraph + tiny code example` example:
        Added a simpler local launch flow for the CLI and made the new entrypoint easier to discover.
            openwork dev
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
      - `#### Main changes` followed by one valid `Main changes` structure
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
    - Under each heading, write the value on the next line with no blank line between the heading and the value.

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
    Added a local recovery flow for broken OpenCode database migrations so local startup can repair itself.

    Also released:

    - Clearer Soul starter steering and observability controls.
    - Cleaner compact action buttons across settings and sidebars.

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

    ```

8. Validate before committing:
    - `git diff --check`
    - confirm there are no lines starting with `|` in the tracker file
    - confirm subsection labels are `####` headings, not `- Label:` bullets
    - confirm every release block includes `#### Title`
    - confirm the `Title` is publish-ready, specific, and not just a shorter duplicate of the `One-line summary`
    - confirm the `One-line summary` expands the `Title` instead of repeating it
    - confirm the `Main changes` section uses exactly one valid structure and that the structure is the best fit for the release
    - confirm the `Main changes` section stays under 80 words
    - confirm the `Main changes` content adds concrete workflow detail that is not already fully captured by the `Title`
    - confirm `#### Release importance` starts with either `Minor release:` or `Major release:`

## Common Gotchas

- The final file is markdown text, not a markdown table embedded inside a markdown file.
- Subsection headings are required so entries are easier to target programmatically.
- Do not treat the release bump commit as a feature by itself.
- Use the release body to anchor the summary, but use commit inspection to verify the real user-facing changes.
- Keep `Main changes` user-facing or developer-facing in a visible way; avoid internal implementation details unless they matter to the actual workflow.
- Do not write a vague `Title` like `Improves reliability and fixes bugs`; the title should identify the actual workflow or surface that changed.
- Do not make the `Title`, `One-line summary`, and opening `Main changes` content say the same thing three times with minor wording changes.
- When a release has little visible product impact, say that plainly instead of inflating the language.
- Do not force `Main changes` into 3 bullets when a short paragraph or lead-plus-list structure is clearer.
- Do not use an indented code snippet unless the code itself is part of the user-facing or developer-facing story.
- Do not let `Main changes` exceed 80 words just because the release was large; choose a tighter structure or move detail to another field.
