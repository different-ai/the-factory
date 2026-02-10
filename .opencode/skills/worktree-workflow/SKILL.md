---
name: worktree-workflow
description: |
  Enforce a worktree-per-task workflow with regular commits and pushes.

  Triggers when user mentions:
  - "create a worktree"
  - "commit regularly"
  - "push changes"
---

## Quick Usage (Already Configured)

### Start a task with a fresh worktree
```bash
.opencode/skills/worktree-workflow/scripts/start-task-worktree.sh "task-name"
```

### Commit regularly and push
```bash
.opencode/skills/worktree-workflow/scripts/regular-commit.sh "message describing why"
```

## Behavior

- Any task that changes files should begin by creating a dedicated worktree.
- Commit after each meaningful chunk of work.
- Push the branch after each commit.
- Submodules are initialized in the new worktree.

## Related skills
- For UX PR flows with screenshots, use `.opencode/skills/worktree-ux-pr/SKILL.md`.

## Common Gotchas

- Use a short, kebab-case task name; it becomes the branch suffix.
- If your default branch is not `main`, set `BASE_BRANCH`.
- If you update submodule pins, make sure the target submodule SHA is reachable from a remote branch/tag (avoid pinning to commits that were only on a force-pushed ref).

## First-Time Setup (If Not Configured)

1. Ensure you are in a git repo with `origin` configured.
2. Optional: set `BASE_BRANCH` or `WORKTREES_DIR` in your shell.
