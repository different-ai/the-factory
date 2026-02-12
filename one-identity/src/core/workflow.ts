import { resolveSecret, setSecret } from "./secrets.js";
import type { IdentityPack } from "./types.js";
import type { ProviderRunState, ProvisionRunState, StepKind } from "./run-state.js";

export type WorkflowStepResult =
  | {
      status: "completed";
      detail?: string;
    }
  | {
      status: "blocked";
      detail: string;
    };

export type WorkflowStepContext = {
  pack: IdentityPack;
  nonInteractive: boolean;
  options: Record<string, string | boolean | undefined>;
  state: Record<string, string>;
  getOption: (key: string) => string | undefined;
  getFlag: (key: string) => boolean;
  ask: (prompt: string) => Promise<string | undefined>;
  setData: (key: string, value: string) => void;
  getData: (key: string) => string | undefined;
  putSecret: (provider: string, key: string, value: string) => string;
  resolveSecret: (ref: string) => string | undefined;
  updatePack: (next: IdentityPack) => void;
  log: (message: string) => void;
};

export type WorkflowStep = {
  id: string;
  kind: StepKind;
  detail: string;
  run: (ctx: WorkflowStepContext) => Promise<WorkflowStepResult>;
};

export type ProviderWorkflow = {
  provider: string;
  steps: WorkflowStep[];
};

export type WorkflowRunResult = {
  status: "completed" | "blocked";
  blockedStepId?: string;
  blockedReason?: string;
};

function ensureProviderState(run: ProvisionRunState, provider: string): ProviderRunState {
  if (!run.providers[provider]) {
    run.providers[provider] = {
      cursor: 0,
      completed: false,
      data: {},
      steps: [],
    };
  }
  return run.providers[provider];
}

function upsertStep(providerState: ProviderRunState, next: ProviderRunState["steps"][number]) {
  const idx = providerState.steps.findIndex((s) => s.stepId === next.stepId);
  if (idx === -1) {
    providerState.steps.push(next);
    return;
  }
  providerState.steps[idx] = next;
}

function asString(value: string | boolean | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value ? "true" : "false";
  const trimmed = value.trim();
  return trimmed || undefined;
}

function asFlag(value: string | boolean | undefined): boolean {
  if (typeof value === "boolean") return value;
  if (value === undefined) return false;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export async function runProviderWorkflow(input: {
  workflow: ProviderWorkflow;
  run: ProvisionRunState;
  pack: IdentityPack;
  options: Record<string, string | boolean | undefined>;
  nonInteractive: boolean;
  ask: (prompt: string) => Promise<string | undefined>;
  log: (message: string) => void;
}): Promise<WorkflowRunResult> {
  const providerState = ensureProviderState(input.run, input.workflow.provider);
  const context: WorkflowStepContext = {
    pack: input.pack,
    nonInteractive: input.nonInteractive,
    options: input.options,
    state: providerState.data,
    getOption: (key) => asString(input.options[key]),
    getFlag: (key) => asFlag(input.options[key]),
    ask: input.ask,
    setData: (key, value) => {
      providerState.data[key] = value;
    },
    getData: (key) => providerState.data[key],
    putSecret: (provider, key, value) => setSecret(input.pack.packId, provider, key, value),
    resolveSecret,
    updatePack: (next) => {
      input.pack = next;
    },
    log: input.log,
  };

  for (let i = providerState.cursor; i < input.workflow.steps.length; i += 1) {
    const step = input.workflow.steps[i];
    input.log(`[${input.workflow.provider}] ${step.id}: ${step.detail}`);
    const result = await step.run(context);
    const timestamp = new Date().toISOString();

    if (result.status === "blocked") {
      upsertStep(providerState, {
        stepId: step.id,
        kind: step.kind,
        status: "blocked",
        detail: result.detail,
        updatedAt: timestamp,
      });
      providerState.cursor = i;
      providerState.completed = false;
      return {
        status: "blocked",
        blockedStepId: step.id,
        blockedReason: result.detail,
      };
    }

    upsertStep(providerState, {
      stepId: step.id,
      kind: step.kind,
      status: "completed",
      detail: result.detail || step.detail,
      updatedAt: timestamp,
    });
    providerState.cursor = i + 1;
  }

  providerState.completed = true;
  return {
    status: "completed",
  };
}
