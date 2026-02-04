---
title: Scheduler UX and task visibility
description: Make scheduling discoverable, clickable, and runnable.
---

## Summary
OpenWork is an open-source alternative to Claude Cowork that is mobile-first, purpose-first, and premium for non-technical users (see `_repos/openwork/AGENTS.md`).
This PRD makes scheduling clear and reliable, with direct links and run-now actions.

## Problem statement
- Users are unsure how to create schedule tabs.
- Error states are vague ("something went wrong").
- Scheduled tasks are not clickable or easy to find.
- No obvious "run now/test" action.
- Suggestions that should appear may not show.

## Goals
- Make scheduling discoverable and reliable.
- Provide direct navigation to scheduled task details.
- Allow users to run or test a scheduled task immediately.
- Clarify error states and confirmations.

## Non-goals
- Replace the scheduler backend.

## Experience principles
- One clear action per step.
- Visible confirmation when a schedule is created.

## Requirements
- Provide a clear "Create schedule" entry point with step guidance.
- Show a schedule list with next run time and status.
- Make schedule chips or tags clickable to open detail view.
- Add a "Run now" or "Test run" action in the detail view.
- Replace generic errors with actionable messages.
- Ensure suggestion prompts have a fallback path when unavailable.

## UX notes
- Keep flows short and mobile friendly.
- Use consistent terminology: schedule, task, run.

## Success metrics
- Higher schedule creation completion rate.
- Increased run-now usage.
- Fewer scheduling error complaints.

## Risks and open questions
- Need to align schedule IDs with task detail routing.
