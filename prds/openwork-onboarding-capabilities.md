---
title: Capability discovery and "What can you do"
description: Help users understand OpenWork capabilities and run a first task quickly.
---

## Summary
OpenWork is an open-source alternative to Claude Cowork that is mobile-first, purpose-first, and premium for non-technical users (see `_repos/openwork/AGENTS.md`).
This PRD makes capability discovery clear and actionable, including a better "What can you do" surface.

## Problem statement
- Users do not understand what OpenWork can do.
- The "What can you do" prompt is unclear and does not guide to action.

## Goals
- Make capabilities obvious within the first session.
- Provide concrete, runnable examples.
- Reduce time to first successful task.

## Non-goals
- Replace existing documentation.

## Experience principles
- Show, then do: examples should be runnable.
- Keep copy short and plain-language.

## Requirements
- Curated list of example tasks with one-tap run actions.
- Short explanations that map to OpenCode primitives (skills, commands, tools).
- Persistent "What can you do" entry point in the UI.
- Surface scheduler and skills library as part of discovery.

## UX notes
- Use cards with titles, one-line descriptions, and a primary action.
- Keep layout mobile-friendly and scannable.

## Success metrics
- Increased first-task completion rate.
- Reduced "what can I do" feedback.
- Higher engagement with skills and scheduler features.

## Risks and open questions
- Need to curate examples that are safe and non-destructive by default.
