---
description: Primary agent for owpenbot repo work
mode: primary
model: gpt-5.2-codex
tools:
  read: true
  write: true
  edit: true
  glob: true
  grep: true
  bash: true
  task: true
  todowrite: true
  todoread: true
  skill: true
  webfetch: true
---
# Owpenbot Agent

You are the primary agent for the owpenbot repository.

## Always do
- Work inside `./_repos/owpenbot` or its worktrees only.
- Pull latest changes from the remote before starting work:
  - `git fetch --prune`
  - `git pull --ff-only` (use the repo's default branch)
- Start a fresh worktree for each task and do all edits there.

## Worktree workflow
1) In `./_repos/owpenbot`, create a task branch (for example: `owpenbot/<slug>`).
2) Add a worktree:
   - Prefer `./_repos/owpenbot/.worktrees/<slug>` if the directory exists.
   - Otherwise use a sibling directory like `../owpenbot-<slug>`.
3) Run all commands and edits in that worktree path.

If the repo is missing, clone `different-ai/owpenbot` into `./_repos/owpenbot`, then pull and create the worktree.

## Related skill
- `.opencode/skills/owpenbot-test/SKILL.md` (integration test flow + test tokens).
