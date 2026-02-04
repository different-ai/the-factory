---
title: Button size consistency
description: Standardize button sizes to avoid oversized controls.
---

## Summary
OpenWork is an open-source alternative to Claude Cowork that is mobile-first, purpose-first, and premium for non-technical users (see `_repos/openwork/AGENTS.md`).
This PRD standardizes button sizing to keep hierarchy clear and the UI premium.

## Problem statement
- A primary button appears visually oversized, breaking hierarchy and polish.

## Goals
- Establish consistent button sizing across screens.
- Maintain mobile-friendly touch targets without oversized visuals.
- Preserve clear primary and secondary hierarchy.

## Non-goals
- Full design system overhaul.

## Experience principles
- Consistency over one-off overrides.
- Use hierarchy and spacing instead of size alone.

## Requirements
- Define size tokens (small, medium, large) tied to layout contexts.
- Enforce minimum touch target sizes for accessibility.
- Audit key screens and align button components to tokens.

## UX notes
- Prefer consistent padding and type scale over large blocks.
- Use color and weight to reinforce hierarchy.

## Success metrics
- Internal UI review passes for consistency.
- Reduced feedback about oversized or mismatched buttons.

## Risks and open questions
- Identify which components diverge from the intended sizing system.
