import fs from "node:fs";

import type { AdapterContext, IdentityPack } from "../core/types.js";

type OwpenbotConfig = {
  version: number;
  channels?: {
    telegram?: {
      enabled?: boolean;
      bots?: Array<{
        id: string;
        token: string;
        enabled: boolean;
      }>;
    };
    slack?: {
      enabled?: boolean;
      apps?: Array<{
        id: string;
        botToken: string;
        appToken: string;
        enabled: boolean;
      }>;
    };
  };
  integrations?: {
    agentmail?: {
      inboxId: string;
      address: string;
      apiKey: string;
      webhookSecret?: string;
    };
    bitwarden?: {
      vault: string;
      itemRefs: string[];
      session?: string;
    };
  };
};

function upsertById<T extends { id: string }>(items: T[], next: T): T[] {
  const filtered = items.filter((item) => item.id !== next.id);
  filtered.push(next);
  return filtered;
}

export function buildOwpenbotFragment(pack: IdentityPack, ctx: AdapterContext): OwpenbotConfig {
  const base: OwpenbotConfig = { version: 1 };

  if (pack.accounts.email?.provider === "agentmail") {
    const apiKey = ctx.resolveSecret(pack.accounts.email.apiKeyRef);
    if (!apiKey) throw new Error(`Missing secret for ${pack.accounts.email.apiKeyRef}`);
    const webhookSecret = pack.accounts.email.webhookSecretRef
      ? ctx.resolveSecret(pack.accounts.email.webhookSecretRef)
      : undefined;
    base.integrations = {
      ...base.integrations,
      agentmail: {
        inboxId: pack.accounts.email.inboxId,
        address: pack.accounts.email.address,
        apiKey,
        ...(webhookSecret ? { webhookSecret } : {}),
      },
    };
  }

  if (pack.accounts.telegram) {
    const token = ctx.resolveSecret(pack.accounts.telegram.tokenRef);
    if (!token) throw new Error(`Missing secret for ${pack.accounts.telegram.tokenRef}`);
    base.channels = base.channels || {};
    base.channels.telegram = {
      enabled: true,
      bots: [
        {
          id: pack.accounts.telegram.identityId,
          token,
          enabled: true,
        },
      ],
    };
  }

  if (pack.accounts.slack) {
    const botToken = ctx.resolveSecret(pack.accounts.slack.botTokenRef);
    const appToken = ctx.resolveSecret(pack.accounts.slack.appTokenRef);
    if (!botToken) throw new Error(`Missing secret for ${pack.accounts.slack.botTokenRef}`);
    if (!appToken) throw new Error(`Missing secret for ${pack.accounts.slack.appTokenRef}`);
    base.channels = base.channels || {};
    base.channels.slack = {
      enabled: true,
      apps: [
        {
          id: pack.accounts.slack.identityId,
          botToken,
          appToken,
          enabled: true,
        },
      ],
    };
  }

  if (pack.accounts.bitwarden) {
    const session = pack.accounts.bitwarden.sessionRef ? ctx.resolveSecret(pack.accounts.bitwarden.sessionRef) : undefined;
    base.integrations = {
      ...base.integrations,
      bitwarden: {
        vault: pack.accounts.bitwarden.vault,
        itemRefs: pack.accounts.bitwarden.itemRefs,
        ...(session ? { session } : {}),
      },
    };
  }

  return base;
}

export function applyOwpenbotConfig(pack: IdentityPack, ctx: AdapterContext, configPath: string, dryRun: boolean): OwpenbotConfig {
  const fragment = buildOwpenbotFragment(pack, ctx);
  const existing = (() => {
    try {
      return JSON.parse(fs.readFileSync(configPath, "utf8")) as OwpenbotConfig;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") return { version: 1 } as OwpenbotConfig;
      throw error;
    }
  })();

  const merged: OwpenbotConfig = {
    ...existing,
    version: existing.version || 1,
    channels: {
      ...existing.channels,
    },
    integrations: {
      ...existing.integrations,
    },
  };

  if (fragment.channels?.telegram?.bots?.[0]) {
    const nextBot = fragment.channels.telegram.bots[0];
    merged.channels = merged.channels || {};
    const existingBots = merged.channels.telegram?.bots || [];
    merged.channels.telegram = {
      enabled: true,
      bots: upsertById(existingBots, nextBot),
    };
  }

  if (fragment.channels?.slack?.apps?.[0]) {
    const nextApp = fragment.channels.slack.apps[0];
    merged.channels = merged.channels || {};
    const existingApps = merged.channels.slack?.apps || [];
    merged.channels.slack = {
      enabled: true,
      apps: upsertById(existingApps, nextApp),
    };
  }

  if (fragment.integrations?.bitwarden) {
    merged.integrations = merged.integrations || {};
    merged.integrations.bitwarden = fragment.integrations.bitwarden;
  }

  if (fragment.integrations?.agentmail) {
    merged.integrations = merged.integrations || {};
    merged.integrations.agentmail = fragment.integrations.agentmail;
  }

  if (!dryRun) {
    fs.mkdirSync(configPath.split("/").slice(0, -1).join("/") || ".", { recursive: true });
    fs.writeFileSync(configPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  }

  return merged;
}
