---
name: planetscale
description: |
  Use PlanetScale for managed MySQL databases in OpenWork services.

  Triggers when user mentions:
  - "PlanetScale"
  - "pscale"
  - "planetscale database"
---

## Quick Usage (Already Configured)

### Verify required auth config
```bash
test -n "$PSCALE_SERVICE_TOKEN_ID" && test -n "$PSCALE_SERVICE_TOKEN"
```

### List databases in organization
```bash
bash .opencode/skills/planetscale/scripts/list-databases.sh
```

### Create database
```bash
bash .opencode/skills/planetscale/scripts/create-database.sh
```

### Create branch password (returns `username` + `plain_text`)
```bash
bash .opencode/skills/planetscale/scripts/create-branch-password.sh den-control-plane admin
```

### Required environment variables
- `PSCALE_SERVICE_TOKEN_ID`
- `PSCALE_SERVICE_TOKEN`
- `PSCALE_ORG`
- `PSCALE_DB`
- `PSCALE_BRANCH`

### Optional variables
- `PSCALE_REGION` (default `us-east`)

## First-Time Setup (If Not Configured)

1. Create a PlanetScale database and branch.
2. Create a PlanetScale service token with required accesses.
3. Copy `.env.example` to `.env` and fill in values.

## Notes

- Store secrets in `.env` only; `.env` is ignored by git.
- PlanetScale API auth header format is `SERVICE_TOKEN_ID:SERVICE_TOKEN`.
- This skill uses environment variables so scripts can run locally or in CI.
