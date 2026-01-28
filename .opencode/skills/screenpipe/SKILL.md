---
name: screenpipe
description: Search your screen recordings and audio transcriptions via REST API and CLI.
---

## Quick Usage

### Search via API

```bash
# Search for text in screen recordings
curl "http://localhost:3030/search?q=meeting&limit=10"

# Search audio transcriptions only
curl "http://localhost:3030/search?q=budget&content_type=audio"

# Search with time range (ISO 8601)
curl "http://localhost:3030/search?q=invoice&start_time=2024-01-28T09:00:00Z&end_time=2024-01-28T17:00:00Z"

# Filter by app
curl "http://localhost:3030/search?q=code&app_name=Visual%20Studio%20Code"

# Get recent activity (no query = all content)
curl "http://localhost:3030/search?limit=50"
```

### Search via CLI

```bash
# Basic search
screenpipe search "meeting notes"

# Search with filters
screenpipe search "api key" --app Chrome --limit 20

# Search audio only
screenpipe search "what did they say" --type audio

# Search last hour
screenpipe search "error" --from "1 hour ago"
```

### API Response Format

```json
{
  "data": [
    {
      "type": "OCR",
      "content": {
        "text": "Meeting at 3pm with Sarah",
        "timestamp": "2024-01-28T14:32:00Z",
        "app_name": "Google Chrome",
        "window_name": "Calendar - Google Chrome"
      }
    },
    {
      "type": "Audio",
      "content": {
        "transcription": "Let's discuss the Q1 budget",
        "timestamp": "2024-01-28T15:00:00Z",
        "device_name": "MacBook Pro Microphone"
      }
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 142
  }
}
```

## API Reference

### GET /search

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Search query (optional - omit for all content) |
| `content_type` | string | `ocr`, `audio`, `ui`, or `all` (default: `all`) |
| `limit` | int | Max results (default: 10, max: 100) |
| `offset` | int | Pagination offset |
| `start_time` | string | ISO 8601 UTC timestamp |
| `end_time` | string | ISO 8601 UTC timestamp |
| `app_name` | string | Filter by application |
| `window_name` | string | Filter by window title |
| `min_length` | int | Minimum content length |
| `max_length` | int | Maximum content length |

### GET /health

Check if Screenpipe is running:
```bash
curl http://localhost:3030/health
```

### Other Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /audio/list` | List audio devices |
| `GET /tags` | List all tags |
| `POST /tags/:id` | Add tag to content |
| `DELETE /tags/:id/:tag` | Remove tag |
| `GET /pipes/list` | List installed pipes |
| `POST /pipes/enable` | Enable a pipe |
| `POST /pipes/disable` | Disable a pipe |

## CLI Reference

```bash
# Start screenpipe daemon
screenpipe

# Start with specific settings
screenpipe --fps 1 --audio-chunk-duration 30

# Disable audio
screenpipe --disable-audio

# Use specific audio device
screenpipe --audio-device "MacBook Pro Microphone"

# Enable cloud sync
screenpipe --enable-cloud-sync
```

## Common Gotchas

- Screenpipe must be running locally on port 3030.
- Audio transcription requires microphone permissions.
- Screen capture requires screen recording permissions (macOS: System Preferences → Privacy & Security → Screen Recording).
- Search results are paginated - use `offset` for more results.

## First-Time Setup

### 1. Install Screenpipe

**Download the app:** https://screenpi.pe/onboarding

**Or build from source:**
```bash
git clone https://github.com/mediar-ai/screenpipe
cd screenpipe
cargo build --release
```

### 2. Start Screenpipe
```bash
screenpipe
```
Or launch the desktop app.

### 3. Verify it's running
```bash
curl http://localhost:3030/health
```

## Resources

- [Screenpipe GitHub](https://github.com/mediar-ai/screenpipe)
- [API Documentation](https://docs.screenpi.pe)
- [CLI Reference](https://docs.screenpi.pe/cli-reference)
