import fs from "node:fs";
import path from "node:path";

import { readJsonFile } from "./fs.js";
import { getPaths } from "./paths.js";
import type { SecretBundle } from "./types.js";

const BUNDLE_VERSION = 1 as const;

function secretFilePath(packId: string) {
  return path.join(getPaths().secretsDir, `${packId}.json`);
}

function bundleTemplate(): SecretBundle {
  return {
    version: BUNDLE_VERSION,
    updatedAt: new Date().toISOString(),
    values: {},
  };
}

function loadBundle(packId: string): SecretBundle {
  const loaded = readJsonFile<SecretBundle>(secretFilePath(packId));
  if (!loaded) return bundleTemplate();
  return {
    version: BUNDLE_VERSION,
    updatedAt: loaded.updatedAt || new Date().toISOString(),
    values: loaded.values || {},
  };
}

function saveBundle(packId: string, bundle: SecretBundle) {
  const filePath = secretFilePath(packId);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(bundle, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // best-effort permissions hardening
  }
}

export function buildSecretRef(packId: string, provider: string, key: string): string {
  return `secret://${packId}/${provider}/${key}`;
}

export function parseSecretRef(ref: string): { packId: string; provider: string; key: string } | undefined {
  const m = /^secret:\/\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/.exec(ref);
  if (!m) return undefined;
  return { packId: m[1], provider: m[2], key: m[3] };
}

export function setSecret(packId: string, provider: string, key: string, value: string): string {
  const bundle = loadBundle(packId);
  bundle.values[`${provider}.${key}`] = value;
  bundle.updatedAt = new Date().toISOString();
  saveBundle(packId, bundle);
  return buildSecretRef(packId, provider, key);
}

export function resolveSecret(ref: string): string | undefined {
  const parsed = parseSecretRef(ref);
  if (!parsed) return undefined;
  const bundle = loadBundle(parsed.packId);
  return bundle.values[`${parsed.provider}.${parsed.key}`];
}

export function redactString(input: string): string {
  if (input.length <= 8) return "********";
  return `${input.slice(0, 4)}...${input.slice(-4)}`;
}
