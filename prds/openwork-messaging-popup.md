---
title: Messaging popup clarity
description: Reduce distraction and clarify the messaging surface.
---

## Summary
OpenWork is an open-source alternative to Claude Cowork that is mobile-first, purpose-first, and premium for non-technical users (see `_repos/openwork/AGENTS.md`).
This PRD redesigns the messaging popup so it feels intentional and not like a support chat widget.

## Problem statement
- Messaging popup is distracting.
- Visual style resembles a support chat widget, creating confusion.

## Goals
- Reduce distraction.
- Clarify that the popup is part of OpenWork messaging bridge.
- Allow dismissal or disablement.

## Non-goals
- Remove messaging features.

## Experience principles
- Subtle, premium, and clearly labeled.
- User control over visibility.

## Requirements
- Update styling to match OpenWork UI and avoid support-chat conventions.
- Add clear labeling such as "Message bridge" or "Inbox".
- Provide dismiss/minimize and a settings toggle.

## UX notes
- Avoid bright yellow and floating chat bubble patterns.
- Keep popup from covering core actions.

## Success metrics
- Reduced confusion feedback about support chat.
- Lower immediate dismissal rate after redesign.

## Risks and open questions
- Determine which surfaces should trigger the popup.
