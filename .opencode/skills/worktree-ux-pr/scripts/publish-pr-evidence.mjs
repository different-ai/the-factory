#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

import {
  createSupabaseHeaders,
  loadSkillEnv,
  trimTrailingSlash,
  uploadAndRecordArtifact,
} from './upload-pr-artifact.mjs';

const execFileAsync = promisify(execFile);

export const EVIDENCE_BLOCK_START = '<!-- pr-artifacts:evidence:start -->';
export const EVIDENCE_BLOCK_END = '<!-- pr-artifacts:evidence:end -->';

const SUPPORTED_TARGETS = new Set(['body', 'comment', 'none']);

export class PublishEvidenceError extends Error {
  constructor(message, partial = null) {
    super(message);
    this.name = 'PublishEvidenceError';
    this.partial = partial;
  }
}

function parseArgs(argv) {
  const values = {
    target: 'body',
    title: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected positional argument "${token}"`);
    }

    const key = token.slice(2);
    const value = argv[index + 1];
    if (value == null || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }

    values[key] = value;
    index += 1;
  }

  return values;
}

function printUsage() {
  console.error(`Usage:
  node .opencode/skills/worktree-ux-pr/scripts/publish-pr-evidence.mjs \\
    --repo different-ai/openwork \\
    --pr 414 \\
    [--title "Improve provider error UI"] \\
    [--target body|comment|none] \\
    [--before-image /tmp/openwork-artifacts/before.png] \\
    [--before-video /tmp/openwork-artifacts/before.mp4] \\
    [--after-image /tmp/openwork-artifacts/after.png] \\
    [--after-video /tmp/openwork-artifacts/after.mp4]`);
}

async function ensureReadable(filePath) {
  if (!filePath) return;
  await access(filePath, fsConstants.R_OK);
}

function ensureRequired(value, label) {
  if (!value) {
    throw new Error(`Missing required --${label}`);
  }
}

async function validateInputs(args) {
  ensureRequired(args.repo, 'repo');
  ensureRequired(args.pr, 'pr');

  const prNumber = Number.parseInt(args.pr, 10);
  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    throw new Error(`Invalid --pr value "${args.pr}"`);
  }

  if (!SUPPORTED_TARGETS.has(args.target)) {
    throw new Error(`Invalid --target value "${args.target}"`);
  }

  const mediaArgs = [
    args['before-image'],
    args['before-video'],
    args['after-image'],
    args['after-video'],
  ];

  if (!mediaArgs.some(Boolean)) {
    throw new Error(
      'Provide at least one of --before-image, --before-video, --after-image, or --after-video',
    );
  }

  await Promise.all(mediaArgs.filter(Boolean).map(ensureReadable));

  return prNumber;
}

function createFetchUrl(baseUrl, pathname, params = null) {
  const url = new URL(pathname, `${trimTrailingSlash(baseUrl)}/`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return url;
}

export async function verifyPublicUrl(publicUrl, fetchImpl = fetch) {
  let response = await fetchImpl(publicUrl, { method: 'HEAD' });
  if (response.status === 405 || response.status === 501) {
    response = await fetchImpl(publicUrl, { method: 'GET' });
  }

  if (!response.ok) {
    throw new Error(`Public URL check failed (${response.status}) for ${publicUrl}`);
  }
}

export async function verifyMetadataRecord({
  supabaseUrl,
  serviceRoleKey,
  objectPath,
  publicUrl,
  fetchImpl = fetch,
}) {
  const url = createFetchUrl(supabaseUrl, '/rest/v1/pr_artifacts', {
    select: 'id,object_path,public_url',
    object_path: `eq.${objectPath}`,
  });

  const response = await fetchImpl(url, {
    headers: createSupabaseHeaders(serviceRoleKey),
  });

  if (!response.ok) {
    throw new Error(`Metadata lookup failed (${response.status}) for ${objectPath}`);
  }

  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`No metadata row found for ${objectPath}`);
  }

  const record = rows[0];
  if (record.public_url !== publicUrl) {
    throw new Error(`Metadata row for ${objectPath} has unexpected public URL`);
  }

  return record;
}

export async function deletePublishedArtifact({
  supabaseUrl,
  serviceRoleKey,
  bucket,
  objectPath,
  fetchImpl = fetch,
}) {
  const deleteRowUrl = createFetchUrl(supabaseUrl, '/rest/v1/pr_artifacts', {
    object_path: `eq.${objectPath}`,
  });
  const rowResponse = await fetchImpl(deleteRowUrl, {
    method: 'DELETE',
    headers: createSupabaseHeaders(serviceRoleKey, {
      Prefer: 'return=minimal',
    }),
  });

  if (!rowResponse.ok) {
    throw new Error(`Failed to delete metadata row for ${objectPath} (${rowResponse.status})`);
  }

  const objectUrl = createFetchUrl(
    supabaseUrl,
    `/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`,
  );
  const objectResponse = await fetchImpl(objectUrl, {
    method: 'DELETE',
    headers: createSupabaseHeaders(serviceRoleKey),
  });

  if (!objectResponse.ok) {
    throw new Error(`Failed to delete storage object for ${objectPath} (${objectResponse.status})`);
  }
}

function sideTitle(side) {
  return side === 'before' ? 'Before' : 'After';
}

function renderSideBlock(side, artifacts) {
  if (!artifacts.image && !artifacts.preview && !artifacts.video) {
    return '';
  }

  const lines = [`### ${sideTitle(side)}`];

  if (artifacts.image) {
    lines.push(
      `${sideTitle(side)} screenshot stored in Supabase:`,
      '',
      `![${sideTitle(side)} screenshot](${artifacts.image.public_url})`,
      '',
    );
  }

  if (artifacts.preview) {
    lines.push(
      `${sideTitle(side)} video preview derived from the recorded video:`,
      '',
      `![${sideTitle(side)} video preview](${artifacts.preview.public_url})`,
      '',
    );
  }

  if (artifacts.video) {
    lines.push(`Full video: [${side} video](${artifacts.video.public_url})`, '');
  }

  return lines.join('\n').trimEnd();
}

export function renderEvidenceBlock({ repo, prNumber, artifacts }) {
  const lines = [
    EVIDENCE_BLOCK_START,
    '## Managed Evidence',
    '',
    `Generated by \`publish-pr-evidence.mjs\` for \`${repo}#${prNumber}\`. Replace by rerunning the publisher, not by editing this block manually.`,
    '',
  ];

  const beforeBlock = renderSideBlock('before', artifacts.before);
  const afterBlock = renderSideBlock('after', artifacts.after);

  if (beforeBlock) {
    lines.push(beforeBlock, '');
  }

  if (afterBlock) {
    lines.push(afterBlock, '');
  }

  lines.push(EVIDENCE_BLOCK_END);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

export function upsertManagedBlock(body, block) {
  const trimmedBody = body.trimEnd();
  const startIndex = trimmedBody.indexOf(EVIDENCE_BLOCK_START);
  const endIndex = trimmedBody.indexOf(EVIDENCE_BLOCK_END);

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const prefix = trimmedBody.slice(0, startIndex).trimEnd();
    const suffix = trimmedBody.slice(endIndex + EVIDENCE_BLOCK_END.length).trimStart();
    return [prefix, block, suffix].filter(Boolean).join('\n\n').trimEnd() + '\n';
  }

  return [trimmedBody, block].filter(Boolean).join('\n\n').trimEnd() + '\n';
}

async function makeJsonTempFile(prefix, value) {
  const tempDir = await mkdtemp(path.join(tmpdir(), prefix));
  const filePath = path.join(tempDir, 'payload.json');
  await writeFile(filePath, JSON.stringify(value));
  return {
    filePath,
    cleanup: () => rm(tempDir, { recursive: true, force: true }),
  };
}

async function updatePrBody({ repo, prNumber, block, execFileImpl = execFileAsync }) {
  const { stdout } = await execFileImpl('gh', [
    'pr',
    'view',
    String(prNumber),
    '--repo',
    repo,
    '--json',
    'body',
  ]);
  const currentBody = JSON.parse(stdout).body || '';
  const nextBody = upsertManagedBlock(currentBody, block);

  const tempDir = await mkdtemp(path.join(tmpdir(), 'pr-evidence-body-'));
  const bodyPath = path.join(tempDir, 'body.md');
  await writeFile(bodyPath, nextBody);

  try {
    await execFileImpl('gh', [
      'pr',
      'edit',
      String(prNumber),
      '--repo',
      repo,
      '--body-file',
      bodyPath,
    ]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function updatePrComment({ repo, prNumber, block, execFileImpl = execFileAsync }) {
  const { stdout } = await execFileImpl('gh', [
    'api',
    `repos/${repo}/issues/${prNumber}/comments`,
  ]);
  const comments = JSON.parse(stdout);
  const existingComment = comments.find(
    (comment) => typeof comment.body === 'string' && comment.body.includes(EVIDENCE_BLOCK_START),
  );
  const payload = await makeJsonTempFile('pr-evidence-comment-', { body: block });

  try {
    if (existingComment) {
      await execFileImpl('gh', [
        'api',
        `repos/${repo}/issues/comments/${existingComment.id}`,
        '--method',
        'PATCH',
        '--input',
        payload.filePath,
      ]);
      return;
    }

    await execFileImpl('gh', [
      'api',
      `repos/${repo}/issues/${prNumber}/comments`,
      '--method',
      'POST',
      '--input',
      payload.filePath,
    ]);
  } finally {
    await payload.cleanup();
  }
}

async function updatePrTarget({ repo, prNumber, target, block, execFileImpl = execFileAsync }) {
  if (target === 'none') {
    return;
  }

  if (target === 'body') {
    await updatePrBody({ repo, prNumber, block, execFileImpl });
    return;
  }

  await updatePrComment({ repo, prNumber, block, execFileImpl });
}

async function runPreviewGenerator({
  videoPath,
  previewPath,
  posterPath,
  execFileImpl = execFileAsync,
}) {
  const scriptPath = path.join(path.dirname(new URL(import.meta.url).pathname), 'make-video-preview.sh');
  await execFileImpl('bash', [scriptPath, videoPath, previewPath, posterPath]);
}

async function publishSingleArtifact({
  artifactPath,
  repo,
  prNumber,
  label,
  prTitle,
  supabaseUrl,
  serviceRoleKey,
  bucket,
  fetchImpl = fetch,
}) {
  const artifact = await uploadAndRecordArtifact({
    artifactPath,
    repo,
    prNumber,
    label,
    prTitle,
    supabaseUrl,
    serviceRoleKey,
    bucket,
    fetchImpl,
  });

  await verifyPublicUrl(artifact.public_url, fetchImpl);
  await verifyMetadataRecord({
    supabaseUrl,
    serviceRoleKey,
    objectPath: artifact.object_path,
    publicUrl: artifact.public_url,
    fetchImpl,
  });

  return artifact;
}

export async function publishEvidence({
  repo,
  prNumber,
  prTitle = null,
  beforeImage = null,
  beforeVideo = null,
  afterImage = null,
  afterVideo = null,
  target = 'body',
  supabaseUrl,
  serviceRoleKey,
  bucket = 'pr-artifacts',
  fetchImpl = fetch,
  execFileImpl = execFileAsync,
}) {
  if (!SUPPORTED_TARGETS.has(target)) {
    throw new Error(`Invalid target "${target}"`);
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), 'openwork-pr-evidence-'));
  const artifacts = {
    before: { image: null, preview: null, video: null },
    after: { image: null, preview: null, video: null },
  };

  try {
    for (const side of ['before', 'after']) {
      const imagePath = side === 'before' ? beforeImage : afterImage;
      const videoPath = side === 'before' ? beforeVideo : afterVideo;
      let uploadedImagePath = imagePath;

      if (videoPath) {
        const previewPath = path.join(tempDir, `${side}-preview.gif`);
        const posterPath = path.join(tempDir, `${side}-poster.png`);
        await runPreviewGenerator({
          videoPath,
          previewPath,
          posterPath,
          execFileImpl,
        });

        if (!uploadedImagePath) {
          uploadedImagePath = posterPath;
        }

        artifacts[side].preview = await publishSingleArtifact({
          artifactPath: previewPath,
          repo,
          prNumber,
          label: `${side}-preview`,
          prTitle,
          supabaseUrl,
          serviceRoleKey,
          bucket,
          fetchImpl,
        });

        artifacts[side].video = await publishSingleArtifact({
          artifactPath: videoPath,
          repo,
          prNumber,
          label: `${side}-video`,
          prTitle,
          supabaseUrl,
          serviceRoleKey,
          bucket,
          fetchImpl,
        });
      }

      if (uploadedImagePath) {
        artifacts[side].image = await publishSingleArtifact({
          artifactPath: uploadedImagePath,
          repo,
          prNumber,
          label: `${side}-image`,
          prTitle,
          supabaseUrl,
          serviceRoleKey,
          bucket,
          fetchImpl,
        });
      }
    }

    const block = renderEvidenceBlock({ repo, prNumber, artifacts });
    await updatePrTarget({
      repo,
      prNumber,
      target,
      block,
      execFileImpl,
    });

    return {
      repo,
      pr_number: prNumber,
      target,
      block,
      artifacts,
    };
  } catch (error) {
    throw new PublishEvidenceError(error.message, {
      repo,
      pr_number: prNumber,
      target,
      artifacts,
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function main(argv = process.argv.slice(2)) {
  await loadSkillEnv();
  const args = parseArgs(argv);
  const prNumber = await validateInputs(args);

  if (!process.env.SUPABASE_URL) {
    throw new Error('SUPABASE_URL is required');
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  }

  const result = await publishEvidence({
    repo: args.repo,
    prNumber,
    prTitle: args.title,
    beforeImage: args['before-image'],
    beforeVideo: args['before-video'],
    afterImage: args['after-image'],
    afterVideo: args['after-video'],
    target: args.target,
    supabaseUrl: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    bucket: process.env.SUPABASE_ARTIFACTS_BUCKET || 'pr-artifacts',
  });

  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    if (error instanceof PublishEvidenceError) {
      console.error(
        JSON.stringify(
          {
            error: error.message,
            partial: error.partial,
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
