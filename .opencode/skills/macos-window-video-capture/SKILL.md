---
name: macos-window-video-capture
description: |
  Record true single-window macOS videos with ScreenCaptureKit for OpenWork flow evidence.

  Triggers when user mentions:
  - "record window video"
  - "video proof of flow"
  - "capture one window"
---

## Quick Usage (Already Configured)

### 1) Build the native recorder
```bash
bash .opencode/skills/macos-window-video-capture/scripts/build-window-recorder.sh
```

### 2) List capturable windows
```bash
bash .opencode/skills/macos-window-video-capture/scripts/list-windows.sh
```

Tip: use `rg -i "chrome|openwork"` to quickly find your target window.

### 3) Record one window by window id
```bash
bash .opencode/skills/macos-window-video-capture/scripts/record-window-video.sh <window-id>
```

Optional second argument sets the output file path:
```bash
bash .opencode/skills/macos-window-video-capture/scripts/record-window-video.sh <window-id> /tmp/openwork-artifacts/videos/openwork-flow.mp4
```

### 4) Pair with Chrome MCP verification

- Start recording.
- Run the UI flow in Chrome MCP.
- Stop automatically after configured duration.
- Attach video evidence to your PR or task notes.

## What This Skill Loads

- Native recorder source: `.opencode/skills/macos-window-video-capture/scripts/macos-window-recorder.swift`.
- Build script: `.opencode/skills/macos-window-video-capture/scripts/build-window-recorder.sh`.
- Convenience scripts for list/record commands.
- Optional defaults from `.opencode/skills/macos-window-video-capture/.env`.

## Common Gotchas

- macOS Screen Recording permission is required for the terminal app running the script.
- If you just granted Screen Recording permission, fully restart the terminal app before retrying.
- Window ids change when apps relaunch; re-run `list-windows.sh` each session.
- If a window is minimized or moved to a different space, captured frames may stall.
- Keep the target window at a stable size before recording.

## First-Time Setup (If Not Configured)

1. (Optional) Copy `.opencode/skills/macos-window-video-capture/.env.example` to `.opencode/skills/macos-window-video-capture/.env` and tune defaults.
2. Build the recorder with `build-window-recorder.sh`.
3. Run `list-windows.sh` and capture your window id.
4. Record with `record-window-video.sh`.
