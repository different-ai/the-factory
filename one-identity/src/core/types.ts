export const PACK_SCHEMA_VERSION = "one-identity/v1" as const;

export const TARGETS = ["owpenbot", "openclaw", "nanoclaw"] as const;
export type TargetId = (typeof TARGETS)[number];

export type AgentmailEmailAccount = {
  provider: "agentmail";
  inboxId: string;
  address: string;
  apiKeyRef: string;
  webhookSecretRef?: string;
};

export type TelegramAccount = {
  provider: "telegram";
  identityId: string;
  botUsername: string;
  tokenRef: string;
};

export type SlackAccount = {
  provider: "slack";
  identityId: string;
  botTokenRef: string;
  appTokenRef: string;
};

export type BitwardenAccount = {
  provider: "bitwarden";
  accountEmail: string;
  vault: string;
  itemRefs: string[];
  sessionRef?: string;
  masterPasswordRef?: string;
};

export type ProvisioningStepLog = {
  provider: string;
  stepId: string;
  kind: "api_call" | "browser_task" | "manual_checkpoint" | "verify" | "persist_secret";
  status: "completed" | "blocked";
  detail: string;
  updatedAt: string;
};

export type ProvisioningRunLog = {
  runId: string;
  startedAt: string;
  updatedAt: string;
  completed: boolean;
  steps: ProvisioningStepLog[];
};

export type IdentityPack = {
  schema: typeof PACK_SCHEMA_VERSION;
  packId: string;
  createdAt: string;
  updatedAt: string;
  accounts: {
    email?: AgentmailEmailAccount;
    telegram?: TelegramAccount;
    slack?: SlackAccount;
    bitwarden?: BitwardenAccount;
  };
  targets: TargetId[];
  provisioning?: {
    runs: ProvisioningRunLog[];
  };
};

export type SecretBundle = {
  version: 1;
  updatedAt: string;
  values: Record<string, string>;
};

export type AdapterContext = {
  resolveSecret: (ref: string) => string | undefined;
};
