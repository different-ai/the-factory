# Lena full narrated film — verification

## Result

**17/17 live checks passed** in one recovered full-day GPT-6.1 Sol run on merged OpenWork `dev` commit `b73f6c697a`. No post-hoc score correction was needed.

Run: `full-day-recovered-20261018-203755` under the OpenWork worktree’s `evals/results/workshop-narrative/`.

| Scene | Result | Elapsed |
|---|---|---:|
| Create morning-brief Automation | PASS | 42 s |
| Run now → unsent brief draft | PASS | 49 s |
| Account-related follow-up | PASS | 19 s |
| Inbox folders and sorting | PASS | 41 s |
| Blue Harbor presentation and threaded draft | PASS | 83 s |
| Save skill | PASS | 66 s |
| Reuse via slash menu for Northwind | PASS | 89 s |
| Share skill with Nora | PASS | 17 s |
| Five-slide account-review deck | PASS | 96 s |
| Documentation task for Nora | PASS | 17 s |
| IT request: Windows login | PASS | 19 s |
| Handbook has no dog policy | PASS | 19 s |
| Book and move the same meeting | PASS | 28 s |
| Move customer threads to Done | PASS | 18 s |
| Live forecast App | PASS | 58 s |
| Nora’s Activity: exact shared skill + connector | PASS | 20 s |
| Open feedback form | PASS | — |

148 model requests; estimated request cost $19.29, not a billing statement. Skill reuse worked but was not faster: 89 s versus 83 s. The narration does not claim a speed improvement.

## Film integrity and export

- Actual app captures at 2× resolution; no fabricated UI or generated business results.
- Cursor/ripple and Return keycap are editorial overlays. Typing uses the actual composer and Enter sends the prompt.
- Waiting is cut explicitly. Slides are rendered from the generated PPTX bytes with LibreOffice/PyMuPDF, not recreated for the video.
- Narration reuses the natural voice recorded for the earlier film, with edits to match this sequence. The film has no internal model-comparison section.
- Saved-skill confirmation is shown from the first response, where the skill already exists. A later unsolicited sharing clarification is omitted from the cut; the run report retains it.
- H.264, 1920×1080, 60 fps; AAC narration; **374.5 seconds**.
- 121 samples extracted from the encoded delivery across all beats, with contact-sheet visual review. A complete ffmpeg decode returned no errors.
- Secondary captures are normalized to the camera’s pixel dimensions. Contact labels remain visible at the end; other labels clear before close-ups.
- Drive upload MD5 verified against local file: `c6ed799ea17ec7b1ebb1c36ccebe57b9`.

## Boundaries

Open Workplace services are in-memory, Acme Robotics sample environments, not real Microsoft or Atlassian tenants. Their UIs are presented as Open Outlook, Open Calendar, Open Drive, Open Jira and Open Confluence. Browser links use reserved `.internal` domains mapped to local service ports; no public company domain is used. Raw API upload sessions use a reachable local address.

The morning brief uses a real local Automation runner, triggered with Run now rather than waiting for a scheduled weekday. News coverage is dated October 16; the resulting brief explicitly warns about stale coverage. Emails remain drafts; no external delivery or real invitations are tested. The live App is created from the connected file; this run does not prove a changed-file refresh scenario.

The earlier full-day recording was interrupted when disk space ran out. Old raw captures and obsolete disposable browser profiles from our test runs were removed; source files, reports and finished videos were preserved. The recovered run above passed in full.

## Merged product work

- #6130 — web Automation creation/CORS, runnable default model, execute when triggered, replayable skill guidance.
- #6139 — manual Workflow execution for viewers, separate scheduling permission.
- #6177 — standalone Open Workplace package, hostname mapping and high-resolution recording options, with security fixes.
- #6178 — Responses API support in the headless runner for tool-using OpenAI models.

All four are merged into `dev`. Workshop-specific source remains outside the product repository under `workshops/lena-day` in the Factory repo; PR #35 still needs repository review. It is not claimed merged.

## Delivery

[Full narrated film](https://drive.google.com/file/d/1Y525IkWPIvZWdu6Ixf30wSve9wi03-QE/view).
