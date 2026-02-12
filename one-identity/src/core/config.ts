import path from "node:path";

import { readJsonFile, writeJsonFile } from "./fs.js";
import { getPaths } from "./paths.js";
import { redactString, resolveSecret, setSecret } from "./secrets.js";

type ConfigEntry = {
  value?: string;
  secret: boolean;
  secretRef?: string;
  updatedAt: string;
};

type ConfigDocument = {
  version: 1;
  profile: string;
  updatedAt: string;
  entries: Record<string, ConfigEntry>;
};

export type ConfigKeyInfo = {
  key: string;
  secret: boolean;
  description: string;
};

export type ConfigProviderCheck = {
  provider: string;
  ready: boolean;
  keys: Array<{
    key: string;
    secret: boolean;
    present: boolean;
    description: string;
    preview?: string;
  }>;
};

export type ConfigCheckResult = {
  profile: string;
  ready: boolean;
  providers: ConfigProviderCheck[];
  missing: string[];
};

const CONFIG_VERSION = 1 as const;

const KEY_INFO: Record<string, ConfigKeyInfo> = {
  "agentmail.api_key": {
    key: "agentmail.api_key",
    secret: true,
    description: "AgentMail API key with inbox read/create access",
  },
  "agentmail.webhook_secret": {
    key: "agentmail.webhook_secret",
    secret: true,
    description: "Optional AgentMail webhook secret",
  },
  "telegram.bot_token": {
    key: "telegram.bot_token",
    secret: true,
    description: "Telegram bot token from BotFather",
  },
  "telegram.bot_username": {
    key: "telegram.bot_username",
    secret: false,
    description: "Optional Telegram bot username override",
  },
  "telegram.identity_id": {
    key: "telegram.identity_id",
    secret: false,
    description: "Optional Telegram identity id in target configs",
  },
  "bitwarden.email": {
    key: "bitwarden.email",
    secret: false,
    description: "Bitwarden account email",
  },
  "bitwarden.password": {
    key: "bitwarden.password",
    secret: true,
    description: "Bitwarden master password",
  },
  "bitwarden.signup_done": {
    key: "bitwarden.signup_done",
    secret: false,
    description: "Set true after account signup checkpoint",
  },
  "bitwarden.vault": {
    key: "bitwarden.vault",
    secret: false,
    description: "Default vault label for seeded items",
  },
};

const REQUIRED_BY_PROVIDER: Record<string, string[]> = {
  agentmail: ["agentmail.api_key"],
  telegram: ["telegram.bot_token"],
  bitwarden: ["bitwarden.email", "bitwarden.password", "bitwarden.signup_done"],
};

function ensureProfile(profile: string): string {
  const next = profile.trim();
  if (!next) throw new Error("Profile name is required.");
  if (!/^[a-zA-Z0-9_.-]+$/.test(next)) {
    throw new Error(`Invalid profile: ${profile}. Use letters, numbers, dot, underscore, dash.`);
  }
  return next;
}

function ensureKey(key: string): string {
  const next = key.trim();
  if (!next) throw new Error("Config key is required.");
  if (!/^[a-z0-9_.-]+$/.test(next)) {
    throw new Error(`Invalid config key: ${key}. Use lowercase letters, numbers, dot, underscore, dash.`);
  }
  return next;
}

function profilePath(profile: string): string {
  return path.join(getPaths().configDir, `${ensureProfile(profile)}.json`);
}

function emptyDoc(profile: string): ConfigDocument {
  return {
    version: CONFIG_VERSION,
    profile,
    updatedAt: new Date().toISOString(),
    entries: {},
  };
}

function loadDoc(profile: string): ConfigDocument {
  const normalized = ensureProfile(profile);
  const loaded = readJsonFile<ConfigDocument>(profilePath(normalized));
  if (!loaded) return emptyDoc(normalized);
  return {
    version: CONFIG_VERSION,
    profile: normalized,
    updatedAt: loaded.updatedAt || new Date().toISOString(),
    entries: loaded.entries || {},
  };
}

function saveDoc(profile: string, doc: ConfigDocument) {
  const normalized = ensureProfile(profile);
  const next: ConfigDocument = {
    ...doc,
    version: CONFIG_VERSION,
    profile: normalized,
    updatedAt: new Date().toISOString(),
  };
  writeJsonFile(profilePath(normalized), next);
}

function maybeInfo(key: string): ConfigKeyInfo {
  return KEY_INFO[key] || {
    key,
    secret: false,
    description: "Custom config key",
  };
}

function renderPreview(entry: ConfigEntry | undefined, reveal: boolean): string | undefined {
  if (!entry) return undefined;
  if (!entry.secret) return entry.value;
  if (!entry.secretRef) return undefined;
  const value = resolveSecret(entry.secretRef);
  if (!value) return undefined;
  return reveal ? value : redactString(value);
}

function setSecretValue(profile: string, key: string, value: string): string {
  const safe = key.replace(/[^a-zA-Z0-9_.-]+/g, "_");
  return setSecret(`config-${profile}`, "config", safe, value);
}

export function listKnownConfigKeys(): ConfigKeyInfo[] {
  return Object.values(KEY_INFO);
}

export function setConfigValue(input: { profile: string; key: string; value: string; secret?: boolean }) {
  const profile = ensureProfile(input.profile);
  const key = ensureKey(input.key);
  const value = input.value;
  if (!value.trim()) throw new Error(`Config value for ${key} must not be empty.`);

  const info = maybeInfo(key);
  const doc = loadDoc(profile);
  const secret = Boolean(input.secret || info.secret);
  const now = new Date().toISOString();

  if (secret) {
    const ref = setSecretValue(profile, key, value);
    doc.entries[key] = {
      secret: true,
      secretRef: ref,
      updatedAt: now,
    };
  }

  if (!secret) {
    doc.entries[key] = {
      secret: false,
      value,
      updatedAt: now,
    };
  }

  saveDoc(profile, doc);
  return {
    profile,
    key,
    secret,
    value: secret ? redactString(value) : value,
  };
}

export function getConfigValue(input: { profile: string; key: string; reveal?: boolean }) {
  const profile = ensureProfile(input.profile);
  const key = ensureKey(input.key);
  const doc = loadDoc(profile);
  const entry = doc.entries[key];
  if (!entry) return undefined;

  const reveal = Boolean(input.reveal);
  if (!entry.secret) {
    return {
      profile,
      key,
      secret: false,
      value: entry.value,
    };
  }

  const resolved = entry.secretRef ? resolveSecret(entry.secretRef) : undefined;
  return {
    profile,
    key,
    secret: true,
    value: reveal ? resolved : resolved ? redactString(resolved) : undefined,
  };
}

export function resolveConfigSecret(profile: string, key: string): string | undefined {
  const doc = loadDoc(profile);
  const entry = doc.entries[ensureKey(key)];
  if (!entry) return undefined;
  if (!entry.secret) return entry.value;
  if (!entry.secretRef) return undefined;
  return resolveSecret(entry.secretRef);
}

export function listConfig(input: { profile: string; reveal?: boolean }) {
  const profile = ensureProfile(input.profile);
  const reveal = Boolean(input.reveal);
  const doc = loadDoc(profile);
  const items = Object.entries(doc.entries)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entry]) => ({
      key,
      secret: entry.secret,
      updatedAt: entry.updatedAt,
      value: renderPreview(entry, reveal),
      description: maybeInfo(key).description,
    }));
  return {
    profile,
    count: items.length,
    items,
  };
}

export function unsetConfigValue(input: { profile: string; key: string }) {
  const profile = ensureProfile(input.profile);
  const key = ensureKey(input.key);
  const doc = loadDoc(profile);
  const existed = Boolean(doc.entries[key]);
  if (!existed) {
    return {
      profile,
      key,
      removed: false,
    };
  }

  delete doc.entries[key];
  saveDoc(profile, doc);
  return {
    profile,
    key,
    removed: true,
  };
}

export function checkConfig(input: { profile: string; providers: string[]; reveal?: boolean }): ConfigCheckResult {
  const profile = ensureProfile(input.profile);
  const reveal = Boolean(input.reveal);
  const doc = loadDoc(profile);
  const providers = input.providers.length ? input.providers : Object.keys(REQUIRED_BY_PROVIDER);

  const checks = providers.map((provider): ConfigProviderCheck => {
    const keys = REQUIRED_BY_PROVIDER[provider] || [];
    const items = keys.map((key) => {
      const entry = doc.entries[key];
      const preview = renderPreview(entry, reveal);
      const present = Boolean(preview && preview.trim());
      return {
        key,
        secret: maybeInfo(key).secret,
        present,
        description: maybeInfo(key).description,
        ...(preview ? { preview } : {}),
      };
    });
    return {
      provider,
      ready: items.every((item) => item.present),
      keys: items,
    };
  });

  const missing = checks.flatMap((provider) => provider.keys.filter((item) => !item.present).map((item) => item.key));
  return {
    profile,
    ready: checks.every((provider) => provider.ready),
    providers: checks,
    missing,
  };
}

export function getRequiredConfigKeys(providers: string[]): ConfigKeyInfo[] {
  const list = providers.length ? providers : Object.keys(REQUIRED_BY_PROVIDER);
  const keys = new Set(list.flatMap((provider) => REQUIRED_BY_PROVIDER[provider] || []));
  return [...keys].map((key) => maybeInfo(key));
}

export function profileExists(profile: string): boolean {
  const doc = readJsonFile<ConfigDocument>(profilePath(profile));
  return Boolean(doc);
}
