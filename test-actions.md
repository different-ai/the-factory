# OpenWork UI Test Actions

Catalog of user-facing actions that can be exercised against a running Docker dev stack (`packaging/docker/dev-up.sh`).

## 1. Create New Session

**Entry point:** Sidebar "New task" button (+ icon next to workspace name)

**Steps:**
1. Open the web UI (e.g. `http://localhost:<WEB_PORT>`).
2. Click the **New task** button in the left sidebar.

**Expected result:**
- A new session appears in the sidebar list.
- The main area navigates to the new session URL (`/session/ses_...`).
- Status bar shows **Session Ready** (green dot).
- The "What do you want to do?" prompt and starter cards are displayed.

## 2. Add Workspace (Connect Custom Remote)

**Entry point:** Sidebar "Add workspace" button (bottom of sidebar)

**Steps:**
1. Click **+ Add workspace** at the bottom of the sidebar.
2. The "Create Workspace" modal appears with three options:
   - Local workspace (desktop only, disabled in web)
   - Connect custom remote
   - Shared workspaces
3. Click **Connect custom remote**.
4. Fill in the form:
   - **Worker URL** — the OpenWork server URL (e.g. `http://localhost:<OPENWORK_PORT>`)
   - **Access token** — the `OPENWORK_TOKEN` from the dev stack
   - **Display name** — optional label (e.g. "Docker Dev")
5. Click **Connect remote**.

**Expected result:**
- The modal closes.
- The new workspace appears in the sidebar with the display name and a blue dot.
- The main area switches to the new workspace's "New session" view.
- Header shows the workspace name (e.g. "New session  Docker Dev").

**Note:** To properly validate this action, launch a *second* dev stack (`packaging/docker/dev-up.sh` again — it picks random ports) and connect to that server. Connecting to the same server the web UI is already wired to is redundant and does not test the remote-connect path meaningfully.

**Multi-server setup:**
```bash
# Stack 1 (already running the web UI)
packaging/docker/dev-up.sh   # → e.g. server :54177, web :54178

# Stack 2 (independent server)
packaging/docker/dev-up.sh   # → e.g. server :62849, web :62850
```
Use Stack 2's `OPENWORK_PORT` and `OPENWORK_TOKEN` (from `tmp/.dev-env-<id>`) when filling the "Connect custom remote" form in Stack 1's web UI.

## 3. Rename Session

**Entry point:** Session context menu ("..." button) in the sidebar

**Steps:**
1. Hover over a session in the sidebar to reveal the **"..."** (Session actions) button.
2. Click **"..."** to open the context menu.
3. Click **Rename session**.
4. A "Rename session" modal appears with a text input pre-filled with the current name.
5. Clear the field and type the new name (e.g. "Hostname Check").
6. Click **Save**.

**Expected result:**
- The modal closes.
- The session name updates in both the sidebar and the main area header.
- The session URL does not change (rename is cosmetic).
