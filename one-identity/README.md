# oneclaw

`oneclaw` creates and applies identity packs for AI systems.

Current provider workflows:
- AgentMail (API-first inbox creation)
- Telegram (BotFather token + `getMe` verification)
- Bitwarden (signup checkpoint + CLI login verification + vault item seeding)

Current targets:
- `owpenbot`
- `openclaw`
- `nanoclaw`

## Install

```bash
npm install
npm run build
```

## Default mode: bootstrap TUI

Running `oneclaw` with no command opens the OpenTUI bootstrap screen by default.

You can also invoke it explicitly:

```bash
oneclaw bootstrap --profile default --pack founder
```

Use `--no-tui` for plain prompt mode.
If OpenTUI runtime bindings are unavailable, oneclaw falls back to plain prompt mode automatically.

### Demo autopilot mode

Set `ONECLAW_DEMO=1` to run the full bootstrap flow in auto-fill mode.

```bash
ONECLAW_DEMO=1 oneclaw
```

In demo mode, oneclaw animates all fields as if typed, toggles bootstrap flags, and auto-saves into profile `demo` by default.

## First-class config API

```bash
printf '%s' "$AGENTMAIL_API_KEY" | oneclaw config set agentmail.api_key --profile default --secret --stdin
printf '%s' "$TELEGRAM_BOT_TOKEN" | oneclaw config set telegram.bot_token --profile default --secret --stdin
oneclaw config set bitwarden.email "founder@example.com" --profile default
printf '%s' "$BITWARDEN_PASSWORD" | oneclaw config set bitwarden.password --profile default --secret --stdin
oneclaw config set bitwarden.signup_done true --profile default

oneclaw config check --providers agentmail,telegram,bitwarden --profile default --verify --json
```

Other config commands:

```bash
oneclaw config get agentmail.api_key --profile default
oneclaw config list --profile default
oneclaw config unset telegram.bot_token --profile default
```

## Provision from config state

```bash
oneclaw provision \
  --pack founder \
  --providers agentmail,telegram,bitwarden \
  --targets owpenbot,openclaw,nanoclaw \
  --profile default \
  --non-interactive \
  --json
```

Flags override stored config values. If a provider still needs human action, oneclaw returns a blocked step with a resume command.

## Export / apply

```bash
oneclaw export --pack founder --target owpenbot --out ./owpenbot.identity.json
oneclaw export --pack founder --target openclaw --out ./openclaw.identity.json
oneclaw export --pack founder --target nanoclaw --out ./nanoclaw.identity.env

oneclaw apply --pack founder --target owpenbot --path ~/.openwork/owpenbot/owpenbot.json
```

## Helper prompt for another setup AI

```bash
oneclaw bootstrap-prompt
```

This prints the setup-helper prompt you can hand to another AI to collect credentials and persist config state correctly.

## Validate and doctor

```bash
oneclaw validate --pack founder
oneclaw doctor
```
