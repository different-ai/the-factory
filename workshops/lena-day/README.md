# A day with Lena: OpenWork workshop

Everything specific to the "day in the life of Lena" workshop and video lives here, outside the OpenWork repo:

- **Lena's day:** the test script (D0–D16 scenes), her persona, and her workspace notes.
- **Workshop-only services:** Morning News and the feedback form.
- **Evidence and video:** run reports, the video editor, and narration.

The OpenWork repo contains only what improves the product or helps any test world:
- **App fixes**, which go to `dev`.
- **Open Workplace** (`evals/packages/open-workplace`): Open Outlook, Open Calendar, Open Drive, Open Jira and Open Confluence.
- **General recording options:** `OPENWORK_EVAL_CHROME_SCALE`, `OPENWORK_FILM_MAX_SIZE` and `chrome({ hostRules })`.

## Layout

| Path | What |
|---|---|
| `overlay/` | Files copied into an OpenWork worktree to run the workshop, at the same paths they take there. |
| `bin/overlay.sh` | `add` copies `overlay/` into a worktree and hides the files from git (`.git/info/exclude`, never committed); `collect` copies edits back here; `remove` deletes them. |
| `video/` | Editor for the recorded runs: `make_hero.py` (one prompt → result, Cap-style), `make_video3.py` + `build_v3.py` (the full day), `render_pptx.sh` (real slides via LibreOffice), and narration text. |
| `docs/` | Walkthrough for attendees, presenter guide, and test-quality report. |
| `reports/` | Earlier run evidence (narrative workshop). |
| `archive/` | The first "enterprise-workshop" world and the long narrative proof. They depend on code that is no longer in OpenWork; kept for reference only. |

## Run a day (or one scene)

Needs an OpenWork checkout that includes Open Workplace (`worlds/lib/open-workplace.ts`), a local MySQL on 3310, and Infisical access for the model key.

```bash
OW=~/_worktrees/openwork-open-workplace            # any OpenWork worktree
bin/overlay.sh add $OW
cd $OW && T=$TMPDIR
OPENWORK_WORKSHOP_NARRATIVE=1 OPENWORK_WORKSHOP_DAY=1 OPENWORK_WORKSHOP_DAY_APPS=1 \
OPENWORK_WORKSHOP_PROFILE=gpt-sol-fast \
OPENWORK_WORKSHOP_REPORT_DIR=$PWD/evals/results/lena-day/gpt-sol-fast OPENWORK_WORKSHOP_FILM_DIR=$PWD/evals/results/lena-day/film \
OPENWORK_EVAL_MYSQL_URL=mysql://root:password@127.0.0.1:3310 OPENWORK_WORKSHOP_PYTHON=$T/pptx-venv/bin/python \
pnpm evals:e2e workshop-day --local --surface web --engine v1
```

| Option | What it does |
|---|---|
| `OPENWORK_WORKSHOP_DAY_ONLY=D4` | Run only some scenes (comma-separated). Without D0/D1 the eval model is not registered as an org model, so the composer can't start on a model this engine cannot run. |
| `OPENWORK_WORKSHOP_PROFILE=qwen-27b` (with `OPENWORK_WORKSHOP_GPT_PHASE_DONE=1`) | Run the same day on Qwen3.8 27B. |
| `OPENWORK_EVAL_CHROME_SCALE=2 OPENWORK_WORKSHOP_FILM_HIRES=1 OPENWORK_FILM_MAX_SIZE=2880x2000 OPENWORK_FILM_QUALITY=95` | Recording mode: 2× capture, visible typing, Enter to send, on-screen positions for the editor. |
| `OPENWORK_WORKSHOP_DOMAIN` (default `acmerobotics.internal`) | Links read `http://office.acmerobotics.internal/...` and `http://atlassian.acmerobotics.internal/...`; only the test browser resolves them, to local ports. |

Never run two days at once on one machine: the app and browser control slow down and turns time out.

## Make the one-prompt clip

```bash
video/render_pptx.sh <deck.pptx> <dir>    # or LibreOffice + PyMuPDF at 300 dpi (see make_hero.py config)
python3 video/make_hero.py hero.json      # see video/hero.example.json
```

## Delivered so far

- **v3 day video and reports:** Google Drive, links in Slack.
- **One-prompt clip v1:** https://drive.google.com/file/d/1iWuURhY-iaDCx_ZYsvBe2xFWmQiVPZD6/view
- **One-prompt clip v2** (Open Workplace, no localhost, paced for reading): https://drive.google.com/file/d/1L9tHjOb8uX6CcPiuuQNkGTZKy_t7Wbk0/view

- **Full narrated film (v2 style), 17/17 recovered run:** https://drive.google.com/file/d/1Y525IkWPIvZWdu6Ixf30wSve9wi03-QE/view
