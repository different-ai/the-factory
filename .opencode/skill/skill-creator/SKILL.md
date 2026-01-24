---
name: skill-creator
description: Create new OpenCode skills with the standard scaffold.
---

## Quick Usage (Already Configured)

### Create a new skill folder
```bash
mkdir -p .opencode/skill/<skill-name>
```

### Minimum scaffold files
- `SKILL.md`
- `.env.example`
- `.skill.config`

## .skill.config (credentials only)

- Use `.skill.config` to document required credentials or external setup.
- Do not include any real credentials or code in `.skill.config`.
- Keep it human-readable (what is needed and where to get it).

## Minimal skill template

```markdown
---
name: skill-name
description: One-line description
---

## Quick Usage (Already Configured)

### Action 1
```bash
command here
```

## Common Gotchas

- Thing that doesn't work as expected

## First-Time Setup (If Not Configured)

1. ...
```

## Notes from OpenCode docs

- Skill folders live in `.opencode/skill/<name>/SKILL.md`.
- `name` must be lowercase and match the folder.
- Frontmatter requires `name` and `description`.

## Reference

Follow the official OpenCode skills docs: https://opencode.ai/docs/skills/
