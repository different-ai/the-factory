# Plan: Forked OpenCode (opencode) bundling + sync automation

## Why

We have OpenWork shipping `opencode` as a binary dependency (sidecar). Upstream changes we need are blocked/slow to merge, so we need:

- A fork we control (for patched `opencode` releases)
- A reliable way to bundle that fork into the OpenWork app
- Automation to keep the fork in sync with upstream, with an LLM "janitor" to resolve conflicts / repair breakages

This doc describes the end-to-end flow (build + bundle + sync) and a minimal v0 that gets the app using the modified `opencode` quickly, followed by a fast v1 that upgrades the pipeline + automation.

## Scope

In-scope:

- Fork `anomalyco/opencode` as `different-ai/opencode` (name placeholder)
- Publish CLI-only releases from the fork (GitHub Releases assets)
- Bundle the forked CLI into OpenWork desktop builds as a sidecar
- Keep the fork up-to-date via scheduled sync + an LLM janitor GitHub Action

Out-of-scope (for now):

- Shipping the OpenCode desktop GUI from the fork
- Desktop signing (Apple certs / SignPath) for opencode-desktop assets
- Any change that requires upstream infra runners (e.g. `blacksmith-*`) in our fork

## Source of truth (how OpenWork works today)

OpenWork desktop:

- Bundling logic: `_repos/openwork/packages/desktop/scripts/prepare-sidecar.mjs`
  - Builds/bundles OpenWork-owned sidecars (openwork-server, opencode-router, openwrk, chrome-devtools-mcp)
  - Downloads `opencode` CLI from GitHub Releases (currently hard-coded to `anomalyco/opencode`)
  - Writes `versions.json` with sha256s
- Runtime `openwrk` sidecar resolution: `_repos/openwork/packages/headless/src/cli.ts`
  - Can resolve `opencode` as bundled/downloaded/external
  - Download fallback currently hard-coded to `anomalyco/opencode`

OpenWork CI and release workflows (examples):

- `_repos/openwork/.github/workflows/build-desktop.yml` downloads an OpenCode sidecar today (hard-coded upstream URLs)
- `_repos/openwork/.github/workflows/ci-tests.yml`, `prerelease.yml`, `release-macos-aarch64.yml` also reference upstream `anomalyco/opencode`

Key observation:

- `prepare-sidecar.mjs` will NOT download `opencode` if the correct version is already present in `packages/desktop/src-tauri/sidecars/`.
- Therefore v0 can be shipped by pre-seeding the forked `opencode` binary into the sidecar directory during OpenWork CI/release builds.

## Target architecture

### Artifacts we care about

Only the OpenCode CLI binaries that OpenWork expects:

- `opencode-darwin-arm64.zip`
- `opencode-darwin-x64-baseline.zip`
- `opencode-linux-x64-baseline.tar.gz`
- `opencode-linux-arm64.tar.gz`
- `opencode-windows-x64-baseline.zip`

These must contain an `opencode` (or `opencode.exe`) binary that prints a version matching the tag.

### Fork release versioning

Use fork-specific versions to avoid ambiguity and avoid colliding with mirrored upstream tags.

Recommended tag format:

- `v<upstreamVersion>-openwork.<n>` (example: `v1.1.60-openwork.1`)

Avoid `+buildmetadata` because OpenWork code currently parses versions using a regex that will not match `+` variants reliably.

## v0: Ship OpenWork app using modified opencode

Goal: the OpenWork desktop app bundles and runs the patched `opencode` from our fork.

### v0 constraints

- Minimize OpenWork code changes (prefer pipeline changes over refactors)
- No fork sync automation required in v0
- No OpenCode desktop GUI builds/signing

### v0 steps

1) Create the fork and apply the patch

- Fork `anomalyco/opencode` -> `different-ai/opencode`.
- Apply the needed upstream PR delta on top of the upstream `dev` branch.
- Confirm the CLI builds locally at least once.

2) Publish a CLI-only fork release

- Create a tag: `v1.1.60-openwork.1` (example).
- Run the upstream build script that already produces cross-platform artifacts:
  - `./packages/opencode/script/build.ts`
  - Set env:
    - `OPENCODE_VERSION=1.1.60-openwork.1`
    - `OPENCODE_RELEASE=1` (enables `gh release upload`)
- Ensure the GitHub Release contains the assets listed above.

3) Update OpenWork CI/release pipeline to bundle forked `opencode`

Minimal approach: pre-seed the sidecar binary so `prepare-sidecar.mjs` does not attempt to download from upstream.

- In each OpenWork desktop build job (Linux/macOS/Windows), add a step BEFORE `pnpm -C packages/desktop prepare:sidecar`:
  - Download the fork release asset for that target
  - Extract it
  - Copy the `opencode` binary into:
    - `packages/desktop/src-tauri/sidecars/opencode-<target-triple>`
      - example linux x64: `opencode-x86_64-unknown-linux-gnu`
  - `chmod 755` on unix
- Export:
  - `OPENCODE_VERSION=1.1.60-openwork.1`
  - (optional) `OPENCODE_ASSET=...` if you deviate from standard asset names

Acceptance: `prepare-sidecar.mjs` prints `OpenCode sidecar already present (...)` and writes `versions.json` with the forked version.

4) Verify

- In CI: ensure desktop build passes and artifacts contain `versions.json`.
- In a built app: start engine and verify `opencode --version` matches the fork tag.
  - The desktop app spawns `openwrk` with `--opencode-bin <path>` (see `_repos/openwork/packages/desktop/src-tauri/src/openwrk/mod.rs`).
  - As long as the bundled sidecar is present and selected, the app uses that binary.

### v0 success criteria

- OpenWork desktop build bundles `opencode` from the fork release.
- App runtime uses that binary (not the host PATH install).
- We can reproduce the build by re-running CI for the same fork tag.

## v1: Make it maintainable (repo override + automated sync + LLM janitor)

Goal: eliminate special-case pre-seeding and keep the fork continuously up-to-date.

### v1.1: Parameterize where OpenWork downloads `opencode` from

Add a single override used consistently across bundling and runtime downloads.

Proposed inputs:

- `OPENCODE_GITHUB_REPO` (default `anomalyco/opencode`)
  - Value example: `different-ai/opencode`

Code touch points in OpenWork:

- `_repos/openwork/packages/desktop/scripts/prepare-sidecar.mjs`
  - Replace the hard-coded download base:
    - `https://github.com/anomalyco/opencode/...`
  - Replace GitHub latest lookup:
    - `https://api.github.com/repos/anomalyco/opencode/...`
- `_repos/openwork/packages/headless/src/cli.ts`
  - Same: latest lookup + download URL

Then update OpenWork workflows to set:

- `OPENCODE_GITHUB_REPO=different-ai/opencode`
- `OPENCODE_VERSION=1.1.60-openwork.1` (or set pinned `opencodeVersion` in package.json)

After v1.1, CI no longer needs to pre-seed sidecars manually (we can keep it temporarily, but it should become redundant).

### v1.2: Fork automation workflows

We implement 3 workflows in the fork repo.

1) `sync-upstream.yml` (deterministic)

- Trigger: schedule (e.g. every 6 hours) + manual dispatch
- Behavior:
  - Fetch upstream `anomalyco/opencode:dev`
  - Attempt to rebase our patch delta on top
  - Open/update a PR `sync/<date>-<upstreamSha>` -> `dev`
  - Label: `sync` and `sync-conflict` when applicable

2) `fork-janitor.yml` (LLM repair loop)

- Trigger:
  - `workflow_run` after `sync-upstream.yml`
  - daily schedule backstop
- Behavior:
  - Find open PRs labeled `sync`/`sync-conflict`
  - If conflicts: resolve, commit, push to the PR branch
  - If CI failing: attempt repair, commit, push
  - Comment: what changed + remaining issues

Security/guardrails:

- Only operate on branches created by our sync workflow (e.g. `sync/*`).
- Never run on arbitrary external PR branches.
- Use `OPENCODE_PERMISSION` allowlists so the LLM cannot run arbitrary commands.

Secrets needed:

- LLM:
  - `OPENAI_API_KEY` (if using OpenAI models), OR
  - `OPENCODE_API_KEY` (if using OpenCode Cloud)
- Git push token that is NOT the default `GITHUB_TOKEN`:
  - preferred: GitHub App token (our own app)
  - alternate: bot PAT (fine-grained)

3) `release-cli.yml` (CLI-only releases)

- Trigger: push tag `v*openwork*`
- Builds CLI artifacts and uploads them to GitHub Release.
- No opencode-desktop builds or signing.

### v1.3: Keep OpenWork pinned to fork releases

Two options (can start manual, then automate):

Option A (manual):

- When we want to ship a new fork build, bump OpenWork's pinned version and release.

Option B (automated PR):

- On fork tag publish, open a PR in `different-ai/openwork`:
  - update `opencodeVersion` (desktop + headless)
  - or update CI env pins
  - run at least the desktop build workflow

Keep "sync upstream" and "ship into OpenWork" as separate control points.

## Suggested rollout timeline

Day 0 (v0):

- Fork + patch + tag fork release
- Modify OpenWork CI/release build(s) to pre-seed forked `opencode` sidecar
- Verify app uses patched binary

Day 1 (v1.1):

- Add `OPENCODE_GITHUB_REPO` override to OpenWork bundling + runtime
- Update OpenWork workflows to use fork repo + pinned version
- Remove or simplify pre-seeding steps

Day 2 (v1.2):

- Add `sync-upstream.yml` + `fork-janitor.yml` + `release-cli.yml` to fork
- Configure secrets
- Dry-run sync PR and validate janitor behavior on a controlled conflict

## Risks + mitigations

- CI runners in upstream opencode are not available in our fork.
  - Mitigation: in the fork, use GitHub-hosted runners and minimal CI.
- Version parsing breaks on non-semver / metadata.
  - Mitigation: use `-openwork.N` suffix (no `+`).
- LLM janitor makes unsafe changes.
  - Mitigation: strict `OPENCODE_PERMISSION`, branch scoping, small blast radius, mandatory gates.

## Appendix: Workflow skeletons (illustrative)

### Fork: fork-janitor (LLM) concept

- Install opencode
- Export `OPENAI_API_KEY` (or `OPENCODE_API_KEY`)
- Set `OPENCODE_PERMISSION` allowlists
- Checkout PR branch with bot token
- Run `opencode run ...` on a prompt that includes conflict list / failing logs
- Commit + push
- Comment on PR

We can model it after the existing OpenWork workflow `_repos/openwork/.github/workflows/opencode-agents.yml`, but janitor should NOT use `pull_request_target`; it should be schedule/workflow_run only.
