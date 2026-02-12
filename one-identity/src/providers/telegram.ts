import type { ProviderWorkflow, WorkflowStepContext } from "../core/workflow.js";

type TelegramGetMeResponse = {
  ok: boolean;
  result?: {
    id?: number;
    username?: string;
  };
};

function normalizeIdentityId(raw: string | undefined): string {
  const safe = (raw || "default").replace(/[^a-zA-Z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "");
  return safe || "default";
}

async function resolveToken(ctx: WorkflowStepContext): Promise<string | undefined> {
  const explicit = ctx.getOption("telegramBotToken") || process.env.TELEGRAM_BOT_TOKEN;
  if (explicit) return explicit;
  const fromPack = ctx.pack.accounts.telegram?.provider === "telegram"
    ? ctx.resolveSecret(ctx.pack.accounts.telegram.tokenRef)
    : undefined;
  if (fromPack) return fromPack;
  if (ctx.nonInteractive) return undefined;
  return ctx.ask("Telegram bot token: ");
}

async function getMe(token: string): Promise<TelegramGetMeResponse> {
  const baseUrl = process.env.TELEGRAM_API_BASE_URL?.trim() || "https://api.telegram.org";
  const normalized = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const res = await fetch(`${normalized}/bot${encodeURIComponent(token)}/getMe`);
  return (await res.json()) as TelegramGetMeResponse;
}

export function buildTelegramWorkflow(): ProviderWorkflow {
  return {
    provider: "telegram",
    steps: [
      {
        id: "telegram-create-bot",
        kind: "browser_task",
        detail: "Create Telegram bot with BotFather or provide token",
        run: async (ctx) => {
          const token = await resolveToken(ctx);
          if (!token) {
            return {
              status: "blocked",
              detail:
                "Telegram bot token missing. Create bot with @BotFather, then run oneclaw config set telegram.bot_token --stdin --secret or pass --telegram-bot-token.",
            };
          }
          ctx.setData("telegramBotToken", token);
          return { status: "completed", detail: "Telegram bot token available" };
        },
      },
      {
        id: "telegram-verify-token",
        kind: "verify",
        detail: "Verify Telegram bot token via getMe",
        run: async (ctx) => {
          const token = ctx.getData("telegramBotToken");
          if (!token) return { status: "blocked", detail: "Telegram token missing in state." };
          const response = await getMe(token);
          if (!response.ok || !response.result?.username) {
            return {
              status: "blocked",
              detail: "Telegram token verification failed. Ensure token is valid and bot exists.",
            };
          }
          ctx.setData("telegramBotUsername", response.result.username);
          return { status: "completed", detail: `Verified @${response.result.username}` };
        },
      },
      {
        id: "telegram-persist-pack",
        kind: "persist_secret",
        detail: "Persist Telegram bot in identity pack",
        run: async (ctx) => {
          const token = ctx.getData("telegramBotToken");
          const verifiedUsername = ctx.getData("telegramBotUsername");
          const manualUsername = ctx.getOption("telegramBotUsername");
          const username = manualUsername || verifiedUsername;
          if (!token || !username) {
            return {
              status: "blocked",
              detail: "Missing Telegram token or username during persist step.",
            };
          }

          const identityId = normalizeIdentityId(ctx.getOption("telegramIdentityId") || username);
          const tokenRef = ctx.putSecret("telegram", "bot_token", token);
          ctx.pack.accounts.telegram = {
            provider: "telegram",
            identityId,
            botUsername: username,
            tokenRef,
          };
          ctx.pack.updatedAt = new Date().toISOString();
          return { status: "completed", detail: `Telegram bot @${username} saved` };
        },
      },
    ],
  };
}
