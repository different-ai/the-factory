import fs from "node:fs";
import path from "node:path";

import type { AdapterContext, IdentityPack } from "../core/types.js";

type EnvMap = Record<string, string>;

function parseEnv(content: string): EnvMap {
  const out: EnvMap = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    out[key] = value;
  }
  return out;
}

function renderEnv(values: EnvMap): string {
  const lines = Object.entries(values)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`);
  return `${lines.join("\n")}\n`;
}

export function buildNanoClawEnvFragment(pack: IdentityPack, ctx: AdapterContext): EnvMap {
  const env: EnvMap = {};

  if (pack.accounts.telegram) {
    const token = ctx.resolveSecret(pack.accounts.telegram.tokenRef);
    if (!token) throw new Error(`Missing secret for ${pack.accounts.telegram.tokenRef}`);
    env.TELEGRAM_BOT_TOKEN = token;
  }

  if (pack.accounts.slack) {
    const botToken = ctx.resolveSecret(pack.accounts.slack.botTokenRef);
    const appToken = ctx.resolveSecret(pack.accounts.slack.appTokenRef);
    if (!botToken) throw new Error(`Missing secret for ${pack.accounts.slack.botTokenRef}`);
    if (!appToken) throw new Error(`Missing secret for ${pack.accounts.slack.appTokenRef}`);
    env.SLACK_BOT_TOKEN = botToken;
    env.SLACK_APP_TOKEN = appToken;
  }

  if (pack.accounts.email?.provider === "agentmail") {
    const apiKey = ctx.resolveSecret(pack.accounts.email.apiKeyRef);
    if (!apiKey) throw new Error(`Missing secret for ${pack.accounts.email.apiKeyRef}`);
    env.AGENTMAIL_INBOX_ID = pack.accounts.email.inboxId;
    env.AGENTMAIL_ADDRESS = pack.accounts.email.address;
    env.AGENTMAIL_API_KEY = apiKey;
    if (pack.accounts.email.webhookSecretRef) {
      const webhookSecret = ctx.resolveSecret(pack.accounts.email.webhookSecretRef);
      if (!webhookSecret) throw new Error(`Missing secret for ${pack.accounts.email.webhookSecretRef}`);
      env.AGENTMAIL_WEBHOOK_SECRET = webhookSecret;
    }
  }

  if (pack.accounts.bitwarden) {
    env.BITWARDEN_VAULT = pack.accounts.bitwarden.vault;
    env.BITWARDEN_ITEM_REFS = pack.accounts.bitwarden.itemRefs.join(",");
    if (pack.accounts.bitwarden.sessionRef) {
      const session = ctx.resolveSecret(pack.accounts.bitwarden.sessionRef);
      if (!session) throw new Error(`Missing secret for ${pack.accounts.bitwarden.sessionRef}`);
      env.BITWARDEN_SESSION = session;
    }
  }

  return env;
}

export function exportNanoClawEnv(pack: IdentityPack, ctx: AdapterContext): string {
  return renderEnv(buildNanoClawEnvFragment(pack, ctx));
}

export function applyNanoClawEnv(pack: IdentityPack, ctx: AdapterContext, envPath: string, dryRun: boolean): EnvMap {
  const fragment = buildNanoClawEnvFragment(pack, ctx);
  const existing = (() => {
    try {
      return parseEnv(fs.readFileSync(envPath, "utf8"));
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") return {};
      throw error;
    }
  })();

  const merged = {
    ...existing,
    ...fragment,
  };

  if (!dryRun) {
    fs.mkdirSync(path.dirname(envPath), { recursive: true });
    fs.writeFileSync(envPath, renderEnv(merged), "utf8");
  }

  return merged;
}
