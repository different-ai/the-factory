import fs from "node:fs";
import path from "node:path";

import type { AdapterContext, IdentityPack } from "../core/types.js";

type OpenClawConfig = {
  channels?: {
    telegram?: {
      botToken?: string;
      identityId?: string;
    };
    slack?: {
      botToken?: string;
      appToken?: string;
      identityId?: string;
    };
  };
  integrations?: {
    bitwarden?: {
      vault: string;
      itemRefs: string[];
      session?: string;
    };
    agentmail?: {
      inboxId: string;
      address: string;
      apiKey: string;
      webhookSecret?: string;
    };
  };
};

export function buildOpenClawFragment(pack: IdentityPack, ctx: AdapterContext): OpenClawConfig {
  const config: OpenClawConfig = {};

  if (pack.accounts.telegram) {
    const token = ctx.resolveSecret(pack.accounts.telegram.tokenRef);
    if (!token) throw new Error(`Missing secret for ${pack.accounts.telegram.tokenRef}`);
    config.channels = config.channels || {};
    config.channels.telegram = {
      botToken: token,
      identityId: pack.accounts.telegram.identityId,
    };
  }

  if (pack.accounts.slack) {
    const botToken = ctx.resolveSecret(pack.accounts.slack.botTokenRef);
    const appToken = ctx.resolveSecret(pack.accounts.slack.appTokenRef);
    if (!botToken) throw new Error(`Missing secret for ${pack.accounts.slack.botTokenRef}`);
    if (!appToken) throw new Error(`Missing secret for ${pack.accounts.slack.appTokenRef}`);
    config.channels = config.channels || {};
    config.channels.slack = {
      botToken,
      appToken,
      identityId: pack.accounts.slack.identityId,
    };
  }

  if (pack.accounts.bitwarden) {
    const session = pack.accounts.bitwarden.sessionRef ? ctx.resolveSecret(pack.accounts.bitwarden.sessionRef) : undefined;
    config.integrations = config.integrations || {};
    config.integrations.bitwarden = {
      vault: pack.accounts.bitwarden.vault,
      itemRefs: pack.accounts.bitwarden.itemRefs,
      ...(session ? { session } : {}),
    };
  }

  if (pack.accounts.email?.provider === "agentmail") {
    const apiKey = ctx.resolveSecret(pack.accounts.email.apiKeyRef);
    if (!apiKey) throw new Error(`Missing secret for ${pack.accounts.email.apiKeyRef}`);
    const webhookSecret = pack.accounts.email.webhookSecretRef
      ? ctx.resolveSecret(pack.accounts.email.webhookSecretRef)
      : undefined;
    config.integrations = config.integrations || {};
    config.integrations.agentmail = {
      inboxId: pack.accounts.email.inboxId,
      address: pack.accounts.email.address,
      apiKey,
      ...(webhookSecret ? { webhookSecret } : {}),
    };
  }

  return config;
}

export function applyOpenClawConfig(pack: IdentityPack, ctx: AdapterContext, configPath: string, dryRun: boolean): OpenClawConfig {
  const fragment = buildOpenClawFragment(pack, ctx);
  const existing = (() => {
    try {
      return JSON.parse(fs.readFileSync(configPath, "utf8")) as OpenClawConfig;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") return {};
      throw error;
    }
  })();

  const merged: OpenClawConfig = {
    ...existing,
    channels: {
      ...existing.channels,
      ...fragment.channels,
    },
    integrations: {
      ...existing.integrations,
      ...fragment.integrations,
    },
  };

  if (!dryRun) {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  }

  return merged;
}
