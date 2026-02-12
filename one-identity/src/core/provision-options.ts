import { resolveConfigSecret } from "./config.js";

export type RawOptions = Record<string, string | boolean | undefined>;

type ResolvedOptions = {
  agentmailApiKey?: string;
  agentmailUsername?: string;
  agentmailDomain?: string;
  agentmailDisplayName?: string;
  agentmailInboxId?: string;
  agentmailWebhookSecret?: string;
  forceAgentmailCreate?: boolean;
  telegramBotToken?: string;
  telegramBotUsername?: string;
  telegramIdentityId?: string;
  bitwardenEmail?: string;
  bitwardenPassword?: string;
  bitwardenVault?: string;
  bitwardenSkipSignup?: boolean;
  bitwardenAlreadyCreated?: boolean;
};

function toString(value: string | boolean | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function toBool(value: string | boolean | undefined): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return undefined;
}

function pickFlag(options: RawOptions, key: string): string | undefined {
  return toString(options[key]);
}

function pickSecret(profile: string, key: string): string | undefined {
  const value = resolveConfigSecret(profile, key);
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function pickConfig(profile: string, key: string): string | undefined {
  return pickSecret(profile, key);
}

function resolveSignupFlags(profile: string, options: RawOptions): { skipSignup?: boolean; alreadyCreated?: boolean } {
  const explicitSkip = toBool(options.bitwardenSkipSignup);
  const explicitCreated = toBool(options.bitwardenAlreadyCreated);
  if (explicitSkip !== undefined || explicitCreated !== undefined) {
    return {
      ...(explicitSkip !== undefined ? { skipSignup: explicitSkip } : {}),
      ...(explicitCreated !== undefined ? { alreadyCreated: explicitCreated } : {}),
    };
  }

  const fromConfig = pickConfig(profile, "bitwarden.signup_done");
  if (!fromConfig) return {};
  const parsed = toBool(fromConfig);
  if (parsed === undefined) return {};
  return {
    skipSignup: parsed,
    alreadyCreated: parsed,
  };
}

export function resolveProvisionOptions(input: {
  profile: string;
  options: RawOptions;
  useConfig: boolean;
}): ResolvedOptions {
  const profile = input.profile;
  const options = input.options;
  const fromConfig = input.useConfig
    ? {
        agentmailApiKey: pickConfig(profile, "agentmail.api_key"),
        agentmailWebhookSecret: pickConfig(profile, "agentmail.webhook_secret"),
        telegramBotToken: pickConfig(profile, "telegram.bot_token"),
        telegramBotUsername: pickConfig(profile, "telegram.bot_username"),
        telegramIdentityId: pickConfig(profile, "telegram.identity_id"),
        bitwardenEmail: pickConfig(profile, "bitwarden.email"),
        bitwardenPassword: pickConfig(profile, "bitwarden.password"),
        bitwardenVault: pickConfig(profile, "bitwarden.vault"),
      }
    : {};

  const signupFlags = input.useConfig ? resolveSignupFlags(profile, options) : {};

  return {
    agentmailApiKey: pickFlag(options, "agentmailApiKey") || fromConfig.agentmailApiKey,
    agentmailUsername: pickFlag(options, "agentmailUsername"),
    agentmailDomain: pickFlag(options, "agentmailDomain"),
    agentmailDisplayName: pickFlag(options, "agentmailDisplayName"),
    agentmailInboxId: pickFlag(options, "agentmailInboxId"),
    agentmailWebhookSecret: pickFlag(options, "agentmailWebhookSecret") || fromConfig.agentmailWebhookSecret,
    forceAgentmailCreate: toBool(options.forceAgentmailCreate),
    telegramBotToken: pickFlag(options, "telegramBotToken") || fromConfig.telegramBotToken,
    telegramBotUsername: pickFlag(options, "telegramBotUsername") || fromConfig.telegramBotUsername,
    telegramIdentityId: pickFlag(options, "telegramIdentityId") || fromConfig.telegramIdentityId,
    bitwardenEmail: pickFlag(options, "bitwardenEmail") || fromConfig.bitwardenEmail,
    bitwardenPassword: pickFlag(options, "bitwardenPassword") || fromConfig.bitwardenPassword,
    bitwardenVault: pickFlag(options, "bitwardenVault") || fromConfig.bitwardenVault,
    bitwardenSkipSignup:
      toBool(options.bitwardenSkipSignup) !== undefined
        ? toBool(options.bitwardenSkipSignup)
        : signupFlags.skipSignup,
    bitwardenAlreadyCreated:
      toBool(options.bitwardenAlreadyCreated) !== undefined
        ? toBool(options.bitwardenAlreadyCreated)
        : signupFlags.alreadyCreated,
  };
}
