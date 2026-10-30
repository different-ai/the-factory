# Virtual OpenWork Extender

Reusable external-service preparation for **any running Den + a named organization**. It does not launch another Den or replace OpenWork connections. Workbot is the first recipe, not a requirement of the general setup.

## Source of truth and access

- Infisical project: `e9f4542a-8714-46c3-a8fd-99d8cb370aeb`, environment `dev`.
- Credential registry: `/openwork-ops/virtual-openwork-extender`.
- Existing demo Google identity: `/openwork-ops/mcp-testing`, `MCP_TEST_GOOGLE_EMAIL`, `MCP_TEST_GOOGLE_PASSWORD`. Registry `VOE_GOOGLE_EMAIL` and `VOE_GOOGLE_PASSWORD` are **references**, not copied passwords. Both were read back and matched on 2026-10-30.
- Recovery email remains in its original folder; it is not injected into demo jobs.
- Sharing the skill does **not** grant Infisical access, Google access, Slack access, or Den membership. Each teammate signs into Infisical using their own authorized identity. No shared Infisical login, broad exported token, or session-cookie sharing.
- Do not widen project roles or grant access as part of a recording. An authorized administrator grants the narrow access separately. A cross-folder reference may also require source-folder access: do not duplicate the password to bypass that check.

## Credential keys

All keys below live in the registry, prefixed `VOE_`. Absent keys mean provisioning is unfinished, not that a new account should be created.

| Module | Required keys | Additional keys |
| --- | --- | --- |
| Google | `GOOGLE_EMAIL`, `GOOGLE_PASSWORD`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | `GOOGLE_PROJECT_ID`, `GOOGLE_REFRESH_TOKEN` (only an explicitly authorized, demo-only token when needed for API seeding) |
| Slack | `SLACK_WORKSPACE_URL`, `SLACK_APP_ID`, `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET` | `SLACK_CONNECTION_ID` (the actual Den connection, never invented) |
| Target | `TARGET_JSON` | `SEED_RECEIPT_JSON` (IDs of created fixtures, timestamps and cleanup ownership; no tokens) |

`VOE_TARGET_JSON` has canonical origins `denWeb`, `denApi`, `workbot`, and `organizationId`. The initial record points to the previously used demo org on production; **recheck the active org in the UI before any write**. To use a different real org or preview, pass that target explicitly in the request, check its permissions, and do not silently replace the team's shared default. A temporary target can be held only in the run's memory.

## Use

Prerequisites: Python 3.9+, Infisical CLI, authorized Infisical sign-in. The helper pins project/environment/folder explicitly; no `.infisical.json` is needed.

```sh
python3 tools/virtual-openwork-extender/extender.py inventory
python3 -m unittest discover -s tools/virtual-openwork-extender -p 'test_*.py'
```

Inventory prints names and presence only. Exit 2 means missing configuration, exit 1 means an access/configuration error. Even exit 0 is **not** proof of working connections: the report always says `not_tested` until a person/agent completes the live checks below.

Use `extender.py save VOE_<KEY>` to read one newly issued value from stdin. Do not pass secret values in arguments, shell history or literal tool-call bodies. For an interactive terminal, read with a hidden prompt, pipe directly into this process, and clear the variable afterward. For an agent, transfer a provider's value directly from its authorized process into the helper's stdin without returning it to chat. The helper uses a YAML-selected stdin pipe, verifies read-back, and refuses overwrites unless `--replace` is explicit. An uncertain write is inspected before any retry.

```sh
# Run only a trusted, reviewed local program; never env/printenv or an arbitrary downloaded script.
python3 tools/virtual-openwork-extender/extender.py run google -- python3 trusted_google_setup.py
```

This passes only the selected module's `VOE_` keys and a minimal OS environment to the child. Complete injected values are redacted from its returned stdout/stderr. **This is not a security sandbox:** a malicious program can transform or exfiltrate values. Child output is buffered; use only bounded, reviewed setup commands. Never send injected credentials to another origin, trace them, dump environment variables, or write tokens to disk.

## Provision Google once; connect per member/target

1. Use the existing demo identity, not a personal account. Complete sign-in/consent/security checks via browser handoff. Never automate past a CAPTCHA or require disabling MFA.
2. In Google Cloud, inspect existing projects and OAuth clients before creating another. Keep test resources separate from production OAuth clients.
3. Enable the APIs required by the actual demo: Drive, Docs, Sheets, Calendar, Gmail (Google Chat only if the chosen flow uses it). Scope selection follows the current Den connection screen, not a blanket request for every permission.
4. Create/configure a **Web application** OAuth client. Read the exact `redirectUri` shown by **that target Den's Google Workspace connection**. For current production it is `https://api.openworklabs.com/v1/oauth-providers/google-workspace/connect/callback`. A Den login callback is different; do not reuse it.
5. Add only exact redirect URLs for targets actually used. Do not invent preview URLs or use wildcard redirects. For a Gmail identity the app is External; Internal is only available to an eligible Workspace organization. Testing mode may expire refresh tokens after seven days for these scopes: record this as a maintenance requirement, not permanent readiness.
6. Save project ID and newly issued OAuth client ID/secret into the registry. Configure the client in the named Den org's connection UI; each member authorizes their own Google account. Store runtime connector tokens in Den, not in the skill.
7. Check Den's API checks, load the actual member's Calendar, and browse/read a seeded Drive file. A configured OAuth client or HTTP 200 health endpoint alone is not success.

## Provision Slack once per actual installation

1. Sign in with the existing demo Google identity and locate the workspace the user already created. Do not create another workspace merely because its URL has not yet been recorded. Save the confirmed workspace URL/team/app identity.
2. In the target Den org, inspect existing Slack connections. A workspace may already belong to another org. Never detach/reassign it silently; choose the correct target or ask.
3. Use the **manifest generated by the target connection's Slack assistant setup screen**. Do not maintain a parallel hand-written scope list. Current source: `ee/apps/den-api/src/slack-assistant/protocol.ts:slackManifest` and `routes.ts`. The manifest embeds the real connection ID in event, interaction and command URLs.
4. Create or reuse the Slack app from that manifest. Save its actual app/client IDs, client secret, and signing secret to Infisical, never bot tokens in a skill. Configure the org connection and complete installation/consent in the browser.
5. Confirm installation status, workspace identity, runner availability and member mapping. An installed app is not proof of proactive delivery. For delivery, seed a safe actionable item, let the real agent check run, and verify the message's real permalink/timestamp. No manual fake DM presented as an agent result.

## Run safety and cleanup

- Record target/build, organization, services, each flag's prior override (`true`, `false`, or absent), and fixture IDs before capture. Workbot itself is GA; discover current feature availability rather than enabling a retired flag.
- Enable only required org-scoped flags. Never use deployment-wide rollouts as a demo shortcut. Restore exact previous overrides afterward; removing an override is different from setting false.
- Real org mode uses existing connections and an explicitly demo-safe folder/calendar/channel. Shared-demo mode uses the stored demo identity. Never silently substitute real customer data.
- Use one run namespace (for example `voe-20261030-a`) for all fixture names. Do not reset shared resources while another person is using them. No broad Drive deletes, calendar clears, Slack history resets, account deletion, or automatic credential rotation.
- Cleanup only resources explicitly listed in this run's receipt. Delete/disable demo Automations created by this run or obtain an explicit request to keep them scheduled. Leave shared identity/OAuth apps intact.

## Workbot recipe and recording

See `workbot-recipe.md` and `fixtures/`. Prepare these off camera; then use the existing `record-openwork-tutorial` and `demo-screen-recording-motion` Cloud skills for capture/cutting. Do not rewrite those capture tools here. Record captions first; no simulated UI, fake Slack messages, or unsupported upcoming claims.

## Current checkpoint

See `setup-status.md`. The helper and credential references are verified; Google/Slack service provisioning is **not yet complete**. The Google browser is paused for human sign-in. Do not say this environment is ready to record until the recipe's live acceptance checks pass.
