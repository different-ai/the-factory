---
title: Update notification clarity
description: Make update prompts actionable, clear, and non-repetitive.
---

## Summary
OpenWork is an open-source alternative to Claude Cowork that is mobile-first, purpose-first, and premium for non-technical users (see `_repos/openwork/AGENTS.md`).
This PRD clarifies update prompts so users know what is updating, why it matters, and what action to take.

## Problem statement
- "Updates available" appears on login with unclear meaning.
- Users do not know if the update is for the app, server, or a technical constraint.
- Clicking can repeat the prompt without resolving.

## Goals
- Show update prompts only when actionable.
- Explain what is being updated and the impact.
- Avoid repeated prompts for the same update.
- Preserve a premium, low-friction UX.

## Non-goals
- Replace the update system.
- Add new distribution channels.

## Experience principles
- Clear, minimal copy with one obvious action.
- Non-blocking when safe to defer.
- Transparent about what will change.

## Requirements
- Detect update type and label it (app, server, workspace, migration).
- Provide a single primary action with a clear outcome.
- De-duplicate prompts until state changes.
- Offer "remind me later" without reappearing on next login.

## UX notes
- Use a compact banner or toast with a one-line description.
- Keep button size consistent with standard primary actions.
- Link to release notes or change details when available.

## Success metrics
- Reduced repeated prompts per session.
- Lower user confusion about update meaning.
- Higher update completion rate.

## Risks and open questions
- Some updates may require mandatory action; define blocking criteria.
- Need to confirm update sources for app vs server vs workspace.
