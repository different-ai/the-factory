---
name: screenpipe-mcp
description: Search your screen recordings, audio transcriptions, and control your computer with AI via Screenpipe MCP.
---

## Quick Usage (Already Configured)

### Search your screen history
Ask Claude to search what you've been doing:
- "What did I do in the last 5 minutes?"
- "Search my screen for meetings today"
- "What was that API key I copied yesterday?"
- "Find all mentions of 'invoice' from this morning"

### Export video clips
```bash
# Via MCP tool - Claude can export video for any time range
# Example: "Export a video of my last standup meeting"
```

### Computer control (macOS)
Claude can interact with your desktop:
- Click UI elements by description
- Type text into fields
- Open applications
- Navigate between windows

## Common Gotchas

- Screenpipe must be running locally on port 3030 for the MCP to work.
- Audio transcription requires microphone permissions.
- Screen capture requires screen recording permissions (macOS: System Preferences → Privacy & Security → Screen Recording).
- Computer control features only work on macOS via accessibility APIs.

## First-Time Setup (If Not Configured)

### 1. Install Screenpipe

**macOS (Homebrew):**
```bash
brew install screenpipe
```

**Or download from:** https://screenpi.pe/onboarding

### 2. Start Screenpipe
```bash
screenpipe
```
Or launch the Screenpipe desktop app.

### 3. Install the MCP extension

**Option A: Via Screenpipe Settings**
1. Open Screenpipe → Settings → Connections
2. Click "Install Extension" for Claude Desktop

**Option B: Via npx**
Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "screenpipe": {
      "command": "npx",
      "args": ["-y", "screenpipe-mcp"]
    }
  }
}
```

### 4. Verify connection
Restart Claude Desktop and ask: "What can you see on my screen?"

## Available MCP Tools

| Tool | Description |
|------|-------------|
| `search-content` | Search screen text, audio transcriptions, UI elements |
| `export-video` | Export screen recordings as MP4 |
| `pixel-control` | Mouse/keyboard control |
| `find-elements` | Find UI elements by role (macOS) |
| `click-element` | Click UI elements (macOS) |
| `fill-element` | Type into form fields (macOS) |
| `open-application` | Launch apps (macOS) |
| `open-url` | Open URLs in browser (macOS) |

## Resources

- [Screenpipe GitHub](https://github.com/mediar-ai/screenpipe)
- [MCP Server Docs](https://github.com/mediar-ai/screenpipe/tree/main/screenpipe-integrations/screenpipe-mcp)
- [Screenpipe Documentation](https://docs.screenpi.pe)
