import type { ProviderWorkflow } from "../core/workflow.js";

import { buildAgentmailWorkflow } from "./agentmail.js";
import { buildBitwardenWorkflow } from "./bitwarden.js";
import { buildTelegramWorkflow } from "./telegram.js";

export const PROVIDERS = ["agentmail", "telegram", "bitwarden"] as const;
export type ProviderId = (typeof PROVIDERS)[number];

export function isProviderId(value: string): value is ProviderId {
  return PROVIDERS.includes(value as ProviderId);
}

export function getWorkflow(provider: ProviderId): ProviderWorkflow {
  if (provider === "agentmail") return buildAgentmailWorkflow();
  if (provider === "telegram") return buildTelegramWorkflow();
  return buildBitwardenWorkflow();
}
