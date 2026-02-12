import fs from "node:fs";

import { readJsonFile, writeJsonFile } from "./fs.js";
import { getPaths } from "./paths.js";

export type StepKind = "api_call" | "browser_task" | "manual_checkpoint" | "verify" | "persist_secret";

export type ProviderStepState = {
  stepId: string;
  kind: StepKind;
  status: "completed" | "blocked";
  detail: string;
  updatedAt: string;
};

export type ProviderRunState = {
  cursor: number;
  completed: boolean;
  data: Record<string, string>;
  steps: ProviderStepState[];
};

export type ProvisionRunState = {
  packId: string;
  runId: string;
  createdAt: string;
  updatedAt: string;
  providers: Record<string, ProviderRunState>;
};

function runStatePath(packId: string): string {
  return `${getPaths().runsDir}/${packId}.json`;
}

export function loadRunState(packId: string): ProvisionRunState | undefined {
  return readJsonFile<ProvisionRunState>(runStatePath(packId));
}

export function createRunState(packId: string): ProvisionRunState {
  const now = new Date().toISOString();
  return {
    packId,
    runId: `${packId}-${Date.now()}`,
    createdAt: now,
    updatedAt: now,
    providers: {},
  };
}

export function saveRunState(state: ProvisionRunState) {
  state.updatedAt = new Date().toISOString();
  writeJsonFile(runStatePath(state.packId), state);
}

export function clearRunState(packId: string) {
  const filePath = runStatePath(packId);
  try {
    fs.unlinkSync(filePath);
  } catch {
    // no-op if absent
  }
}
