---
name: telegram
description: Send notifications and messages via Telegram bot API
---

## Environment Setup

**IMPORTANT**: Before using any Telegram commands, source the local `.env` file:
```bash
source .skill.config
```

Credentials are stored in `.skill.config` (gitignored):
```
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...  # Default chat (legacy, still works)
```

---

## Multi-Chat Configuration

Chat aliases are stored in `telegram-chats.json` (gitignored):

```json
{
  "chats": {
    "default": { "id": "123456789", "name": "Personal", "description": "Default notifications" },
    "alerts": { "id": "-100987654321", "name": "Alerts", "description": "Critical alerts" },
    "house": { "id": "-4972420459", "name": "House Common", "description": "House group" }
  }
}
```

### Get chat ID by alias
```bash
jq -r '.chats.house.id' .opencode/skill/telegram/telegram-chats.json
```

### List all configured chats
```bash
jq -r '.chats | to_entries[] | "\(.key): \(.value.name) (\(.value.id))"' .opencode/skill/telegram/telegram-chats.json
```

---

## Quick Usage

### Send to default chat
```bash
source .skill.config && curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
  -d "chat_id=$TELEGRAM_CHAT_ID" \
  -d "text=Hello from OpenCode!"
```

### Send to named chat (using jq)
```bash
source .skill.config && CHAT_ID=$(jq -r '.chats.house.id' .opencode/skill/telegram/telegram-chats.json) && \
curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
  -d "chat_id=$CHAT_ID" \
  -d "text=Hello House!"
```

### Send to multiple chats
```bash
source .skill.config && for chat in default house; do
  CHAT_ID=$(jq -r ".chats.$chat.id" .opencode/skill/telegram/telegram-chats.json)
  curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
    -d "chat_id=$CHAT_ID" \
    -d "text=Broadcast message!" &
done
wait
```

### Send with Markdown formatting
```bash
source .skill.config && curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
  -d "chat_id=$TELEGRAM_CHAT_ID" \
  -d "parse_mode=Markdown" \
  -d "text=*Bold* and _italic_ and \`code\`"
```

### Send with HTML formatting
```bash
source .skill.config && curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
  -d "chat_id=$TELEGRAM_CHAT_ID" \
  -d "parse_mode=HTML" \
  -d "text=<b>Bold</b> and <i>italic</i> and <code>code</code>"
```

### Send with links
```bash
source .skill.config && curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
  -d "chat_id=$TELEGRAM_CHAT_ID" \
  -d "parse_mode=Markdown" \
  -d "text=Check out [this deal](https://facebook.com/marketplace/item/123)"
```

### Send multi-line message
```bash
source .skill.config && curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
  -d "chat_id=$TELEGRAM_CHAT_ID" \
  -d "parse_mode=Markdown" \
  --data-urlencode "text=*New Deals Found*

1. \$50 - Vintage Poster [View](link1)
2. \$30 - Movie Poster [View](link2)"
```

---

## Verify Setup

### Check bot is working
```bash
source .skill.config && curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe" | jq
```

### Check credentials are set
```bash
source .skill.config && echo "Token: ${TELEGRAM_BOT_TOKEN:0:10}... Chat: $TELEGRAM_CHAT_ID"
```

### List all chats from config
```bash
jq '.chats' .opencode/skill/telegram/telegram-chats.json
```

---

## Common Gotchas

- **Markdown escaping**: Use `\` before `_`, `*`, `` ` ``, `[` if they're literal
- **URL encoding**: Use `--data-urlencode` for messages with special chars
- **Chat ID**: Must be a number (personal) or starts with `-` (group/channel)
- **Bot must be added to group**: For group chats, add bot as member first
- **Group chat IDs are negative**: They typically start with `-100` for supergroups

---

## First-Time Setup (If Not Configured)

### 1. Create a bot
1. Open Telegram and message @BotFather
2. Send `/newbot`
3. Choose a name (e.g., "My OpenCode Bot")
4. Choose a username (must end in `bot`, e.g., "myopencode_bot")
5. Copy the token BotFather gives you

### 2. Get your chat ID
1. Message your new bot (just say "hi")
2. Run:
```bash
curl -s "https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates" | jq '.result[0].message.chat.id'
```

### 3. Get group chat IDs
1. Add the bot to each group
2. Send a message in the group
3. Run:
```bash
curl -s "https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates" | jq '.result[] | select(.message.chat.type != "private") | {title: .message.chat.title, id: .message.chat.id}'
```

### 4. Store bot token in .skill.config
Add to `.skill.config`:
```bash
TELEGRAM_BOT_TOKEN=your_token_here
TELEGRAM_CHAT_ID=your_default_chat_id_here
```

### 5. Initialize multi-chat config
```bash
cp .opencode/skill/telegram/telegram-chats.example.json .opencode/skill/telegram/telegram-chats.json
```

Then edit `telegram-chats.json` to add your chats:
```json
{
  "chats": {
    "default": {
      "id": "YOUR_PERSONAL_CHAT_ID",
      "name": "Personal",
      "description": "My personal notifications"
    },
    "alerts": {
      "id": "GROUP_CHAT_ID",
      "name": "Alerts Group",
      "description": "System alerts"
    }
  }
}
```

### 6. Test it
```bash
# Test default
source .skill.config && curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
  -d "chat_id=$TELEGRAM_CHAT_ID" \
  -d "text=OpenCode connected!"

# Test named chat
source .skill.config && CHAT_ID=$(jq -r '.chats.house.id' .opencode/skill/telegram/telegram-chats.json) && \
curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
  -d "chat_id=$CHAT_ID" \
  -d "text=House chat connected!"
```

---

## Adding New Chats

### Via getUpdates (recommended)
1. Add bot to the new group or message it privately
2. Send a message in that chat
3. Run:
```bash
source .skill.config && curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getUpdates" | jq '.result[-1].message.chat'
```
4. Add the chat to `telegram-chats.json`

### Discover all recent chats
```bash
source .skill.config && curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getUpdates" | \
  jq '[.result[].message.chat] | unique_by(.id) | .[] | {id, title: (.title // .first_name), type}'
```

---

## Helper: Send Function

For complex scripts, define a helper:
```bash
telegram_send() {
  local chat_alias="${1:-default}"
  local message="$2"
  local parse_mode="${3:-Markdown}"
  
  source .skill.config
  local chat_id=$(jq -r ".chats.$chat_alias.id" .opencode/skill/telegram/telegram-chats.json)
  
  curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
    -d "chat_id=$chat_id" \
    -d "parse_mode=$parse_mode" \
    --data-urlencode "text=$message"
}

# Usage:
telegram_send "house" "Hello from the house chat!"
telegram_send "bargains" "*New deal found!*" "Markdown"
```
