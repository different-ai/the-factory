# agentmint

`agentmint` creates and applies identity packs for AI systems.

Current provider workflows:
- AgentMail (API-first inbox creation)
- Telegram (BotFather token + `getMe` verification)
- Bitwarden (signup checkpoint + CLI login verification + vault item seeding)

Current targets:
- `openwork` ([different-ai/openwork](https://github.com/different-ai/openwork))
- `openclaw`
- `nanoclaw`

## Install

```bash
npm install
npm run build
```

## Default mode: bootstrap TUI

Running `agentmint` with no command opens the OpenTUI bootstrap screen by default.

You can also invoke it explicitly:

```bash
agentmint bootstrap --profile default --pack founder
```

Use `--no-tui` for plain prompt mode.
If OpenTUI runtime bindings are unavailable, agentmint falls back to plain prompt mode automatically.
If you see `.scm` runtime extension errors, run agentmint with Bun (`bunx agentmint`) or use `--no-tui`.

## Future flow demo

```bash
agentmint identity
agentmint identity --target openwork
```

This previews a guided sequence:
- creating Telegram bot
- linking Gmail
- adding Bitwarden account
- final install choice between OpenClaw and OpenWork

Bootstrap TUI hotkeys:
- `Step 1`: use `[Up]/[Down]` to select field, `[Enter]` to edit, `[Esc]` to stop editing
- Target buttons: go to step 2, use `[Left]/[Right]` to focus and `[Enter]` to press
- `[I]` press install button from anywhere (runs provision after save)
- `[S]` save without install
- `[N]` / `[B]` move next/back between steps

### Demo autopilot mode

Set `ONECLAW_DEMO=1` to run the full bootstrap flow in auto-fill mode.

```bash
ONECLAW_DEMO=1 agentmint
```

In demo mode, agentmint animates all fields as if typed, moves through stepper screens, presses install target buttons, presses install (`I`), and auto-saves into profile `demo` by default.

To slow demo animation further:

```bash
ONECLAW_DEMO=1 ONECLAW_DEMO_SPEED=2.5 agentmint
```

`ONECLAW_DEMO_SPEED` defaults to `3.4` (larger value = slower pacing).

## First-class config API

```bash
printf '%s' "$AGENTMAIL_API_KEY" | agentmint config set agentmail.api_key --profile default --secret --stdin
printf '%s' "$TELEGRAM_BOT_TOKEN" | agentmint config set telegram.bot_token --profile default --secret --stdin
agentmint config set bitwarden.email "founder@example.com" --profile default
printf '%s' "$BITWARDEN_PASSWORD" | agentmint config set bitwarden.password --profile default --secret --stdin
agentmint config set bitwarden.signup_done true --profile default

agentmint config check --providers agentmail,telegram,bitwarden --profile default --verify --json
```

Other config commands:

```bash
agentmint config get agentmail.api_key --profile default
agentmint config list --profile default
agentmint config unset telegram.bot_token --profile default
```

## Provision from config state

```bash
agentmint provision \
  --pack founder \
  --providers agentmail,telegram,bitwarden \
  --targets openwork,openclaw,nanoclaw \
  --profile default \
  --non-interactive \
  --json
```

Flags override stored config values. If a provider still needs human action, agentmint returns a blocked step with a resume command.

## Export / apply

```bash
agentmint export --pack founder --target openwork --out ./openwork.identity.json
agentmint export --pack founder --target openclaw --out ./openclaw.identity.json
agentmint export --pack founder --target nanoclaw --out ./nanoclaw.identity.env

agentmint apply --pack founder --target openwork --path ~/.openwork/openwork/openwork.json
```

## Helper prompt for another setup AI

```bash
agentmint bootstrap-prompt
agentmint boostrap-prompt
```

This prints the setup-helper prompt you can hand to another AI to collect credentials and persist config state correctly.

## Validate and doctor

```bash
agentmint validate --pack founder
agentmint doctor
```
