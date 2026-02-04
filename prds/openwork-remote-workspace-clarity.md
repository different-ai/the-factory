---
title: Remote workspace connection clarity
description: Make active workspace and server status obvious.
---

## Summary
OpenWork supports remote workspaces and should make server connections clear and safe for non-technical users (see `_repos/openwork/AGENTS.md`).
This PRD improves connection clarity so users know which workspace they are using.

## Problem statement
- Users can connect to the wrong workspace without realizing it.
- The UI does not make active workspace or connection status obvious.

## Goals
- Make the active workspace and server explicit at all times.
- Provide clear connection testing and confirmation.
- Reduce accidental use of the wrong instance.

## Non-goals
- Redesign remote architecture.

## Experience principles
- Always show where work is running.
- Keep terminology consistent (workspace, server).

## Requirements
- Display active workspace name and server address in header or settings.
- Provide a "Test connection" action with clear results.
- Show a confirmation step when switching workspaces.
- Surface a visible status indicator for connected/disconnected states.

## UX notes
- Keep status compact and readable on mobile.
- Avoid technical jargon in error messages.

## Success metrics
- Fewer reports of wrong workspace usage.
- Higher success rate for remote connection setup.

## Risks and open questions
- Align workspace naming with server configuration sources.
