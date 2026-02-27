# OpenWork Enterprise

OpenWork Enterprise is the OpenWork Factory superproject: one workspace for product repos, operational automation, and reusable OpenCode behaviors.

The aim is simple: make teams dramatically faster by turning repeated work into predictable, auditable workflows.

## Why this exists

- Build automation-first workflows, skills, and runbooks that scale beyond ad-hoc scripts.
- Coordinate development and operations across multiple related repos without losing context.
- Capture company operations as code + docs so processes are reproducible, inspectable, and improvable.

## What lives here

- `AGENTS.md` - behavior contract for the OpenWork Factory assistant in this workspace.
- `ISSUES.md` - recurring conceptual and ops issues to keep fixing systematically.
- `.opencode/skills/` - reusable capabilities (syncing submodules, worktree flow, testing, release helpers, etc.).
- `.opencode/commands/` - command shortcuts such as the release flow.
- `_repos/` - pinned product and support repos, including `openwork`, `opencode`, `opencode-browser`, `opencode-scheduler`, `agent-mint`, `agent-bank`, and `agent-watch`.
- `_worktrees/` - isolated worktrees for task-by-task implementation.
- `prds/` and `research/` - planning and research artifacts.

## Default working loop

1. Sync root + submodules before starting work.
2. Use a dedicated worktree for each task.
3. Implement in the correct repo under `_repos/`.
4. For user-facing or remote behavior, run the OpenWork Docker stack and verify through Chrome MCP.
5. Keep docs/prompts/skills updated as behavior changes.

## Quick start

1. Clone this repo.
2. Initialize submodules:

   ```bash
   git submodule update --init --recursive
   ```

3. Read `AGENTS.md` (workspace behavior) and `_repos/openwork/AGENTS.md` (product source of truth).
4. Use the existing skills and commands in `.opencode/` to run repeatable workflows.

## Current focus areas

- GitHub issues triage
- PR update triage
- Service domain setup and package maintenance
- Notion CRM and documentation
- Better release evidence and post-release verification
