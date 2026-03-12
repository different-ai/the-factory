---
name: worktree-ux-pr
description: |
  Automate the worktree-based UX PR workflow: rebase against origin/dev, verify via Chrome MCP, and attach evidence.

  Triggers when user mentions:
  - "rebase against origin/dev and run chrome mcp"
  - "one pr per worktree with screenshots"
  - "worktree ux improvements PR flow"
---

## Quick Usage (Already Configured)

### 1) Sync repo and rebase worktrees
```bash
scripts/rebase-worktrees.sh ux-improvement-01 ux-improvement-02
```
Worktrees are expected under `./_worktrees` at the enterprise root (override with `WORKTREE_BASE`).

### 2) Start UI + headless (optional)
```bash
scripts/start-ui.sh
scripts/start-headless.sh
```

### 3) Capture evidence
- Use Chrome MCP to open the UI and navigate to the changed surface.
- Take a screenshot and save to `/tmp`.

### 4) Upload artifact to Supabase and comment on PR
```bash
node .opencode/skills/worktree-ux-pr/scripts/upload-pr-artifact.mjs \
  --repo different-ai/openwork \
  --pr 414 \
  --label before \
  /tmp/your-screenshot.jpg

scripts/comment-pr.sh 414 "Before screenshot: https://<project-ref>.supabase.co/storage/v1/object/public/pr-artifacts/..."
```

For videos that need to render inline in GitHub, generate the GIF from the captured video itself:
```bash
bash .opencode/skills/worktree-ux-pr/scripts/make-video-preview.sh \
  /tmp/openwork-artifacts/videos/flow.mp4 \
  /tmp/openwork-artifacts/videos/flow-preview.gif \
  /tmp/openwork-artifacts/videos/flow-poster.png
```

Then upload:
- the `.gif` for inline rendering in the PR body
- the source video as the full-quality asset link
- optional poster `.png` if you want a still image instead of an animation

## What This Skill Does
- Ensures worktrees are rebased on `origin/dev` and force-pushed when history changes.
- Guides Chrome MCP verification and screenshot capture.
- Provides a simple Supabase upload + PR comment workflow for evidence.
- Handles GitHub's PR-body rendering limitation by using GIF previews for videos and inline images for screenshots.
- Infers behavior based on available config in `.env` and falls back to safe defaults.

## Related skills
- For creating worktrees and regular commits, use `.opencode/skills/worktree-workflow/SKILL.md`.
- For UI setup and verification, use `.opencode/skills/openwork-testability/SKILL.md` and `.opencode/skills/openwork-chrome-mcp-testing/SKILL.md`.

## Scripts
- `scripts/rebase-worktrees.sh`: Rebase each worktree on `origin/dev` and force-push.
- `scripts/start-ui.sh`: Start the OpenWork UI dev server.
- `scripts/start-headless.sh`: Start headless OpenWork server (optional for remote behavior).
- `scripts/make-video-preview.sh`: Generate an inline-renderable GIF preview and poster image from a captured video (`.mp4`, `.webm`, `.mov`, etc.).
- `scripts/upload-pr-artifact.mjs`: Upload a screenshot or video to Supabase Storage and record metadata in `public.pr_artifacts`.
- `scripts/comment-pr.sh`: Comment on a PR with a screenshot URL.
- `sql/setup-pr-artifacts.sql`: Create the `pr-artifacts` bucket plus the `public.pr_artifacts` table/policy.

## Common Gotchas
- If headless fails with a version mismatch, rebuild the server binary via:
  `pnpm --filter openwork-server build:bin`
- If Chrome MCP cannot create a session, ensure no conflicting dev servers are running.
- If GitHub comment fails, verify `gh auth status` and that the repo is correct.
- GitHub PR bodies do not inline remote video files from Supabase. Use a GIF preview in the Markdown body and keep the original video as a clickable link.

## First-Time Setup (If Not Configured)
1. Ensure dependencies are installed (`pnpm install`).
2. Confirm `gh auth status` is logged in for GitHub comments.
3. Copy `.opencode/skills/worktree-ux-pr/.env.example` to `.opencode/skills/worktree-ux-pr/.env` and set `SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY`.
4. Run the SQL in `.opencode/skills/worktree-ux-pr/sql/setup-pr-artifacts.sql` once in Supabase.

## Reference
Follow the official OpenCode skills docs: https://opencode.ai/docs/skills/
