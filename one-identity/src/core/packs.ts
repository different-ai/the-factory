import fs from "node:fs";
import path from "node:path";

import { readJsonFile, writeJsonFile } from "./fs.js";
import { getPaths } from "./paths.js";
import { validatePack } from "./schema.js";
import type { IdentityPack, ProvisioningRunLog, TargetId } from "./types.js";
import { PACK_SCHEMA_VERSION } from "./types.js";

function packFilePath(packId: string): string {
  return path.join(getPaths().packsDir, `${packId}.json`);
}

export function savePack(pack: IdentityPack): IdentityPack {
  const validated = validatePack(pack);
  writeJsonFile(packFilePath(validated.packId), validated);
  return validated;
}

export function loadPack(packId: string): IdentityPack {
  const loaded = readJsonFile<IdentityPack>(packFilePath(packId));
  if (!loaded) {
    throw new Error(`Pack not found: ${packId}`);
  }
  return validatePack(loaded);
}

export function listPacks(): string[] {
  const { packsDir } = getPaths();
  try {
    return fs
      .readdirSync(packsDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""))
      .sort();
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return [];
    throw error;
  }
}

export function ensurePack(packId: string, targets: TargetId[]): IdentityPack {
  try {
    const existing = loadPack(packId);
    if (!targets.length) return existing;
    const merged = {
      ...existing,
      targets,
      updatedAt: new Date().toISOString(),
    };
    return savePack(merged);
  } catch {
    const now = new Date().toISOString();
    return savePack({
      schema: PACK_SCHEMA_VERSION,
      packId,
      createdAt: now,
      updatedAt: now,
      accounts: {},
      targets,
      provisioning: {
        runs: [],
      },
    });
  }
}

export function appendProvisioningRun(pack: IdentityPack, run: ProvisioningRunLog): IdentityPack {
  const next: IdentityPack = {
    ...pack,
    updatedAt: new Date().toISOString(),
    provisioning: {
      runs: [...(pack.provisioning?.runs || []), run],
    },
  };
  return savePack(next);
}
