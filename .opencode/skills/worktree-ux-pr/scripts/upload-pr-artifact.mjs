#!/usr/bin/env node

import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { constants as fsConstants } from 'node:fs';

function parseDotEnv(content) {
  const values = {};

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

async function loadSkillEnv(scriptUrl = import.meta.url) {
  const scriptDir = path.dirname(new URL(scriptUrl).pathname);
  const envPath = path.join(scriptDir, '..', '.env');

  try {
    const content = await readFile(envPath, 'utf8');
    const values = parseDotEnv(content);
    for (const [key, value] of Object.entries(values)) {
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return;
    }
    throw error;
  }
}

function sanitizeSegment(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function sanitizeFilename(filename) {
  const parsed = path.parse(filename);
  const base = sanitizeSegment(parsed.name) || 'artifact';
  return `${base}${parsed.ext.toLowerCase()}`;
}

function formatTimestamp(timestamp) {
  return timestamp.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function buildObjectPath({
  repo,
  prNumber,
  label,
  originalFilename,
  timestamp = new Date(),
}) {
  const repoSlug = sanitizeSegment(repo.replaceAll('/', '-'));
  const safeLabel = sanitizeSegment(label) || 'other';
  const filename = sanitizeFilename(originalFilename);
  return `${repoSlug}/pr-${prNumber}/${safeLabel}-${formatTimestamp(timestamp)}-${filename}`;
}

export function inferArtifactKind(artifactPath) {
  const extension = path.extname(artifactPath).toLowerCase();

  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(extension)) {
    return 'image';
  }

  if (['.mp4', '.mov', '.webm', '.m4v'].includes(extension)) {
    return 'video';
  }

  throw new Error(`Unsupported artifact type for "${artifactPath}"`);
}

function inferMimeType(artifactPath) {
  const extension = path.extname(artifactPath).toLowerCase();

  const mimeTypes = {
    '.gif': 'image/gif',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.m4v': 'video/x-m4v',
    '.mov': 'video/quicktime',
    '.mp4': 'video/mp4',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webm': 'video/webm',
    '.webp': 'image/webp',
  };

  return mimeTypes[extension] || 'application/octet-stream';
}

function encodeObjectPath(objectPath) {
  return objectPath.split('/').map(encodeURIComponent).join('/');
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function createSupabaseHeaders(serviceRoleKey, extra = {}) {
  return {
    Authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
    ...extra,
  };
}

async function expectOk(response, context) {
  if (response.ok) return;

  let message;
  try {
    message = await response.text();
  } catch {
    message = response.statusText;
  }

  throw new Error(`${context} failed (${response.status}): ${message}`);
}

export class MetadataInsertError extends Error {
  constructor(message, uploaded) {
    super(message);
    this.name = 'MetadataInsertError';
    this.uploaded = uploaded;
  }
}

export async function uploadAndRecordArtifact({
  artifactPath,
  repo,
  prNumber,
  label,
  prTitle,
  supabaseUrl,
  serviceRoleKey,
  bucket = 'pr-artifacts',
  timestamp = new Date(),
  fetchImpl = fetch,
}) {
  const normalizedUrl = trimTrailingSlash(supabaseUrl);
  const originalFilename = path.basename(artifactPath);
  const artifactKind = inferArtifactKind(artifactPath);
  const objectPath = buildObjectPath({
    repo,
    prNumber,
    label,
    originalFilename,
    timestamp,
  });
  const encodedObjectPath = encodeObjectPath(objectPath);
  const publicUrl = `${normalizedUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedObjectPath}`;
  const body = await readFile(artifactPath);

  const uploadResponse = await fetchImpl(
    `${normalizedUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedObjectPath}`,
    {
      method: 'POST',
      headers: createSupabaseHeaders(serviceRoleKey, {
        'cache-control': '3600',
        'content-type': inferMimeType(artifactPath),
        'x-upsert': 'false',
      }),
      body,
    },
  );

  await expectOk(uploadResponse, 'Storage upload');

  const metadata = {
    repo,
    pr_number: prNumber,
    pr_title: prTitle ?? null,
    artifact_kind: artifactKind,
    label,
    original_filename: originalFilename,
    object_path: objectPath,
    public_url: publicUrl,
  };

  const metadataResponse = await fetchImpl(`${normalizedUrl}/rest/v1/pr_artifacts`, {
    method: 'POST',
    headers: createSupabaseHeaders(serviceRoleKey, {
      'content-type': 'application/json',
      Prefer: 'return=representation',
    }),
    body: JSON.stringify(metadata),
  });

  if (!metadataResponse.ok) {
    let message;
    try {
      message = await metadataResponse.text();
    } catch {
      message = metadataResponse.statusText;
    }

    throw new MetadataInsertError(
      `Metadata insert failed (${metadataResponse.status}): ${message}`,
      {
        bucket,
        objectPath,
        publicUrl,
      },
    );
  }

  return {
    artifact_kind: artifactKind,
    label,
    object_path: objectPath,
    pr_number: prNumber,
    public_url: publicUrl,
    repo,
  };
}

function parseArgs(argv) {
  const values = {
    title: null,
  };
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }

    const key = token.slice(2);
    const value = argv[index + 1];
    if (value == null || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }

    values[key] = value;
    index += 1;
  }

  if (positional.length !== 1) {
    throw new Error('Expected exactly one artifact file path');
  }

  values.file = positional[0];
  return values;
}

async function validateInputs({ file, repo, pr, label, supabaseUrl, serviceRoleKey }) {
  if (!repo) throw new Error('Missing required --repo');
  if (!pr) throw new Error('Missing required --pr');
  if (!label) throw new Error('Missing required --label');
  if (!supabaseUrl) throw new Error('SUPABASE_URL is required');
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');

  const prNumber = Number.parseInt(pr, 10);
  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    throw new Error(`Invalid --pr value "${pr}"`);
  }

  await access(file, fsConstants.R_OK);

  return prNumber;
}

function printUsage() {
  console.error(`Usage:
  node .opencode/skills/worktree-ux-pr/scripts/upload-pr-artifact.mjs \\
    --repo different-ai/openwork \\
    --pr 849 \\
    --label before \\
    [--title "Improve provider error UI"] \\
    /tmp/openwork-artifacts/before.png`);
}

export async function main(argv = process.argv.slice(2)) {
  await loadSkillEnv();
  const args = parseArgs(argv);
  const prNumber = await validateInputs({
    file: args.file,
    repo: args.repo,
    pr: args.pr,
    label: args.label,
    supabaseUrl: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  const result = await uploadAndRecordArtifact({
    artifactPath: args.file,
    repo: args.repo,
    prNumber,
    label: args.label,
    prTitle: args.title,
    supabaseUrl: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    bucket: process.env.SUPABASE_ARTIFACTS_BUCKET || 'pr-artifacts',
  });

  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    if (error instanceof MetadataInsertError) {
      console.error(
        JSON.stringify(
          {
            error: error.message,
            uploaded: error.uploaded,
          },
          null,
          2,
        ),
      );
      process.exit(1);
    }

    printUsage();
    console.error(error.message);
    process.exit(1);
  });
}
