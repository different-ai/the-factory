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

### 2) Start UI + headless (optional)
```bash
scripts/start-ui.sh
scripts/start-headless.sh
```

### 3) Capture evidence
- Use Chrome MCP to open the UI and navigate to the changed surface.
- Take a screenshot and save to `/tmp`.

### 4) Upload screenshot and comment on PR
```bash
scripts/upload-catbox.sh /tmp/your-screenshot.jpg
scripts/comment-pr.sh 414 "Screenshot: https://files.catbox.moe/xyz.jpg"
```

## What This Skill Does
- Ensures worktrees are rebased on `origin/dev` and force-pushed when history changes.
- Guides Chrome MCP verification and screenshot capture.
- Provides a simple upload + PR comment workflow for evidence.
- Infers behavior based on available config in `.env` and falls back to safe defaults.

## Scripts
- `scripts/rebase-worktrees.sh`: Rebase each worktree on `origin/dev` and force-push.
- `scripts/start-ui.sh`: Start the OpenWork UI dev server.
- `scripts/start-headless.sh`: Start headless OpenWork server (optional for remote behavior).
- `scripts/upload-catbox.sh`: Upload a screenshot and return a public URL.
- `scripts/comment-pr.sh`: Comment on a PR with a screenshot URL.

## Common Gotchas
- If headless fails with a version mismatch, rebuild the server binary via:
  `pnpm --filter openwork-server build:bin`
- If Chrome MCP cannot create a session, ensure no conflicting dev servers are running.
- If GitHub comment fails, verify `gh auth status` and that the repo is correct.

## First-Time Setup (If Not Configured)
1. Ensure dependencies are installed (`pnpm install`).
2. Confirm `gh auth status` is logged in for GitHub comments.
3. Optional: set overrides in `.env.example` and copy to `.env`.

## Reference
Follow the official OpenCode skills docs: https://opencode.ai/docs/skills/
