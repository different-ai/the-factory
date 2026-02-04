---
title: MCP failure recovery
description: Provide clear MCP error handling and session recovery.
---

## Summary
OpenWork integrates with OpenCode and relies on MCP for authorization. It must stay reliable for non-technical users (see `_repos/openwork/AGENTS.md`).
This PRD improves MCP error handling and session recovery.

## Problem statement
- MCP failures interrupt sessions with vague errors.
- Users are unsure how to return to their session.

## Goals
- Provide clear MCP error messages and recovery actions.
- Preserve session state and allow return to work.
- Avoid hard stops when failures are transient.

## Non-goals
- Replace MCP architecture.

## Experience principles
- Make recovery the default path.
- Distinguish between auth, network, and config failures.

## Requirements
- Capture and categorize MCP errors.
- Provide actions: retry, open settings, or return to session.
- Preserve session state and restore after recovery.
- Log diagnostics for support and debugging.

## UX notes
- Use a concise error sheet with clear next steps.
- Avoid blocking the app if only one session fails.

## Success metrics
- Reduced session abandonment after MCP errors.
- Increased recovery success rate without restart.

## Risks and open questions
- Need to define MCP error taxonomy and intercept points.
