import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildObjectPath,
  inferArtifactKind,
  uploadAndRecordArtifact,
} from './upload-pr-artifact.mjs';

test('buildObjectPath nests artifacts by repo and PR number', () => {
  const objectPath = buildObjectPath({
    repo: 'different-ai/openwork',
    prNumber: 849,
    label: 'before',
    originalFilename: 'chat state.png',
    timestamp: new Date('2026-03-11T20:16:00.000Z'),
  });

  assert.equal(
    objectPath,
    'different-ai-openwork/pr-849/before-20260311T201600Z-chat-state.png',
  );
});

test('inferArtifactKind recognizes images and videos', () => {
  assert.equal(inferArtifactKind('/tmp/before.png'), 'image');
  assert.equal(inferArtifactKind('/tmp/flow-video.mp4'), 'video');
});

test('uploadAndRecordArtifact surfaces uploaded URL when metadata insert fails', async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'pr-artifact-test-'));
  const artifactPath = path.join(tempDir, 'before.png');
  await writeFile(artifactPath, 'fake-image');

  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url, options });

    if (String(url).includes('/storage/v1/object/')) {
      return new Response(JSON.stringify({ Key: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (String(url).includes('/rest/v1/pr_artifacts')) {
      return new Response(JSON.stringify({ message: 'db insert failed' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    }

    throw new Error(`Unexpected URL: ${url}`);
  };

  await assert.rejects(
    () =>
      uploadAndRecordArtifact({
        artifactPath,
        repo: 'different-ai/openwork',
        prNumber: 849,
        label: 'before',
        prTitle: 'Improve provider error UI',
        supabaseUrl: 'https://example.supabase.co',
        serviceRoleKey: 'service-role',
        bucket: 'pr-artifacts',
        timestamp: new Date('2026-03-11T20:16:00.000Z'),
        fetchImpl,
      }),
    (error) => {
      assert.equal(error.name, 'MetadataInsertError');
      assert.equal(
        error.uploaded.publicUrl,
        'https://example.supabase.co/storage/v1/object/public/pr-artifacts/different-ai-openwork/pr-849/before-20260311T201600Z-before.png',
      );
      return true;
    },
  );

  assert.equal(requests.length, 2);
  assert.match(String(requests[0].url), /\/storage\/v1\/object\/pr-artifacts\//);
  assert.match(String(requests[1].url), /\/rest\/v1\/pr_artifacts$/);
});
