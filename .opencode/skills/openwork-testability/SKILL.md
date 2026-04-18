---
name: openwork-testability
description: |
  How to observe, test, and debug the running OpenWork dev stack with the tools that actually work for an AI driver: Chrome MCP for the web app, direct REST calls for the server, AppleScript + screencapture for the Tauri desktop window, and the on-disk dev-log sink that captures every browser event.

  Triggers when the user mentions:
  - "test the app"
  - "drive the app"
  - "observe the app"
  - "why does it hang"
  - "testability"
  - "dev debug"
  - "openwork-debug"
---

# OpenWork testability

Three surfaces you can actually drive reliably as an AI operator:

| Surface | Best tool | Use for |
| --- | --- | --- |
| React web app (Vite) | Chrome MCP at `http://localhost:5173` | UI flows, click/type, scriptable DOM, evaluate_script |
| openwork-server REST | `curl` + the live port | Health, workspaces, sessions, token sanity |
| Tauri desktop app (WKWebView) | `screencapture` + AppleScript targeted by PID | Verifying the actual desktop build visually |

The Tauri webview's DOM is **not** exposed to the macOS Accessibility API in dev builds — you cannot `click button "New task"` against the dev window. Screenshot and keystroke-by-PID is the right tool for that surface. Drive the _same React code_ via Chrome MCP when you need real scripting.

---

## 1. Start the dev stack

```bash
# From the openwork repo root. The env var enables the on-disk log sink.
mkdir -p ~/.openwork/debug
: > ~/.openwork/debug/openwork-dev.log

nohup env OPENWORK_DEV_LOG_FILE="$HOME/.openwork/debug/openwork-dev.log" \
  pnpm dev > /tmp/openwork-test/pnpm-dev.log 2>&1 &
echo $! > /tmp/openwork-test/pnpm-dev.pid
disown 2>/dev/null || true
```

The dev stack produces:
- Tauri app binary `apps/desktop/src-tauri/target/debug/OpenWork-Dev`
- `openwork-orchestrator daemon` (spawns `opencode serve`)
- `openwork-server` (proxies `/opencode/*` to the spawned `opencode serve`)
- `opencode-router`
- Vite on `http://localhost:5173`

Wait for the server to come up:

```bash
for i in $(seq 1 60); do
  PORT=$(ps -Ao command | grep "target/debug/openwork-server" | grep -v grep | grep -oE 'port [0-9]+' | head -1 | awk '{print $2}')
  [ -n "$PORT" ] && curl -sS --max-time 2 -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/health" | grep -q 200 && { echo "[t=${i}s] up on $PORT"; break; }
  sleep 1
done
```

Always read the port from `ps` — the Tauri boot picks a free one at launch and it will not be the same across restarts.

Get the current owner token:

```bash
python3 -c "import json; print(json.load(open('/Users/benjaminshafii/Library/Application Support/com.differentai.openwork.dev/openwork-server-tokens.json'))['workspaces'][''].get('owner_token',''))"
```

---

## 2. `scripts/openwork-debug.sh` (ships in the repo)

```bash
./scripts/openwork-debug.sh snapshot        # processes + ports + health + orphans + sink preview
./scripts/openwork-debug.sh tail            # tail pnpm-dev + dev-log sink together
./scripts/openwork-debug.sh sink            # print sink path
./scripts/openwork-debug.sh kill-orphans    # kill openwork/opencode processes whose parent is launchd
```

Always run `kill-orphans` when the stack feels weird — repeated HMR cycles in Tauri leak orchestrator/opencode children whose parent becomes PID 1 and keep binding ports.

---

## 3. Dev log sink (the main debugging win)

When started with `OPENWORK_DEV_LOG_FILE=<path>`, openwork-server exposes:

```
POST /dev/log    # body = JSON (single object or array), appended to the file
GET  /dev/log    # returns the current sink path
```

The React app's `debug-logger` (mounted in `AppProviders`) pushes to this endpoint automatically:
- every `console.log/info/warn/error/debug` call
- every `window.onerror` + `unhandledrejection`
- every `fetch` (URL, method, status, duration) — excluding the sink call itself
- a 1s heartbeat tagged as `hang` when the main thread stalls 3–10s (real hang) or `meta` when >10s (webview throttled / backgrounded, NOT a real hang)
- `visibilitychange` events; on return to `visible` it auto-dispatches `openwork-server-settings-changed` so routes refresh

Quick triage queries on the sink file:

```bash
# Counts by level
jq -r '.level' ~/.openwork/debug/openwork-dev.log | sort | uniq -c | sort -rn

# Only the things that matter
grep -E '"level":"(error|warn|uncaught|unhandledRejection|hang)"' ~/.openwork/debug/openwork-dev.log | tail

# Recent fetches (drop the IPC noise)
grep '"level":"fetch"' ~/.openwork/debug/openwork-dev.log | grep -v 'ipc://' | tail -20

# Find real main-thread stalls
jq 'select(.level=="hang")' ~/.openwork/debug/openwork-dev.log
```

`meta` entries named `Webview resumed after Xs` are **not bugs** — they're macOS App Nap / background throttling and the app auto-recovers on visibility change. Only `hang` entries indicate a real JS-thread stall.

---

## 4. Drive the React app via Chrome MCP

Chrome MCP runs the same React code as the Tauri window (both point at Vite :5173) but gives you a scriptable DOM.

```
chrome-devtools_new_page url=http://localhost:5173/session
```

Then in an `evaluate_script` call, wire the server URL + token so the session route connects:

```js
() => {
  localStorage.setItem("openwork.server.urlOverride", "http://127.0.0.1:<PORT>");
  localStorage.setItem("openwork.server.token", "<OWNER_TOKEN>");
  return { url: localStorage.getItem("openwork.server.urlOverride") };
}
```

Reload, then wait for something in the UI:

```
chrome-devtools_navigate_page type=reload ignoreCache=true
chrome-devtools_wait_for text=["Add workspace","Describe your task"]
```

Click + type using snapshot uids (not CSS selectors — the sidebar buttons have empty text nodes; their accessible names come from aria-label):

```
chrome-devtools_take_snapshot
chrome-devtools_click uid=<snapshot_uid>
chrome-devtools_type_text text="hello"
```

If Chrome MCP wedges after a large snapshot or a long-running stream, kill the stuck renderer and reconnect:

```bash
pgrep -f "chrome-devtools-mcp/chrome-profile.*type=renderer" | xargs -I {} kill -9 {}
```

---

## 5. The in-page inspector

The app publishes `window.__openwork`. Call it from Chrome MCP `evaluate_script`:

```js
window.__openwork.snapshot()                 // full state dump
window.__openwork.listSlices()               // ["composer","debug","route"]
window.__openwork.slice("route")             // workspaces, selected ids, connection, sessionsByWorkspaceId
window.__openwork.slice("composer")          // draft, attachments, mentions, pasteParts, sending, error
window.__openwork.slice("debug")             // memory, pendingFetchCount, pendingFetches, queueSize
window.__openwork.events(50)                 // last 50 lifecycle events (session.mounted, route.refresh.complete, log.*)
window.__openwork.clearEvents()
```

This is how you confirm state changed after a click, without walking the DOM.

---

## 6. Drive the Tauri desktop app

The dev and prod bundles both contain a binary literally named `OpenWork-Dev`, so `tell process "OpenWork-Dev"` is ambiguous. **Always target by PID**:

```bash
DEV_PID=$(pgrep -f "target/debug/OpenWork-Dev")

# Bring the dev window to the front
osascript -e "tell application \"System Events\" to tell (first process whose unix id is $DEV_PID) to set frontmost to true"

# Force a webview reload (Cmd+Shift+R)
osascript -e 'tell application "System Events" to keystroke "r" using {command down, shift down}'

# Screenshot the whole display (requires Screen Recording permission on the terminal host)
screencapture -x /tmp/ow-shot.png
```

Accessibility requirements the user must grant once (System Settings → Privacy & Security):
- **Accessibility**: Ghostty (or whichever terminal runs the shell) + OpenCode binary
- **Screen Recording**: same hosts
- **Automation**: same hosts → System Events

Keyboard automation works against the dev window; DOM-level scripting does not.

---

## 7. Rebuild the server binary after editing `apps/server/src`

The desktop app spawns the **compiled** `openwork-server`, not the TS source.

```bash
pnpm --filter openwork-server build:bin
cp apps/server/dist/bin/openwork-server apps/desktop/src-tauri/target/debug/openwork-server

# Restart the stack so the new binary is live
kill $(cat /tmp/openwork-test/pnpm-dev.pid) 2>/dev/null
pkill -f "target/debug/OpenWork-Dev"
# then re-run step 1
```

---

## 8. Reproducing the connection/switch/hang failures

Test patterns that paid off in diagnosis:

### "Workspaces never connect"
```bash
./scripts/openwork-debug.sh snapshot
# Check: is openwork-server actually running? Is it attached to an opencode port via --opencode-base-url?
# If it's running without --opencode-base-url, engineStart never completed — look at the pnpm-dev.log.
```

Also verify the desktop's cached URL isn't pointing at a dead port:
```bash
# In the Tauri WKWebView LocalStorage (the stale urlOverride was a real bug)
# From Chrome MCP we can only read Vite's localStorage; for the Tauri profile:
grep -oE 'openwork\.server\.(urlOverride|port|token)' ~/Library/WebKit/OpenWork-Dev/**/localstorage.sqlite3 2>/dev/null
```

### "Can't switch workspaces / UI freezes"
```bash
# Watch the log in one window
./scripts/openwork-debug.sh tail
# In another, click through workspaces rapidly via Chrome MCP.
# Look for:
#   - repeated route.refresh.complete bursts (refresh storm)
#   - long-duration fetches (>3s) to /opencode/session or /opencode/event
#   - unhandledRejection / uncaught entries
#   - hang entries (real, durationMs < 10s)
```

### "App becomes inactive after a while"
```bash
jq 'select(.level=="hang" or (.level=="meta" and (.message // "") | test("resume")))' ~/.openwork/debug/openwork-dev.log | tail
```
If the only stall entries are "meta / resume", that's macOS WKWebView throttling the backgrounded window — the app now auto-recovers via `visibilitychange`. Real bugs show up as `hang` entries.

### "Content-encoding / decoding failed"
If a `fetch` entry shows `status=200` but Chrome console says `ERR_CONTENT_DECODING_FAILED`, the openwork-server proxy is forwarding a stale `Content-Encoding: gzip` header for a body Bun already decoded. That's the `sanitizeProxyResponse` fix; if it recurs, check that the compiled server binary is newer than `apps/server/src/server.ts`.

---

## 9. What to always capture in a bug report

1. `./scripts/openwork-debug.sh snapshot` output.
2. Tail of `~/.openwork/debug/openwork-dev.log` filtered to non-fetch levels.
3. `window.__openwork.snapshot()` at the moment of the bug.
4. A screenshot (`screencapture -x /tmp/bug.png`) of the UI state.
5. Commit SHA of `_repos/openwork` — `git -C _repos/openwork log -1 --oneline`.

---

## 10. Docker Compose + Chrome MCP (alternate, heavier)

Prefer this when you need a clean sandboxed stack (e.g. to test what a brand-new machine would see):

```bash
docker compose -f packaging/docker/docker-compose.dev.yml up -d
# open http://localhost:5173 in Chrome MCP — wires to localhost:8787 automatically
docker compose -f packaging/docker/docker-compose.dev.yml logs headless
docker compose -f packaging/docker/docker-compose.dev.yml down
```

Docker is slower on first run (~2 min) but produces a known-good state every time. For day-to-day iteration, use `pnpm dev` + the log sink above.

---

## Related skills

- `.opencode/skills/openwork-chrome-mcp-testing/SKILL.md` — Chrome MCP usage deep-dive.
- `.opencode/skills/openwork-docker-chrome-mcp/SKILL.md` — Docker-specific driving.

## Notes

- The **feature is not done until a UI message is sent successfully** in either Chrome MCP (`localhost:5173`) or the Tauri dev window.
- Use `window.__openwork.clearEvents()` at the start of every test run to get a clean event timeline.
- The dev-log sink does not run unless `OPENWORK_DEV_LOG_FILE` is set when pnpm dev starts.
- If you touch `apps/server/src/**`, always run `pnpm --filter openwork-server build:bin` and copy the binary into `apps/desktop/src-tauri/target/debug/` before restarting.
