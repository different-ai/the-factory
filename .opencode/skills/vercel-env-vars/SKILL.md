---
name: vercel-env-vars
description: |
  Manage Vercel environment variables for OpenWork projects from the CLI, including linking the local app directory first.

  Triggers when user mentions:
  - "add a vercel env var"
  - "set a vercel env var"
  - "vercel environment variable"
---

## Quick Usage (Already Configured)

### 1) Check Vercel access
```bash
npx vercel whoami
npx vercel teams ls
```

### 2) Link the local app directory to the target project
```bash
npx vercel link --yes --scope prologe --project openwork-landing
```

### 3) Add an env var to production
```bash
npx vercel env add MY_ENV_VAR production --scope prologe --value "value" --yes
```

### 4) Add the same env var to preview and development
```bash
npx vercel env add MY_ENV_VAR preview "" --scope prologe --value "value" --yes
npx vercel env add MY_ENV_VAR development --scope prologe --value "value" --yes
```

### 5) Verify env vars on the linked project
```bash
npx vercel env ls production --scope prologe
npx vercel env ls preview --scope prologe
npx vercel env ls development --scope prologe
```

Never paste real secret values or real production identifiers into this skill.
Use placeholders in examples and provide the actual value only at execution time.

## OpenWork Defaults

- Team scope / team id to use: `prologe`
- Default landing project: `openwork-landing`
- Use the app directory you actually want to affect before linking; for landing this is usually `_repos/openwork/ee/apps/landing` or the equivalent worktree path.

## Common Gotchas

- Always point to team id `prologe` when working on OpenWork Vercel config.
- `vercel` may not be globally installed; `npx vercel ...` is the safe default.
- `vercel env ls` and `vercel env add` expect the current directory to be linked to the target project.
- For preview env vars across all branches, pass an empty third positional branch argument: `preview ""`.
- If Vercel says the codebase is not linked, run `npx vercel link --yes --scope prologe --project openwork-landing` first.

## First-Time Setup (If Not Configured)

1. Confirm Vercel auth works:
```bash
npx vercel whoami
```
2. Change into the target app directory.
3. Link it to the OpenWork project using scope `prologe`.
4. Add env vars for the environments you need.
5. Verify with `npx vercel env ls ...`.

## Example: app feedback template id

```bash
npx vercel link --yes --scope prologe --project openwork-landing
npx vercel env add LOOPS_TRANSACTIONAL_ID_APP_FEEDBACK production --scope prologe --value "<transactional-id>" --yes
npx vercel env add LOOPS_TRANSACTIONAL_ID_APP_FEEDBACK preview "" --scope prologe --value "<transactional-id>" --yes
npx vercel env add LOOPS_TRANSACTIONAL_ID_APP_FEEDBACK development --scope prologe --value "<transactional-id>" --yes
```
