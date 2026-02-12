import type { ProviderWorkflow, WorkflowStepContext } from "../core/workflow.js";

type AgentmailInbox = {
  inbox_id?: string;
  inboxId?: string;
  display_name?: string;
};

function normalizeInboxId(payload: AgentmailInbox): string | undefined {
  return payload.inbox_id || payload.inboxId;
}

function readOption(ctx: WorkflowStepContext, key: string): string | undefined {
  return ctx.getOption(key);
}

async function requestAgentmail(
  apiKey: string,
  method: "GET" | "POST",
  route: string,
  body?: Record<string, unknown>,
): Promise<unknown> {
  const baseUrl = process.env.AGENTMAIL_API_BASE_URL?.trim() || "https://api.agentmail.to/v0";
  const normalized = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const response = await fetch(`${normalized}${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  const parsed = text ? JSON.parse(text) : undefined;
  if (!response.ok) {
    throw new Error(`AgentMail ${method} ${route} failed (${response.status}): ${text.slice(0, 500)}`);
  }
  return parsed;
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

async function resolveApiKey(ctx: WorkflowStepContext): Promise<string | undefined> {
  const explicit = readOption(ctx, "agentmailApiKey") || process.env.AGENTMAIL_API_KEY;
  if (explicit) return explicit;

  const fromPack = ctx.pack.accounts.email?.provider === "agentmail"
    ? ctx.resolveSecret(ctx.pack.accounts.email.apiKeyRef)
    : undefined;
  if (fromPack) return fromPack;

  if (ctx.nonInteractive) return undefined;
  return ctx.ask("AgentMail API key: ");
}

export function buildAgentmailWorkflow(): ProviderWorkflow {
  return {
    provider: "agentmail",
    steps: [
      {
        id: "agentmail-credentials",
        kind: "manual_checkpoint",
        detail: "Resolve AgentMail API key",
        run: async (ctx) => {
          const apiKey = await resolveApiKey(ctx);
          if (!apiKey) {
            return {
              status: "blocked",
              detail:
                "Missing AgentMail API key. Run agentmint config set agentmail.api_key --stdin --secret, or pass --agentmail-api-key.",
            };
          }
          ctx.setData("apiKey", apiKey);
          return { status: "completed", detail: "AgentMail API key ready" };
        },
      },
      {
        id: "agentmail-create-inbox",
        kind: "api_call",
        detail: "Create or reuse AgentMail inbox",
        run: async (ctx) => {
          const apiKey = ctx.getData("apiKey");
          if (!apiKey) {
            return { status: "blocked", detail: "Missing AgentMail API key in workflow state." };
          }

          if (ctx.pack.accounts.email?.provider === "agentmail" && !ctx.getFlag("forceAgentmailCreate")) {
            ctx.setData("inboxId", ctx.pack.accounts.email.inboxId);
            ctx.setData("address", ctx.pack.accounts.email.address);
            return { status: "completed", detail: `Reusing inbox ${ctx.pack.accounts.email.inboxId}` };
          }

          const explicitInboxId = readOption(ctx, "agentmailInboxId");
          if (explicitInboxId) {
            ctx.setData("inboxId", explicitInboxId);
            ctx.setData("address", explicitInboxId);
            return { status: "completed", detail: `Using provided inbox ${explicitInboxId}` };
          }

          const username = readOption(ctx, "agentmailUsername") || `${ctx.pack.packId}-${randomSuffix()}`;
          const domain = readOption(ctx, "agentmailDomain");
          const displayName = readOption(ctx, "agentmailDisplayName") || `${ctx.pack.packId} agent`;
          const payload = {
            username,
            ...(domain ? { domain } : {}),
            display_name: displayName,
            client_id: `${ctx.pack.packId}-${Date.now()}`,
          };

          const created = (await requestAgentmail(apiKey, "POST", "/inboxes", payload)) as AgentmailInbox;
          const inboxId = normalizeInboxId(created);
          if (!inboxId) {
            return {
              status: "blocked",
              detail: "AgentMail inbox creation succeeded but inbox_id missing in response.",
            };
          }

          ctx.setData("inboxId", inboxId);
          ctx.setData("address", inboxId);
          return { status: "completed", detail: `Created inbox ${inboxId}` };
        },
      },
      {
        id: "agentmail-verify-inbox",
        kind: "verify",
        detail: "Verify AgentMail inbox exists",
        run: async (ctx) => {
          const apiKey = ctx.getData("apiKey");
          const inboxId = ctx.getData("inboxId");
          if (!apiKey || !inboxId) {
            return { status: "blocked", detail: "Cannot verify inbox without apiKey and inboxId." };
          }
          await requestAgentmail(apiKey, "GET", `/inboxes/${encodeURIComponent(inboxId)}`);
          return { status: "completed", detail: `Verified inbox ${inboxId}` };
        },
      },
      {
        id: "agentmail-persist-pack",
        kind: "persist_secret",
        detail: "Persist AgentMail credentials in pack",
        run: async (ctx) => {
          const apiKey = ctx.getData("apiKey");
          const inboxId = ctx.getData("inboxId");
          const address = ctx.getData("address") || inboxId;
          if (!apiKey || !inboxId || !address) {
            return { status: "blocked", detail: "AgentMail workflow missing apiKey/inboxId/address." };
          }

          const apiKeyRef = ctx.putSecret("agentmail", "api_key", apiKey);
          const webhookSecret = readOption(ctx, "agentmailWebhookSecret");
          const webhookSecretRef = webhookSecret
            ? ctx.putSecret("agentmail", "webhook_secret", webhookSecret)
            : undefined;

          ctx.pack.accounts.email = {
            provider: "agentmail",
            inboxId,
            address,
            apiKeyRef,
            ...(webhookSecretRef ? { webhookSecretRef } : {}),
          };
          ctx.pack.updatedAt = new Date().toISOString();
          return { status: "completed", detail: "AgentMail account saved into identity pack" };
        },
      },
    ],
  };
}
