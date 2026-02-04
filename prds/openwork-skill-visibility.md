---
title: Skill and prompt visibility
description: Provide a UI to inspect and understand skills and prompts.
---

## Summary
OpenWork is premium and purpose-first for non-technical users, with parity to OpenCode skills and plugins (see `_repos/openwork/AGENTS.md`).
This PRD adds visibility into skills and prompts to reduce the black-box feel.

## Problem statement
- Users cannot see or understand the prompts or skills being used.
- The system feels like a black box with no UI for inspection.

## Goals
- Provide a clear skills and prompt visibility surface.
- Make it easy to inspect, reuse, and understand skills.
- Increase trust by showing what will execute.

## Non-goals
- Build a full IDE or prompt editor.

## Experience principles
- Explain in plain language before showing raw prompt text.
- Prefer safe, read-only views by default.

## Requirements
- Add a skills library with search and categories.
- Provide a skill detail view with prompt, inputs, and recent runs.
- Link skills to tasks or schedules that use them.
- Allow exporting or copying a skill definition.

## UX notes
- Use collapsible sections to keep the detail view readable.
- Label inputs and outputs clearly.

## Success metrics
- Increased skill reuse rate.
- Reduced feedback about "not knowing what is going on".

## Risks and open questions
- Decide how much prompt detail to show by default.
