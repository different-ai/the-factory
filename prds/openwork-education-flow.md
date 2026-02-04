---
title: Education flow reliability
description: Make onboarding education steps resilient and recoverable.
---

## Summary
OpenWork is an open-source alternative to Claude Cowork that is mobile-first, purpose-first, and premium for non-technical users (see `_repos/openwork/AGENTS.md`).
This PRD improves the onboarding education flow so failures are recoverable and progress is preserved.

## Problem statement
- The education flow can fail with a generic "Education failed" message.
- Users do not know how to recover or continue.

## Goals
- Make onboarding resilient and recoverable.
- Provide clear failure reasons and next steps.
- Allow resume or skip without losing progress.

## Non-goals
- Build a full tutorial authoring system.

## Experience principles
- Keep onboarding lightweight and optional.
- Errors should be explainable and actionable.

## Requirements
- Track education step state with checkpoints.
- On failure, show a human-readable error and retry option.
- Provide "skip for now" and "resume later" paths.
- Log failures for diagnostics.

## UX notes
- Use an inline banner or modal with clear actions.
- Avoid blocking task creation.

## Success metrics
- Lower onboarding failure rate.
- Higher completion or safe-skip rate.
- Reduced support requests about onboarding errors.

## Risks and open questions
- Identify the upstream failure sources (network, MCP, permissions).
