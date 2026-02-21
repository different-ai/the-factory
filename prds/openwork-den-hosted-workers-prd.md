---
title: Den - Hosted Workers (Cloud-first) PRD
description: Focused plan for cloud worker creation, one-click deploy from local, and preloaded runtime images.
---

## 1) Executive summary

Den is a hosted worker experience that makes it feel like "click a button, get a worker in the cloud." This PRD narrows scope to two flows:

- Create a cloud worker and work directly from it.
- Create a local worker, then click "Deploy to cloud" to lift it into a hosted worker.

Phase 1 is a fully functional create-worker flow with a remote option, backed by Better Auth and a control plane that provisions a preloaded worker image (Chrome or Chromium ready for Chrome MCP).

## 2) Product framing and positioning

Launch promise:

- Click once to create a sandboxed cloud worker.
- The worker comes with a preloaded image (Chrome or Chromium plus tooling) so browser automation works immediately.
- Local workers remain available, but cloud is the default for hosted use.

Alignment with `_repos/openwork/AGENTS.md`:

- OpenCode is the engine.
- The desktop app and chat surfaces are the experience layer.
- Local-first, cloud-ready, ejectable.

## 3) Problem statement

Today the system has local sandboxes and remote components, but no productized, authenticated flow to:

- create a cloud worker in minutes
- guarantee a preloaded runtime image
- promote a local sandbox to the cloud with a single action

This blocks the core promise: "click a button, get a worker."

## 4) Goals, non-goals, success metrics

### 4.1 Goals

1. Cloud worker creation under 2 minutes from the app or CLI.
2. One-click "Deploy to cloud" from a local worker (same worker contract).
3. Better Auth based system auth (users, orgs, sessions, tokens).
4. Preloaded worker image includes Chrome or Chromium and Chrome MCP bridge support.
5. Remote workers are sandboxed by default.

### 4.2 Non-goals (phase 1)

1. Hybrid routing between local and cloud within a single run.
2. Multi-cloud abstraction.
3. Full enterprise governance stack (SCIM, SSO policy language).

### 4.3 Success metrics

- Time to first cloud worker under 10 minutes from signup.
- At least 60% of new users create a cloud worker in their first session.
- Worker start success rate at least 99%.

## 5) Primary user journeys

### 5.1 Create a cloud worker (default)

1. User opens "Create worker".
2. Step 1: choose destination -> Cloud (default).
3. User enters a name and optional description.
4. Click "Create cloud sandbox worker".
5. Worker provisions and becomes reachable in the app and API.

### 5.2 Deploy local worker to cloud

1. User builds a local worker and validates a run.
2. Click "Deploy to cloud".
3. The app packages workspace and config references.
4. Control plane provisions a cloud worker from the bundle.
5. Worker is now hosted and accessible in the app and chat.

## 6) Create worker UX (phase 1)

- Step 1: Destination
  - Cloud (default)
  - Local
- Step 2: Details
  - Name, description, tags (same for both)
- Step 3: Local-only fields
  - Workspace folder picker
  - Sandbox backend selector (auto, docker, container, none)
- Submit
  - Cloud: "Create cloud sandbox worker"
  - Local: "Create local worker"

Notes:

- Cloud does not ask for a folder.
- Cloud workers are always sandboxed by default.
- Local workers keep the existing folder-based flow.
- In the list view, show a "Deploy to cloud" action for local workers.

## 7) Worker runtime image (preloaded)

Base image must include:

- openwrk runtime plus openwork-server plus opencode engine
- Chrome or Chromium with remote debugging enabled
- Fonts and minimal desktop deps for headless browsing
- opencode-browser plugin compatibility (Chrome MCP)
- Git, curl, unzip, CA certificates, node or bun runtime
- Optional: xvfb if required by the browser provider

Versioning:

- Image tagged as `den-worker:<semver>` and pinned per worker.
- Control plane stores image version in worker metadata.

## 8) Architecture (v1)

### 8.1 Control plane

- API for worker CRUD, auth, and provisioning
- Better Auth for users, sessions, orgs
- Worker orchestrator (Render API or equivalent)

### 8.2 Worker plane

- Per-worker runtime instance
- openwork-server exposes stable endpoints
- openwrk bootstraps workspace and sandbox mode

### 8.3 Client plane

- Desktop app and chat connectors use the same worker endpoints.
- A single worker URL plus client token grants read access.

## 9) Identity and auth

- Use Better Auth for:
  - user login and sessions
  - org membership
  - worker-scoped tokens
- Token classes:
  - user session token
  - worker client token (read)
  - worker host token (write approvals)

## 10) Data model (minimum)

- Org
- User
- OrgMembership
- Worker
- WorkerInstance
- WorkerBundle
- AuthAccount
- Session
- AuditEvent

## 11) Infrastructure choices

- Control plane hosting: Render (API plus background workers)
- Database: PlanetScale (MySQL) with Drizzle ORM
- Object storage: S3 compatible bucket for worker bundles
- Secrets: provider secret manager (Render or external)

## 12) Daytona comparison (build vs buy)

Daytona (https://www.daytona.io) positions itself as "Secure and Elastic Infrastructure for Running Your AI-Generated Code" with:

- sub-90ms sandbox creation claims
- stateful sandboxes that can run indefinitely
- snapshots to save/restore environments
- REST/SDK APIs for process execution, file CRUD, Git, and LSP
- "computer use" sandboxes with Linux/Windows/macOS desktops

Potential advantages for Den:

- proven sandbox provisioning layer and stateful runtime model
- snapshot and restore semantics that align with "deploy a worker" and "resume a worker"
- built-in APIs that may shorten worker orchestration time

Potential gaps or risks:

- Den needs tight integration with openwork-server endpoints and approval flow
- Chrome MCP requires a browser-ready image and remote debugging support
- token model (host/client) and audit expectations may not map 1:1
- dependency on external control plane vs. owning the full stack

Decision trigger:

- If Daytona can host our preloaded image, expose stable endpoints, and meet token/audit requirements, it could replace the initial worker provisioning layer. Otherwise, keep Daytona as a later adapter target.

## 13) Phased plan

### Phase 1 (MVP): cloud worker create

- Better Auth integration
- PlanetScale plus Drizzle schema and migrations
- Create worker API and provisioning
- Preloaded worker image
- Create worker UI with cloud default

### Phase 1.5: one-click deploy from local

- Bundle creation and upload
- Deploy to cloud button in app
- Promotion flow with preflight checks

### Phase 2 (later)

- Hybrid routing
- Multi-provider orchestration
- Advanced admin controls

## 14) Risks and mitigations

- Large image size -> use a slim base and layer caching.
- Chrome licensing -> default to Chromium if needed.
- Provisioning latency -> warm pool or prebuilt images.

## 15) Open questions

1. Which browser build (Chrome vs Chromium) should be the default?
2. Which Render product type is best for per-worker instances (web service vs private service)?
3. Should cloud workers be single-tenant always in phase 1?

## 16) Next steps

1. Align on phase 1 scope and control plane location.
2. Define worker image contents and build pipeline.
3. Draft the create worker UI change list.
4. Write the detailed phase 1 plan (see plan.md).
