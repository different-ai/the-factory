# Extender setup status — 2026-10-30

## Created and verified

- Cloud skill: **Virtual OpenWork Extender**.
  - Stable name: `virtual-openwork-extender-qq2wmfwq`.
  - Plugin: `plg_01m67afqd8enmt2tz9qgd9qq2w`.
  - Skill: `cob_01m67afqgae8fb9cyhdkx1mfwq`.
  - Library: https://app.openworklabs.com/dashboard/library/plugins/plg_01m67afqd8enmt2tz9qgd9qq2w
  - Creation succeeded and get_skill read-back succeeded. Private to its creator; no marketplace or team grant was made.
- Infisical project `e9f4542a-8714-46c3-a8fd-99d8cb370aeb`, `dev`, folder `/openwork-ops/virtual-openwork-extender` created.
- `VOE_GOOGLE_EMAIL` and `VOE_GOOGLE_PASSWORD` reference existing `/openwork-ops/mcp-testing` keys. Both resolve and match the source values; values were never printed.
- `VOE_TARGET_JSON` saved and parsed after read-back. It points to the previously used production demo org; active org/membership still needs UI verification before writes.
- `VOE_SETUP_STATUS_JSON` saved and read-back verified in Infisical: skill IDs, source branch, current blockers and verification state; no tokens or passwords.
- Source pushed to https://github.com/different-ai/the-factory/tree/task/virtual-openwork-extender/tools/virtual-openwork-extender (GitHub reports the former openwork-enterprise repository moved here).
- Credential helper: 12 unit tests pass. Live Infisical inventory correctly reports missing keys, not false readiness. Live scoped target injection loaded target JSON and excluded unrelated Google credentials.
- Synthetic launch brief, meeting notes, private-calendar template and optional draft email prepared locally. They have **not** been uploaded, scheduled or sent.
- Workbot public `/healthz` returned HTTP 200. Den API public `/health` returned HTTP 403 to the unauthenticated probe. Neither proves connector readiness.
- Product source synced to `4c15505333` for inspection. This is a local source SHA, **not a verified deployed build SHA**.

## Actual remaining blockers

1. Google Cloud console is at sign-in in the conversation's built-in browser. Handoff is paused, awaiting the person to sign in with the existing demo Google identity and Resume. No credentials were entered into the sign-in form by the agent.
2. `VOE_GOOGLE_OAUTH_CLIENT_ID` and `VOE_GOOGLE_OAUTH_CLIENT_SECRET` are absent. Inspect/reuse or create the correct Web OAuth client after sign-in and configure the exact target callback. Existing Den Google login credentials are not a substitute for connector credentials.
3. `VOE_SLACK_WORKSPACE_URL`, `VOE_SLACK_APP_ID`, `VOE_SLACK_CLIENT_ID`, `VOE_SLACK_CLIENT_SECRET`, `VOE_SLACK_SIGNING_SECRET` are absent. The user already reported creating the workspace with the demo Google account. Locate that workspace; do not ask for another one by default.
4. Target org connection installation, per-member Google authorization, fixture seeding, Calendar/Documents rehearsal and genuine proactive Slack delivery are not yet verified.

## Safety / cleanup

- No org flags changed during this setup task. The previous demo task reported flags on; their current values were not reverified here. Save exact current overrides before changing any.
- No Google projects/OAuth apps or Slack apps were created in this task while sign-in was blocked.
- No live Drive files, Calendar events, emails or Automations were created. No data cleanup needed from this task.
- Existing browser profile and recorded takes were preserved.
- Parent checkout has unrelated work and a symlink instead of the expected product submodule. Root fast-forward pull succeeded; recursive submodule status/update is blocked by that layout. It was not repaired or overwritten. Files for this task are isolated in `task/virtual-openwork-extender`.
- Switching the session to the isolated root worktree removed its workspace-local Connect tools, so the session returned to the original workspace and commands use explicit worktree paths. No credentials/config were copied to the worktree.

## pstack

No authorized Cloud skill or local source named `pstack` was found. Conversation references mention design principles but do not identify a reusable credential tool. Public web search is blocked by organization policy. No pstack-derived recommendation is claimed; the user was asked whether they meant gstack or another project.

## Resume

After the user resumes Google sign-in, load the Cloud skill above, run inventory, complete Google and Slack modules, then execute the live acceptance checks in `workbot-recipe.md`. Update this status with real IDs and verification timestamps. Do not report the demo environment ready based solely on credential presence.
