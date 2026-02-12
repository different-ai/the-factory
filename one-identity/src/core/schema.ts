import { z } from "zod";

import { PACK_SCHEMA_VERSION, TARGETS, type IdentityPack } from "./types.js";

const secretRef = z.string().regex(/^secret:\/\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/, {
  message: "Invalid secret reference. Expected secret://pack/provider/key",
});

const emailAccount = z.object({
  provider: z.literal("agentmail"),
  inboxId: z.string().min(1),
  address: z.string().email(),
  apiKeyRef: secretRef,
  webhookSecretRef: secretRef.optional(),
});

const telegramAccount = z.object({
  provider: z.literal("telegram"),
  identityId: z.string().min(1),
  botUsername: z.string().min(1),
  tokenRef: secretRef,
});

const slackAccount = z.object({
  provider: z.literal("slack"),
  identityId: z.string().min(1),
  botTokenRef: secretRef,
  appTokenRef: secretRef,
});

const bitwardenAccount = z.object({
  provider: z.literal("bitwarden"),
  accountEmail: z.string().email(),
  vault: z.string().min(1),
  itemRefs: z.array(z.string().min(1)).default([]),
  sessionRef: secretRef.optional(),
  masterPasswordRef: secretRef.optional(),
});

const provisioningStepSchema = z.object({
  provider: z.string().min(1),
  stepId: z.string().min(1),
  kind: z.enum(["api_call", "browser_task", "manual_checkpoint", "verify", "persist_secret"]),
  status: z.enum(["completed", "blocked"]),
  detail: z.string().min(1),
  updatedAt: z.string().datetime(),
});

const provisioningRunSchema = z.object({
  runId: z.string().min(1),
  startedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completed: z.boolean(),
  steps: z.array(provisioningStepSchema),
});

export const identityPackSchema = z.object({
  schema: z.literal(PACK_SCHEMA_VERSION),
  packId: z.string().regex(/^[a-zA-Z0-9_.-]+$/),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  accounts: z.object({
    email: emailAccount.optional(),
    telegram: telegramAccount.optional(),
    slack: slackAccount.optional(),
    bitwarden: bitwardenAccount.optional(),
  }),
  targets: z.array(z.enum(TARGETS)).default([]),
  provisioning: z
    .object({
      runs: z.array(provisioningRunSchema),
    })
    .optional(),
});

export function validatePack(input: unknown): IdentityPack {
  return identityPackSchema.parse(input);
}

export function isTargetId(value: string): value is (typeof TARGETS)[number] {
  return TARGETS.includes(value as (typeof TARGETS)[number]);
}
