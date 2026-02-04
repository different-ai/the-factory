---
title: Command composer reliability
description: Fix slash command execution and make command entry predictable.
---

## Summary
OpenWork uses commands as user-facing triggers that map to OpenCode primitives (see `_repos/openwork/AGENTS.md`).
This PRD fixes command execution in the composer and improves discoverability.

## Problem statement
- Slash command autocomplete appears but commands do not run.
- Command entry location feels inconsistent or unclear.

## Goals
- Ensure commands execute reliably from the composer.
- Make command entry predictable and discoverable.

## Non-goals
- Introduce a new command system.

## Experience principles
- Keyboard-first flow should work end-to-end.
- Command selection should always yield a visible result.

## Requirements
- Fix the command selection pipeline so it triggers execution or insertion.
- Keep autocomplete and execution tied to the same input state.
- Add a small hint in the composer to indicate command entry.

## UX notes
- Keep command list fast and searchable.
- Provide a subtle hint like "/ for commands".

## Success metrics
- Reduced command failure rate.
- Increased command usage in sessions.

## Risks and open questions
- Need to identify where the command state breaks in the current composer.
