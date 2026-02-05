# PRD: Workspace Hub in Session Sidebar

## Summary
Move all workspace switching and connection management into the session sidebar, making each workspace row clickable and expandable. Replace the existing workspace switcher UI with a single, compact workspace hub that supports add, connect, test, and troubleshoot flows. Add a one-command dev script to start `openwrk` + web UI and auto-connect via env-driven settings, while preserving local-first safety and OpenCode parity.

## Background and Problem
OpenWork currently exposes workspace switching and connection settings across multiple surfaces (workspace switcher, settings, and onboarding). Connection failures for saved workspaces can be silent, and remote connect flows lack clear error feedback. This conflicts with OpenWork goals of transparency, graceful degradation, and premium UX. We need a single, obvious place to manage and troubleshoot workspace connectivity.

## Goals
- **Single workspace hub**: The session sidebar is the only place to switch workspaces, add new workspaces, and manage connection settings.
- **Visible connection state**: Show connection status and errors directly in the workspace list.
- **Fast troubleshooting**: Provide a "Test connection" action and a path to edit connection settings when failures occur.
- **Auto-connect dev workflow**: Enable env-driven auto-connect for web dev, with a one-command script to start `openwrk` + web UI.
- **Align with architecture**: Keep OpenWork as the UX layer, OpenCode as engine, and use existing CLI + API surfaces.

## Non-goals
- Redesigning OpenWork server APIs or OpenCode session primitives.
- Replacing the onboarding flows entirely.
- Building a new multi-tenant workspace model.
- Shipping a new external storage format for workspace metadata.

## Personas
- **Bob (IT / Admin)**: Manages multiple workspaces, expects quick switching and clear connection diagnostics.
- **Susan (non-technical)**: Needs a simple "Add workspace" and clear "why it failed" messaging.
- **Power user**: Wants a fast sidebar hub without modal detours.

## Current State (Code Anchors)
- Workspace switcher UI: `packages/app/src/app/components/workspace-picker.tsx`
- Sidebar sessions list: `packages/app/src/app/components/session/sidebar.tsx`
- Workspace store + switching: `packages/app/src/app/context/workspace.ts`
- OpenWork server settings storage: `packages/app/src/app/lib/openwork-server.ts`
- Saved server list: `packages/app/src/app/context/server.tsx`
- Settings UI (connection forms): `packages/app/src/app/pages/settings.tsx`
- Dashboard workspace list: `packages/app/src/app/pages/dashboard.tsx`
- App routing and view composition: `packages/app/src/app/app.tsx`

## Proposed UX
### Sidebar Workspace Hub
Add a top-level "Workspaces" section in `SessionSidebar`:
- Each workspace row is **clickable** to switch the active workspace.
- Each row is **expandable** to reveal actions:
  - Edit connection
  - Test connection
  - Remove / forget workspace (if applicable)
- Show status badge per workspace:
  - `Connected` (green), `Connecting` (amber), `Error` (red), `Idle` (muted)
- When a workspace is in error state, show short summary (e.g. "Invalid token", "Host unreachable").
- Add "Add workspace" button inside the same section (primary action for multi-workspace).

### Settings and Troubleshooting
- Clicking "Edit connection" opens existing Settings UI pre-filled for the selected workspace.
- "Test connection" runs health/status checks and shows success or error inline.
- For remote connect flows, surface failures in the sidebar hub and allow a direct jump to settings.

## Functional Requirements
1) **Single switch surface**
   - Remove workspace switcher component usage outside the sidebar.
   - Session sidebar is the canonical switcher.

2) **Clickable + expandable workspace rows**
   - Workspace rows switch on click.
   - Rows expand/collapse with a chevron and reveal actions.

3) **Connection state per workspace**
   - Track `idle | connecting | connected | error` and last error.
   - Display state in the sidebar list.

4) **Add workspace in sidebar**
   - Use existing create workspace flows (local or remote) from the sidebar action.

5) **Edit connection and test connection**
   - Provide "Edit connection" for any remote workspace.
   - Provide "Test connection" for any saved workspace.
   - Show error details and suggested next steps.

6) **Remote connect errors visible**
   - Remote connect failures are visible and persistent until resolved.

7) **Dev auto-connect**
   - Read env values on load and hydrate localStorage settings (only if empty).
   - Provide a root script to start `openwrk` + web UI in one command.

## Data and State Model
### Workspace state
- **Existing type**: `WorkspaceInfo` in `packages/app/src/app/lib/tauri.ts`
- **New state**: `connectionStatusById` and `connectionErrorById` stored in `workspace.ts`.

### Settings storage
- OpenWork server settings remain in localStorage keys:
  - `openwork.server.urlOverride`
  - `openwork.server.port`
  - `openwork.server.token`
- Saved server list remains in:
  - `openwork.server.list` and `openwork.server.active` (`packages/app/src/app/context/server.tsx`)

### Env auto-connect (dev)
- Read-only hydration from:
  - `VITE_OPENWORK_URL`
  - `VITE_OPENWORK_PORT`
  - `VITE_OPENWORK_TOKEN`

## Integration Points
### OpenWork Server API
- `GET /health` and `GET /status` for test connection and diagnostics.
- `GET /workspaces` to verify remote workspace list.
- `POST /workspaces/:id/activate` for workspace switching.

### OpenCode SDK
- Session list and switching remain as-is in `workspace.ts` via `@opencode-ai/sdk/v2`.

### CLI
- `openwrk start` remains the headless orchestrator for host mode.

## Developer Workflow
Add a root `package.json` script that starts headless + web with auto-connect and sensible defaults, so no extra setup is required for local runs:
- Script name: `dev:headless-web`
- Responsibilities:
  - Start the web dev server on a free port (uses `PORT` under Vite).
  - Start `openwrk` in the same command with a workspace default of `PWD`.
  - Auto-select a free OpenWork server port when `OPENWORK_PORT` is not set.
  - Inject web auto-connect envs by default (`VITE_OPENWORK_URL`, `VITE_OPENWORK_PORT`, `VITE_OPENWORK_TOKEN`).
  - Generate auth tokens when not provided.
- Example usage (no config needed for local):
  - `pnpm dev:headless-web`
- Optional overrides (when needed):
  - `OPENWORK_PORT=8787 OPENWORK_TOKEN=... OPENWORK_HOST_TOKEN=... pnpm dev:headless-web`

## Error Handling
- Standardize error parsing from `OpenworkServerError` and surface:
  - 401/403: "Invalid token or unauthorized."
  - 404: "Incorrect host/port."
  - Timeout: "Host unreachable."
  - Generic: "Unknown error. Check settings."
- Errors remain visible in the sidebar until a successful reconnect.

## Accessibility
- All workspace rows and actions have ARIA labels.
- Expand/collapse controls are keyboard accessible.
- Error states include text, not just color.

## Performance
- Workspace list rendering remains lightweight: memoize computed lists.
- Avoid blocking spinners; use inline loading indicators.

## Architecture Alignment
Mapping to OpenWork goals and architecture:
- **OpenWork as experience layer** (VISION.md): Sidebar hub is UI-only; engine APIs remain in OpenCode/OpenWork server.
- **Parity with OpenCode** (PRINCIPLES.md): Switching and session actions map directly to existing SDK methods.
- **CLI-first & sidecar** (INFRASTRUCTURE.md): `openwrk` remains the entry point for host mode; UI only wraps it.
- **Local-first & graceful degradation** (INFRASTRUCTURE.md): Error states are visible and users are guided to settings.
- **Mobile-first + premium UX** (AGENTS.md, PRODUCT.md): One compact hub reduces clutter and improves clarity.

## Implementation Map (Files to Touch)
- `packages/app/src/app/components/session/sidebar.tsx`
  - Add workspace list, expand/collapse UI, action buttons.
- `packages/app/src/app/context/workspace.ts`
  - Add connection status/error tracking and handlers for test/edit.
- `packages/app/src/app/components/workspace-picker.tsx`
  - Remove or deprecate usage (replace with sidebar hub).
- `packages/app/src/app/pages/settings.tsx`
  - Ensure settings can be opened for a specific workspace.
- `packages/app/src/app/context/server.tsx`
  - Preserve saved server list; ensure new flows write consistently.
- `packages/app/src/app/app.tsx`
  - Remove old switcher entry points; wire sidebar props.
- `packages/app/package.json` (root workspace `package.json`)
  - Add `dev:headless-web` script.

## Testing Plan
- Manual:
  - Use `pnpm dev:headless-web` and confirm logs are created in `./tmp/dev-web.log` and `./tmp/dev-headless.log`.
  - Add remote workspace, disconnect host, verify error appears in sidebar.
  - Test connection success/failure from sidebar.
  - Ensure session list updates on workspace switch.
- Automated (future):
  - Add a lightweight integration test for sidebar connection status rendering.

## Rollout & Migration
- Preserve existing localStorage keys and workspace list.
- Old switcher removed without breaking deep links (redirect to sidebar hub).

## Open Questions
- Should expanded rows display inline connection fields or open Settings?
- Should workspace rows group sessions under each workspace, or keep sessions only for active workspace?
- Should we allow removing local workspaces directly from the sidebar?

## References
- `packages/app/pr/openwrk-multi-workspace.md`
- `packages/app/pr/openwork-server.md`
- `packages/app/pr/multi-workspace-config.md`
