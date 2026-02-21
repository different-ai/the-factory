# Den Hosted Workers Phase 1 Plan

## Goal

Deliver a functional cloud worker create flow with Better Auth, PlanetScale plus Drizzle, and a preloaded worker image. The end result should feel like "click a button, get a worker in the cloud."

## Scope (phase 1)

- Control plane service for user management, worker CRUD, and provisioning.
- Worker image pipeline with Chrome or Chromium preinstalled.
- Create worker UX update (cloud default, local optional).
- CLI smoke tests for worker create and health.

## Architecture overview

- Control plane: API service + background jobs.
- Worker plane: openwork-server + openwrk inside a per-worker runtime.
- Data plane: PlanetScale for metadata, object storage for bundles.
- Auth: Better Auth (sessions, orgs, tokens).

## System auth and user management (Better Auth)

### Accounts and sessions

- Better Auth provides signup/login and session cookies or bearer tokens.
- On first signup, create a default org and org membership.
- Support invite flow for adding members later.

### Token model

- User session token (app and API).
- Worker client token (read-only access).
- Worker host token (write approvals).
- Optional personal API key for CLI usage.

### Implementation steps

1. Add Better Auth to the control plane service.
2. Add user, org, membership, and session tables.
3. Add auth middleware and a `/v1/me` endpoint.
4. Gate worker CRUD with org membership checks.

## Database (PlanetScale + Drizzle)

### PlanetScale setup

1. Create a PlanetScale database (for example: `den`).
2. Create dev and prod branches with passwords.
3. Set `DATABASE_URL` in the control plane environment.

### Drizzle setup

- Use `drizzle-orm/planetscale-serverless`.
- Follow patterns from `_repos/opencode/packages/console/core/src/drizzle`.
- Add `drizzle.config.ts` in the control plane service.

### Migrations (suggested scripts)

- `pnpm db:generate` -> generate migrations from schema
- `pnpm db:migrate` -> apply migrations

### Minimum tables

- users
- orgs
- org_memberships
- sessions
- auth_accounts
- workers
- worker_instances
- worker_bundles
- audit_events

## Control plane service (new)

### Proposed location

- `services/den-control-plane` inside `openwork-enterprise`.

### Responsibilities

- Auth (Better Auth)
- Worker CRUD
- Provisioning orchestration
- Bundle registry
- Token minting and rotation

### API endpoints (v1)

- `POST /v1/workers` (destination: cloud or local)
- `GET /v1/workers/:id`
- `POST /v1/workers/:id/deploy`
- `POST /v1/workers/:id/tokens`
- `GET /v1/workers/:id/health` (proxy)

### Background jobs / functions

- `provisionWorker()` -> create worker runtime, assign URL
- `buildWorkerBundle()` -> snapshot and upload
- `finalizeWorker()` -> mark worker healthy, emit audit event
- `rotateWorkerTokens()` -> regenerate host/client tokens

## Worker provisioning (Render)

- Use Render API to create a service per worker.
- Prefer private service or web service with restricted ingress.
- Environment variables:
  - `OPENWORK_TOKEN`
  - `OPENWORK_HOST_TOKEN`
  - `OPENWORK_WORKSPACES`
  - `OPENWORK_APPROVAL_MODE`
  - `OPENWORK_OPENCODE_BASE_URL` (if proxying)
- Persist workspace data on a dedicated volume.

## Daytona comparison (build vs buy)

Daytona (https://www.daytona.io) positions itself as secure infrastructure for running AI-generated code with fast, stateful sandboxes, snapshots, and programmatic APIs (process execution, file CRUD, Git, LSP). It also advertises "computer use" sandboxes with Linux/Windows/macOS desktops.

Evaluation checklist:

- Can we run our preloaded worker image (Chrome/Chromium + openwork-server + openwrk)?
- Does Daytona allow stable per-worker endpoints that match openwork-server APIs?
- Can we implement the host/client token model and approvals cleanly?
- Does it support long-running, stateful workers (not just ephemeral sandboxes)?
- What are the limits and pricing for always-on workers vs short-lived jobs?

If Daytona checks these boxes, it could replace the initial provisioning layer. If not, keep it as a future adapter option.

## Worker runtime image

### Base image contents

- openwork-server binary
- opencode engine
- openwrk CLI
- Chromium or Chrome with remote debugging enabled
- fonts, CA certificates, git, curl, unzip
- node or bun runtime for tooling
- optional xvfb if the browser requires a display

### Build and publish

- Build pipeline tags `den-worker:<semver>` for production.
- `den-worker:latest` for dev only.
- Control plane pins image version per worker.

## Create worker UX changes (app)

- Update create worker modal in `_repos/openwork/packages/app`.
- Step 1: Destination (Cloud default).
- Step 2: Details.
- Step 3: Local-only folder picker.
- Add "Deploy to cloud" action on local worker details.

## Running openwork-server (worker plane)

### CLI binary

```bash
openwork-server --workspace /path/to/workspace --approval auto
```

### From source

```bash
pnpm --filter openwork-server dev -- \
  --workspace /path/to/workspace \
  --approval auto
```

Tokens are printed on boot; host token is required for approvals.

## CLI testing plan

### Start control plane

```bash
pnpm dev
```

### Create a cloud worker

```bash
curl -X POST http://localhost:PORT/v1/workers \
  -H "Authorization: Bearer <session>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Demo","destination":"cloud"}'
```

### Verify worker health

```bash
curl http://<worker-url>/health
curl http://<worker-url>/status
curl http://<worker-url>/capabilities
```

### Deploy local worker to cloud

```bash
curl -X POST http://localhost:PORT/v1/workers/<id>/deploy \
  -H "Authorization: Bearer <session>"
```

### Browser check (Chrome MCP)

- Connect to the remote debugging port and run a basic navigate test.
- Confirm the worker advertises browser capability in `/capabilities`.

## Deliverables

- Control plane service deployed to Render.
- PlanetScale schema plus migrations in Drizzle.
- Preloaded worker image with Chrome or Chromium.
- Updated create worker UX.
- CLI smoke script and documented commands.

## Risks

- Provisioning speed and need for a warm pool.
- Browser image size and cold start latency.
- Auth session handling between app and control plane.
