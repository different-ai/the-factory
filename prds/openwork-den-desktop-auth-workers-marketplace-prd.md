---
title: OpenWork Den Desktop Auth, Worker Access, and Org GitHub Marketplace PRD
description: Three-PR rollout to let desktop users sign into OpenWork Cloud from the OpenWork app, list and open Den workers from Settings, and inherit an org-scoped GitHub skills marketplace controlled by Den.
---

## 1) Executive summary

This PRD proposes a three-PR rollout that makes Den the control plane for three connected capabilities:

1. Desktop sign-in to OpenWork Cloud from inside the OpenWork app.
2. A Den settings tab in the OpenWork app that lists org-visible Den workers and lets the user click `Open`.
3. An org-scoped GitHub skills marketplace where org admins connect GitHub in Den, allow specific repos, publish them to the org marketplace, and members see that marketplace automatically after signing in.

The key product decision is that Den, not the local app, is the source of truth for:

- user identity
- org membership
- active org selection
- worker visibility
- org marketplace visibility
- GitHub repo allowlists and publication state

The key technical decision is that GitHub credentials stay in Den only. OpenWork desktop and OpenWork server should never hold a broad GitHub credential for private repo access.

## 2) Product framing

OpenWork is the app and control surface. Den is the hosted OpenWork Cloud control plane. OpenWork workers are remote runtime destinations that users connect to from the app.

This rollout should preserve the OpenWork mental model from `_repos/openwork/AGENTS.md`:

- the app is the UI and control layer
- the server is the execution and mutation layer
- a worker is a runtime destination
- cloud access should feel like a native part of OpenWork, not a separate product the user must mentally switch into

This means the user should be able to:

- sign into OpenWork Cloud from Settings
- see their Den context in the app
- open Den workers directly into the app
- see org marketplace skills in the Skills page without manually wiring GitHub credentials

## 3) Current state

### 3.1 Den web already has worker auth and worker management primitives

Current Den web flow lives primarily in `_repos/openwork/packages/web/components/cloud-control.tsx`.

It already supports:

- sign up and sign in
- social sign-in
- worker creation
- worker listing
- worker status polling
- worker token minting
- building OpenWork connect URLs and deep links

### 3.2 Den backend already has worker APIs

Current worker routes live in `_repos/openwork/services/den/src/http/workers.ts` and already expose:

- `GET /v1/workers`
- `POST /v1/workers`
- `GET /v1/workers/:id`
- `POST /v1/workers/:id/tokens`
- `GET /v1/workers/:id/runtime`
- `POST /v1/workers/:id/runtime/upgrade`
- `DELETE /v1/workers/:id`

Den auth is already powered by Better Auth in `_repos/openwork/services/den/src/auth.ts`.

### 3.3 OpenWork desktop has no Den account surface today

OpenWork Settings currently only has `general`, `model`, `advanced`, and `debug` tabs in `_repos/openwork/packages/app/src/app/types.ts`.

There is no dedicated Den or OpenWork Cloud tab, no persisted Den session model in the desktop app, and no Den worker list in Settings.

### 3.4 Skills hub is public-only today

The current hub flow in `_repos/openwork/packages/server/src/skill-hub.ts` and `_repos/openwork/packages/app/src/app/pages/skills.tsx` assumes public GitHub repos.

It is not compatible with org-controlled private repos because:

- it does not model org membership
- it does not model repo allowlists
- it does not carry a Den identity
- it does not centralize GitHub access in Den

## 4) Problem statement

Today we have pieces of the cloud story, but they are disconnected:

- Den knows about users and cloud workers, but the desktop app does not have a first-class Den session.
- Den web can list and connect workers, but desktop Settings cannot.
- GitHub private repo access for skills should be centrally controlled by Den, but the current skills hub is public and repo-coordinate based.

We need a product path where:

1. An org admin can control which repos are available to the org.
2. A member can sign into OpenWork Cloud from inside OpenWork and immediately inherit org worker access and org marketplace access.
3. The OpenWork app can open Den workers using the same predictable `connect remote` semantics it already uses elsewhere.

## 5) User roles

### 5.1 Org admin

- Owns or administers the Den org.
- Connects GitHub to Den.
- Chooses which repos are allowed.
- Publishes or unpublishes repos to the org marketplace.
- Invites or manages org members.

### 5.2 Org member

- Joins a Den org.
- Signs into OpenWork Cloud from within OpenWork.
- Sees org-visible Den workers.
- Sees org-visible marketplace skills.
- Can install marketplace skills into local or remote workspaces, subject to workspace permissions.

### 5.3 Solo user / personal org user

- Uses a default personal org created by Den.
- Can eventually use the same marketplace and worker flows without team complexity.

## 6) Goals

1. Let desktop users sign into OpenWork Cloud from the OpenWork app.
2. Add a dedicated Den surface in Settings.
3. Let signed-in users list org-visible Den workers from Settings and click `Open`.
4. Let org admins connect GitHub in Den and control which repos are published to the org marketplace.
5. Let org members automatically inherit marketplace access after signing in.
6. Keep GitHub private repo access centralized in Den.
7. Reuse existing OpenWork remote connect semantics wherever possible.

## 7) Non-goals

1. Full enterprise SSO, SCIM, or advanced policy language in this PR series.
2. Member-specific GitHub connections for marketplace access.
3. A generic multi-provider code marketplace in v1.
4. Moving all worker lifecycle management into desktop Settings in this PR series.
5. Replacing the existing public hub immediately.

## 8) Product decisions

### 8.1 Den is the source of truth

Den owns:

- authenticated user identity
- org memberships
- active org selection
- worker visibility
- GitHub installation state
- repo publication state
- org marketplace catalog visibility

### 8.2 GitHub App, not plain per-user OAuth, should back private repo marketplace access

We may still use OAuth-like browser handoff for user sign-in to Den, but the GitHub repo integration itself should use a GitHub App installation model because it gives Den explicit repo-level control.

Why this matters:

- org admins choose which repos the app can access
- Den can distinguish `repo connected` from `repo published`
- members never need to connect GitHub themselves
- Den can mint short-lived installation tokens server-side and avoid leaking broad GitHub credentials

### 8.3 `Connect` and `Publish` are separate states

Repo control needs two layers:

1. GitHub App installation allows Den to access a repo.
2. Den org admin chooses whether that repo is published to the org marketplace.

This prevents every connected repo from automatically becoming user-visible.

### 8.4 `Open worker` should reuse existing OpenWork remote-connect semantics

The user should not learn a second way to open workers.

`Open` from the Den tab should:

- obtain a short-lived connect grant from Den
- feed that into the existing remote connect flow
- reuse an existing connected workspace if the same worker is already known locally

### 8.5 The OpenWork app consumes control-plane APIs; workspace mutation still happens through OpenWork server surfaces

For marketplace installs, the preferred path is:

- desktop app proves Den membership and requests a short-lived install ticket
- OpenWork server uses that install ticket to fetch the packaged skill from Den
- OpenWork server writes the skill into the target workspace

This keeps Den as the credential broker while preserving OpenWork server as the mutation layer.

## 9) Flows the initial user sketch is missing

The original six-step user sketch is directionally right, but these flows must also exist:

1. **Invite and join flow**
   - The user must actually become an active org member before marketplace and workers appear.

2. **Active org selection**
   - A user may belong to multiple orgs. Desktop needs an active org concept.

3. **Connected repo vs published repo**
   - Admin may connect a repo to Den without exposing it to members yet.

4. **Revocation**
   - Removing a member from an org or unpublishing a repo should remove marketplace visibility.

5. **Worker reuse**
   - If the same Den worker is already connected locally, `Open` should switch to it rather than duplicating it.

6. **Provisioning and unhealthy worker states**
   - The Den tab needs UI for `provisioning`, `healthy`, `failed`, and possibly `stopped` or `upgrading` later.

7. **Sync and refresh**
   - New marketplace skills and worker changes need a clear refresh story.

8. **Skill identity collisions**
   - Two repos may publish the same skill name. Marketplace identity must be repo-qualified.

9. **Offline and expired-session behavior**
   - Desktop needs graceful behavior when Den session expires or network is unavailable.

## 10) Primary user journeys

### 10.1 Org admin connects GitHub and publishes repos

1. Admin signs into OpenWork Cloud in Den web.
2. Admin opens Org Settings -> Marketplace.
3. Admin clicks `Connect GitHub`.
4. Den starts a GitHub App install flow.
5. Admin chooses org or account and selects allowed repos.
6. Den receives the installation callback and stores installation metadata.
7. Den shows accessible repos.
8. Admin marks one or more repos as `Published to marketplace`.
9. Den indexes the selected repo roots and exposes the org marketplace catalog.

### 10.2 Member joins org and signs into OpenWork

1. Member accepts org invite or is added by admin.
2. Member opens OpenWork desktop.
3. Member opens Settings -> Den.
4. Member signs into OpenWork Cloud.
5. Desktop fetches active org and org memberships.
6. Skills page now shows the org marketplace.
7. Settings -> Den now shows org-visible workers.

### 10.3 Member opens a Den worker from the Den tab

1. Member opens Settings -> Den.
2. Desktop lists workers visible in the active org.
3. User clicks `Open` on a worker.
4. Desktop requests a short-lived connect grant from Den.
5. Desktop routes the grant through the existing OpenWork remote connect flow.
6. User lands inside the worker in OpenWork.

### 10.4 Member installs a marketplace skill

1. Member opens the Skills page.
2. Desktop shows `Org Marketplace` as a source.
3. User browses skills from published repos.
4. User clicks `Install`.
5. Desktop requests a short-lived install ticket from Den.
6. OpenWork server consumes the install ticket and writes the skill into the target workspace.
7. Skill appears in the workspace skill list.

## 11) High-level architecture

### 11.1 Control plane

- Den backend in `_repos/openwork/services/den`
- Den web admin and auth surfaces in `_repos/openwork/packages/web`

Responsibilities:

- Better Auth user sessions
- org membership and active org
- worker visibility and connect grants
- GitHub App installation and repo allowlists
- org marketplace publication state
- marketplace install ticket issuance

### 11.2 Client plane

- OpenWork app in `_repos/openwork/packages/app`

Responsibilities:

- Den sign-in UI in Settings
- Den tab UI for worker listing and open action
- org marketplace UI in Skills
- local app session storage for Den auth state
- bridging Den grants into existing OpenWork connect and install flows

### 11.3 Workspace mutation plane

- OpenWork server in `_repos/openwork/packages/server`

Responsibilities:

- install marketplace skills into workspaces
- continue to own `.opencode/skills` writes
- consume Den-issued install tickets instead of direct GitHub credentials

## 12) PR split and sequencing

### 12.1 PR1 - Foundation: desktop Den sign-in and org context

Goal: the desktop app can identify the user against Den and know the active org, even if it cannot yet list workers or marketplace skills.

### 12.2 PR2 - First Den functionality: list and open workers from Settings

Goal: signed-in users can open Settings -> Den, see their org workers, and click `Open`.

### 12.3 PR3 - GitHub marketplace

Goal: org admins can connect GitHub and publish repos in Den; org members can browse and install org marketplace skills in OpenWork.

The sequencing matters:

- PR1 creates the identity and org substrate.
- PR2 proves that Den identity in desktop is useful immediately.
- PR3 builds the marketplace on top of the same Den identity and org context.

## 13) PR1 in detail - Foundation: desktop Den sign-in and org context

### 13.1 Scope

PR1 should add:

- a new `den` settings tab or equivalent first-class `OpenWork Cloud` section in Settings
- signed-out and signed-in UI states
- a desktop-compatible Den sign-in bootstrap flow
- persisted desktop Den session state
- active org discovery
- minimal org switcher if the user belongs to multiple orgs
- sign out

PR1 should not yet add:

- worker listing
- worker open actions
- marketplace catalog
- GitHub admin controls

### 13.2 Preferred sign-in flow

Preferred user flow:

1. User opens Settings -> Den.
2. User clicks `Sign in to OpenWork Cloud`.
3. Desktop opens the Den web auth page in the default browser.
4. After web sign-in completes, Den offers one of two return paths:
   - automatic deep link back to OpenWork desktop
   - copyable one-time code if deep link return is unavailable
5. Desktop exchanges the grant or code for a desktop session.
6. Desktop stores the session securely and calls `GET /v1/me` plus org context endpoints.

### 13.3 Minimum acceptable fallback for PR1

If a full automatic deep-link return is too much for PR1, the merge bar can still be met with:

- browser sign-in in Den web
- Den showing a one-time connect code
- desktop paste field to complete sign-in manually

This satisfies the user requirement that desktop can at least be populated with Den sign-in state.

### 13.4 Proposed Den endpoints for PR1

Add or formalize endpoints such as:

- `POST /v1/desktop/auth/start`
  - returns `authUrl`, `handoffId`, and optionally a polling interval
- `POST /v1/desktop/auth/exchange`
  - input: `handoffId` plus deep-link grant or manual code
  - returns a desktop bearer session plus user summary
- `POST /v1/desktop/auth/refresh`
  - refreshes desktop bearer session
- `DELETE /v1/desktop/auth/session`
  - revokes current desktop session
- `GET /v1/me`
  - returns user summary
- `GET /v1/me/orgs`
  - returns org memberships and current active org
- `POST /v1/me/active-org`
  - sets the active org for desktop-driven Den requests

### 13.5 Desktop session model

Desktop needs a new app-level Den session model, separate from workspace state.

Suggested shape:

- `status`: signed_out | loading | signed_in | error
- `user`: id, name, email, avatar
- `activeOrg`: id, name, role
- `memberships`: list of orgs the user can switch into
- `accessToken`
- `refreshToken` or renewable session handle
- `expiresAt`

### 13.6 Storage requirements

Preferred storage:

- OS-backed secure storage or Tauri secure secret storage

Acceptable temporary compromise only if needed to unblock PR1:

- app-local persisted storage with clear follow-up to move secrets into secure storage before broad rollout

Not acceptable:

- storing Den session tokens in workspace files
- storing Den session tokens in `.opencode`

### 13.7 UX requirements for PR1

Settings -> Den should show:

- signed-out empty state
- `Sign in to OpenWork Cloud`
- `Open in browser` or `Continue in browser`
- optional `Enter code` fallback
- signed-in card with user identity
- active org chip or selector
- `Open Den in browser`
- `Sign out`

### 13.8 Backend changes needed in Den

- explicit desktop session exchange flow
- active org concept instead of `first membership wins`
- ability to return org memberships cleanly to desktop

The current `getOrgId()` helper in `_repos/openwork/services/den/src/http/workers.ts` is not sufficient for multi-org use because it just returns the first membership.

### 13.9 Acceptance criteria for PR1

1. User can sign into OpenWork Cloud from desktop Settings.
2. User can quit and reopen the app and remain signed in.
3. Desktop can fetch the signed-in user and active org.
4. User can sign out and the session is cleared locally.
5. If multiple orgs exist, desktop can switch active org.
6. No worker listing or marketplace UI is required yet.

## 14) PR2 in detail - Den tab: list and open workers from Settings

### 14.1 Scope

PR2 should add:

- worker listing in Settings -> Den
- worker refresh
- worker status display
- `Open` action
- reuse of existing connected worker where applicable
- optional `Manage in Den` link for advanced actions that remain web-only

PR2 should not yet add:

- desktop worker create
- desktop worker rename or delete
- marketplace UI

### 14.2 Why this is the right first Den feature

This gives immediate value after PR1:

- user signs in
- user sees something meaningful tied to Den
- user can open a real worker from within OpenWork

It also validates the central assumption that Den identity can drive OpenWork desktop behavior.

### 14.3 Worker listing behavior

Settings -> Den should show:

- current active org
- worker search/filter bar if needed
- worker rows with:
  - name
  - status
  - provider / region if available
  - updated time
  - `Open` button
  - optional `Open in Den` or `Manage in Den`

Empty states:

- signed in, no workers in org
- signed in, workers loading
- signed in, API error

### 14.4 Worker statuses to support in PR2

At minimum:

- provisioning
- healthy
- failed
- unknown

Later states like upgrading or stopping can be additive.

### 14.5 `Open` worker behavior

When the user clicks `Open`:

1. Desktop checks whether a local workspace is already bound to the same Den worker id.
2. If yes, desktop switches to that workspace/session.
3. If not, desktop requests a short-lived connect grant from Den.
4. Desktop routes that connect grant through the existing remote connect flow.
5. The worker opens in the standard OpenWork UI.

### 14.6 Do not use raw long-lived worker tokens as the main `Open` primitive

Current Den web uses `POST /v1/workers/:id/tokens` in `_repos/openwork/services/den/src/http/workers.ts`.

That is useful groundwork, but PR2 should prefer a more constrained connect primitive such as:

- `POST /v1/workers/:id/connect-grants`

Response should include something like:

- `workerId`
- `workerName`
- `openworkUrl`
- `workspaceId` if already known
- `accessToken` or collaborator token with short TTL
- optional owner-capable token only if required
- `expiresAt`

The important property is that desktop gets a short-lived connection grant rather than a general-purpose long-lived token set.

### 14.7 OpenWork app changes for PR2

- extend `SettingsTab` with `den`
- add Den worker list state and fetch actions
- add metadata on connected remote workspaces for:
  - `denWorkerId`
  - `denOrgId`
  - `denWorkerName`
- dedupe `Open` against those metadata fields

### 14.8 Den backend changes for PR2

- explicit active-org aware worker list path
- explicit connect-grant issuance endpoint
- optional audit event when a worker is opened via desktop

### 14.9 Acceptance criteria for PR2

1. Signed-in user can open Settings -> Den and see workers for the active org.
2. User can click `Open` and land in that worker in OpenWork.
3. Opening the same worker twice should reuse the existing connected workspace when possible.
4. If the worker is provisioning or failed, the UI should say so clearly.
5. Advanced worker management can remain in Den web.

## 15) PR3 in detail - Org GitHub marketplace

### 15.1 Scope

PR3 should add:

- Den web admin UI to connect GitHub for an org
- GitHub App installation flow
- repo discovery for accessible repos
- publish / unpublish controls per repo
- org marketplace listing in OpenWork Skills
- marketplace skill install into a workspace

PR3 should not require:

- member-specific GitHub auth
- direct desktop GitHub credential storage

### 15.2 Admin user experience in Den

Org admin flow:

1. Open Den web -> Org Settings -> Marketplace.
2. Click `Connect GitHub`.
3. Complete GitHub App installation flow.
4. Return to Den and see accessible repos.
5. For each repo, choose:
   - default ref / branch
   - skill root path if non-default later (optional, can be fixed to `skills/` in v1)
   - published on/off
6. Save publication state.

Important distinction:

- `Connected` means Den can read the repo.
- `Published` means org members can see it in OpenWork.

### 15.3 Member user experience in OpenWork

After the member signs into OpenWork Cloud:

- Skills page shows a new `Org Marketplace` source or section.
- The section is scoped to the active org.
- Each skill card shows:
  - skill name
  - description
  - source repo badge
  - optional org badge
  - install button

The public hub can remain available as a separate source.

### 15.4 Skill identity model

Marketplace skills must not be identified by name alone.

Use a repo-qualified identity such as:

- org id
- marketplace repo id
- skill name

This avoids collisions when two repos expose the same skill name.

### 15.5 GitHub data model in Den

Suggested new tables or equivalent models:

- `github_installations`
  - installation id
  - github account / org id
  - org id in Den
  - installed by user id
- `github_installation_repositories`
  - repo id
  - repo full name
  - installation id
  - default branch
  - private/public flag
- `org_marketplace_repositories`
  - org id
  - repo id
  - published boolean
  - configured ref
  - skill root path
  - last indexed at
- optional `org_marketplace_skill_cache`
  - cached manifest for faster listing

### 15.6 Proposed Den endpoints for PR3

Admin-facing:

- `POST /v1/orgs/:orgId/github/install/start`
- GitHub App callback and webhook endpoints
- `GET /v1/orgs/:orgId/github/repos`
- `PUT /v1/orgs/:orgId/marketplace/repos/:repoId`
- `DELETE /v1/orgs/:orgId/marketplace/repos/:repoId`

Member-facing:

- `GET /v1/marketplace/skills`
  - scoped to active org unless overridden
- `GET /v1/marketplace/repos`
- `POST /v1/marketplace/skills/:skillId/install-ticket`

Install-consumption:

- `POST /v1/marketplace/install-tickets/:ticketId/consume`
  - returns packaged skill files or a streamed archive for the OpenWork server

### 15.7 Install flow between OpenWork and Den

Preferred install sequence:

1. Desktop user clicks `Install` on a marketplace skill.
2. Desktop app calls Den and requests a short-lived install ticket.
3. Desktop app calls a new OpenWork server install endpoint with that ticket.
4. OpenWork server consumes the ticket from Den.
5. Den verifies org membership and publication state.
6. Den fetches files from GitHub using its server-side GitHub App installation token.
7. OpenWork server writes the skill into `.opencode/skills/<name>`.
8. Skills list refreshes in the desktop app.

This preserves:

- Den as the GitHub credential holder
- OpenWork server as the workspace mutator
- OpenWork app as the orchestrating client

### 15.8 OpenWork server changes for PR3

Add a marketplace install path parallel to the public hub install path.

Suggested shape:

- `POST /workspace/:id/skills/marketplace/:skillId`
  - body includes Den install ticket

Responsibilities:

- validate the request shape
- fetch packaged marketplace skill from Den
- write all required files into the workspace skill directory
- emit the same skill reload and audit events used by existing installs

### 15.9 OpenWork app changes for PR3

- add `Org Marketplace` UI to the Skills page
- add signed-out and signed-in-empty states
- add org marketplace search and filters
- show repo-qualified install source
- show a clear message when the user is signed in but the active org has no published repos

### 15.10 Acceptance criteria for PR3

1. Org admin can connect GitHub to Den and see accessible repos.
2. Org admin can publish a repo to the marketplace.
3. Member signed into OpenWork Cloud can see marketplace skills in the OpenWork Skills page.
4. Member can install a marketplace skill into a workspace.
5. Unpublishing a repo removes it from member marketplace listings.
6. Member does not need to connect GitHub personally.

## 16) Security and token model

### 16.1 Den session tokens

- Used by desktop to authenticate against Den APIs.
- Should be refreshable and revocable.
- Should be stored securely on desktop.

### 16.2 Worker connect grants

- Short-lived
- scoped to a single worker and connection flow
- should not be reused as a broad admin token if avoidable

### 16.3 Marketplace install tickets

- Short-lived
- scoped to one skill install
- one-time or low-use consumption strongly preferred

### 16.4 GitHub credentials

- GitHub App installation tokens remain server-side in Den only.
- Desktop app never stores GitHub private repo credentials.
- OpenWork server only sees Den-issued install tickets, not GitHub credentials.

## 17) UX details and recommendations

### 17.1 Settings IA

Recommended settings tabs after PR2:

- General
- Model
- Den
- Advanced
- Debug

The Den tab should become the home for:

- sign in/out
- active org
- worker list
- later, maybe marketplace summary

### 17.2 Naming

Use user-facing copy like:

- `OpenWork Cloud`
- `Sign in to OpenWork Cloud`
- `Open in OpenWork`
- `Manage in Den`

Avoid requiring users to understand the name `Den` before value is clear.

### 17.3 PR2 empty state

If the active org has no workers, show:

- `No cloud workers yet`
- CTA: `Open Den to create one`

This keeps create-worker scope out of PR2 while still giving users a path forward.

### 17.4 PR3 empty state

If the active org has no marketplace repos:

- `Your org has not published any marketplace repos yet`
- if user is an admin, link to Den marketplace settings
- if user is a member, say `Ask your org admin to publish a repo`

## 18) Data and audit requirements

We should record audit events for at least:

- desktop Den sign-in and sign-out
- active org changes
- worker open actions
- GitHub connection and installation changes
- repo publication and unpublication
- marketplace skill install actions

## 19) Risks and mitigations

1. **Desktop auth complexity**
   - Mitigation: allow a one-time-code fallback if deep-link return is not ready.

2. **Multi-org ambiguity**
   - Mitigation: make active org explicit in PR1 and use it consistently in PR2 and PR3.

3. **Worker token overexposure**
   - Mitigation: prefer short-lived connect grants over reusing long-lived worker tokens.

4. **GitHub repo overexposure**
   - Mitigation: separate GitHub installation access from marketplace publication state.

5. **Marketplace install trust boundary confusion**
   - Mitigation: use Den-issued install tickets and keep GitHub credentials in Den only.

6. **Catalog staleness**
   - Mitigation: support manual refresh first; add webhook-driven or scheduled reindex later.

## 20) Success metrics

### PR1

- Desktop sign-in success rate above 95% in internal testing.
- Session restore after app restart works reliably.

### PR2

- Signed-in user can open a Den worker in two primary actions: Settings -> Den -> Open.
- Open-to-connected-worker success rate above 95% in internal testing.

### PR3

- Admin can connect GitHub and publish a repo without manual CLI steps.
- Signed-in member sees published marketplace skills from the active org.
- Marketplace install success rate above 95% in internal testing.

## 21) Suggested implementation order inside each PR

### PR1

1. Den desktop auth endpoints
2. app-level Den session store
3. Settings Den auth UI
4. org membership and active org endpoints
5. org switcher UI

### PR2

1. worker list API adjustments for active org
2. short-lived connect grant endpoint
3. desktop Den tab worker list UI
4. `Open` integration with remote connect flow
5. reuse/dedupe of already-connected workers

### PR3

1. GitHub App integration in Den
2. repo discovery and publication data model
3. Den admin UI for repo publication
4. member marketplace listing API
5. OpenWork Skills UI for org marketplace
6. OpenWork server install endpoint using Den install tickets

## 22) Open questions

1. Do we require secure OS-backed secret storage in PR1, or is an app-local persisted session acceptable for the first merge behind a flag?
2. Should active org be a global Den preference, or app-specific state stored per desktop client?
3. Should PR2 use the existing `POST /v1/workers/:id/tokens` endpoint temporarily, or should it add a stricter connect-grant endpoint immediately?
4. For PR3, do we support only a fixed `skills/` repo root in v1, or allow admin-configurable subpaths from day one?
5. Should marketplace listing aggregate all published repos into one view by default, or show repos first and skills second?

## 23) Final recommendation

Proceed with the three-PR split exactly as follows:

1. **PR1:** desktop Den sign-in plus active org foundation
2. **PR2:** Den tab with worker list and `Open`
3. **PR3:** GitHub App backed org marketplace

This sequence gives users value after each PR, keeps the trust boundary clean, and makes Den the right long-term control plane for both worker access and private repo marketplace access.
