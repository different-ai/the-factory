# Demo factory

Status: plan of record, in progress. Started 2026-11-20.

## Why

A personalized enterprise demo currently takes about 16 hours of hands-on preparation on a single hand-built desktop. The last one worked, but the rough spots on the call were all things a repeatable process would have caught:

- An admin "confirm it's you" prompt with no way to confirm.
- A deck that was generated but never shown, because PowerPoint has no in-app preview and nothing told the presenter to go back.
- An Automation that was proposed but never created, because the review card was out of sight.
- A question about Workflows that had no prepared example.
- No backup desktop, because the tested build existed only on the live machine.
- The audience's requests arrived two hours before the call and were mapped to the demo 25 minutes before it.

The goal is a new personalized demo that is READY the same day it is requested, with a practice desktop and a backup.

## Principles

- **Generic in git, personal outside git.** The factory, beats and seed data use a fictional company. Anything about a real audience lives in a private folder and is never committed.
- **Use what the product already provides.** A production sandbox organization already includes models, Workbot, the sample Microsoft 365 workplace and the sample Slack with the Workbot Slack app. The factory builds on that; it does not hand-build stand-ins.
- **One file describes a demo.** The order of steps is data. The driver, reset, READY check and presenter sheet are generated from it.
- **Checks look at results, not wording.** A step passes because the file, record or run exists and is correct, never because some text appeared.
- **Every label is honest.** Each step is tagged REAL, SEEDED or MOCKED, and the tag is in the spoken line.

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Organization | Approved OpenWork Cloud sandbox organization (`den_sandbox_create`) | Use the existing Cloud runner and supported sample connectors. Configure SSO separately when the demo calls for it; verify Workbot, Slack and Cloud Automations individually. Seven days is the proposed preset, not a readiness claim. |
| Desktops | Three per demo (demo, practice, backup) from one Daytona snapshot | The tested build existed only on the live machine last time, so no backup could be made. |
| Desktop lifetime | Provider-side expiry, not a timer on someone's Mac | Last time the desktop depended on one local process that could not be restarted. |
| Sample business systems | The fictional workplace the sandbox already has (Microsoft 365, Slack, Jira, Confluence) | No custom hosts to keep alive. A sample CRM is a follow-up, not a blocker. |
| Unreleased builds | `workshop-pair` private Den world, for the nightly check only | It can run any commit; it is not what the audience sees. |

## What gets built

### 1. Image and world

- **Demo desktop snapshot**: the pinned packaged build plus LibreOffice Impress, Liberation fonts, the typing helper, the prompt palette, the screen recorder and a larger disk. Built by a base phase like `worlds/workshop-clone.ts --phase base`, reviewed into a snapshot manifest.
- **`demo` launcher**: one command that takes a sandbox organization and brings up three desktops from the snapshot, each with its own browser profiles, Pacific or chosen time zone, and provider-side expiry. Outputs go to a private directory: viewer links, expiry time, control file.
- **Organization seed pack**: one file for the company, personas, teams, model and connector grants, single sign-on, and the retained examples. Applied through the admin and member APIs.
- **Retained examples**: finished report chat with spreadsheet and deck, a live artifact, an Automation with a completed run, a Cloud Automation with a completed run, a Workflow, a Workbot conversation, a Workbot message in sample Slack.

### 2. Beats and generators

- **Beat**: one demo step. Fields: what to do, what to say, what to paste, what to see, result checks, reset rule, REAL/SEEDED/MOCKED label, fallback, likely questions.
- **Demo file**: ordered beats, optional beats, start state, desktops.
- **Personalization file** (private): display name and logo, persona names, industry wording, audience roles, things to avoid.
- **Generators**: from the demo file produce the robot driver, the reset, the READY check, the DO / SAY / PASTE / SEE sheet, the run of show and the question bank.

First beat library:

| Beat | Label |
|---|---|
| Sign in with company identity | REAL |
| Quick question against Slack | SEEDED |
| Report as a spreadsheet from mail, Slack and one more source | SEEDED |
| Live artifact: open a retained one; build one by prompt | REAL on SEEDED data |
| Automation: retained with run history; create by prompt; Cloud run | REAL |
| Workflow: retained; create by prompt | REAL |
| Deck from the report | REAL |
| Workbot conversation | REAL |
| Workbot in sample Slack | REAL on MOCKED Slack |
| Built-in browser | REAL |
| Admin: teams, models, connectors, permissions | REAL |
| Member provisioning (SCIM) | REAL |
| Organization branding | REAL |
| Data flow, one slide | Slide |

### 3. Skills

One entry skill runs these in order. Existing skills are extended where they already cover the step.

| Step | What it produces | Skill |
|---|---|---|
| Brief | Requests, attendees and roles, unclear points, coverage table, clarifying email draft | Extend `enterprise-call-prep-and-followup` |
| Compose | Demo file and personalization file | New `demo-compose` |
| Provision | Sandbox organization and three desktops | Extend `daytona-demo-desktop-with-sandbox-org` |
| Prove | Parallel robot trials, then one human run-through | Extend `live-demo-prep` |
| Kit | Presenter sheet, question bank, fallback recording | Extend `live-demo-prep` |
| Morning | READY check and links | Extend `live-demo-prep` |
| Debrief | Rough moments, promises made, follow-up draft, product issues | Extend `enterprise-call-prep-and-followup` |

### 4. Standing check

A nightly Automation runs every beat against a fresh sandbox organization and desktop on the latest release, and records pass or fail per beat per release. Product problems surface days ahead.

## Product changes

Each has its own issue in `different-ai/openwork`. Tracking issue: #7614.

| # | Change | What was found | Size |
|---|---|---|---|
| #7615 | Admin security check can be recovered | After 15 minutes a sensitive save opens a "Security check" dialog. Once it is cancelled, or the SSO pop-up cannot finish, the page keeps a red alert with no button. Add a "Confirm it's you" action, lead with SSO for SSO sessions, handle an expired session. | Medium |
| #7616 | Slides and documents preview in the desktop side panel | `.pptx` and `.docx` fall through to "Preview unavailable". Step 1 is a text outline per slide; rendered slides are a later step. | Small, then large |
| #7617 | Archived Automations can be seen and restored | The API returns them; both clients hide them. | Small |
| #7618 | A one-off Automation in the past is rejected | Today it is accepted and never runs. | Small |
| #7619 | Den web shows the organization's wordmark and name | Per-organization branding already exists and the desktop shows it; the console shows only the icon. | Small |
| #7620 | Sample Slack sends mentions and messages to OpenWork in Slack | Today only Workbot → Slack works in the sample workspace. | Medium to large |
| #7621 | Sample CRM in the fictional workplace | None exists, so pipeline questions need a hand-built stand-in. | Medium |

Already fixed and waiting for a release: the "Create Automation" review card hidden inside a folded run (#7591, on `dev`, not in `v0.18.71`). Demo desktops must use a build that contains it.

No product change needed, only seeding and a beat:

- **Workflows.** A Workflow is a saved, versioned procedure that calls connector tools. The agent tests it, offers to save it, and an Automation can run a saved Workflow instead of an agent turn. The demo needs one retained Workflow and a beat that creates one by prompt.
- **Organization branding.** Brand Appearance already sets the app name, wordmark, icon and accent colour at run time for the desktop. Personalizing a demo is a seed step.
- **Headless runner.** Production already runs it, and sandbox organizations already get Workbot and the sample Slack. The demo needs beats for Workbot, a Cloud Automation run, and Workbot in sample Slack.

Demo-preparation rules that follow from the admin finding, independent of the fix:

- Keep admin security policy intact. Shortly before the call, the presenter confirms the admin can complete SSO re-authentication in the same browser profile. READY checks state without signing in, changing policies, or replaying a mutation.
- The presenter sheet identifies the correct persona and sign-in route. Use distinct credentials via a private helper; never embed them in sheets, snapshots, or logs.

## Acceptance test

Build a second demo for a made-up audience using only the factory:

1. Start from a written brief with four requests.
2. Reach READY on three desktops.
3. Run three independent green trials on isolated demo state. Run them in parallel only where they cannot change the same accounts, schedules, or records. Finish with a fresh read-only READY check on the presenter desktop.
4. One human run-through from the generated sheet with no help.
5. Record the elapsed time. Target: the same working day.

## Order of work

1. Demo desktop snapshot and three-desktop launcher.
2. Demo file format and generators, ported from the hand-built kit.
3. New beats: Workflow, Automation pair, Workbot, Workbot in Slack, branding.
4. Skills.
5. Nightly check.

## Known limits

- Mentioning the bot from sample Slack and getting a reply is not possible yet: the sample Slack receives Workbot messages but sends no events back. Until that exists, the Slack beat shows Workbot messaging a person in sample Slack.
- Retained examples need real model turns at provisioning time, so provisioning takes minutes and results vary slightly.
- Sample workplace sign-ins last about 8 hours; the morning check must refresh them.
- Sandbox organizations last 7 days and desktops 24 hours unless renewed.
