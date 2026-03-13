import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import test from 'node:test';
import { promisify } from 'node:util';

import { loadSkillEnv } from './upload-pr-artifact.mjs';
import { deletePublishedArtifact, publishEvidence } from './publish-pr-evidence.mjs';

const execFileAsync = promisify(execFile);

function hasConfiguredEnv() {
  return (
    Boolean(process.env.SUPABASE_URL) &&
    !process.env.SUPABASE_URL.includes('your-project-ref') &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) &&
    !process.env.SUPABASE_SERVICE_ROLE_KEY.includes('your-service-role-key')
  );
}

test('publishEvidence uploads real assets to Supabase and cleans them up', async (t) => {
  await loadSkillEnv();

  if (!hasConfiguredEnv()) {
    t.skip('Set .opencode/skills/worktree-ux-pr/.env with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    return;
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), 'openwork-pr-evidence-e2e-'));
  const beforeImage = path.join(tempDir, 'before.png');
  const afterVideo = path.join(tempDir, 'after.mp4');
  const uploadedArtifacts = [];

  t.after(async () => {
    await Promise.all(
      uploadedArtifacts.map((artifact) =>
        deletePublishedArtifact({
          supabaseUrl: process.env.SUPABASE_URL,
          serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          bucket: process.env.SUPABASE_ARTIFACTS_BUCKET || 'pr-artifacts',
          objectPath: artifact.object_path,
        }),
      ),
    );
    await rm(tempDir, { recursive: true, force: true });
  });

  await execFileAsync('ffmpeg', [
    '-y',
    '-f',
    'lavfi',
    '-i',
    'color=c=blue:s=640x360:d=1',
    '-frames:v',
    '1',
    beforeImage,
  ]);

  await execFileAsync('ffmpeg', [
    '-y',
    '-f',
    'lavfi',
    '-i',
    'color=c=red:s=640x360:d=1',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    afterVideo,
  ]);

  const result = await publishEvidence({
    repo: 'different-ai/the-factory-e2e',
    prNumber: 999999,
    prTitle: 'PR evidence e2e',
    beforeImage,
    afterVideo,
    target: 'none',
    supabaseUrl: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    bucket: process.env.SUPABASE_ARTIFACTS_BUCKET || 'pr-artifacts',
  });

  for (const sideArtifacts of Object.values(result.artifacts)) {
    for (const artifact of Object.values(sideArtifacts)) {
      if (artifact) {
        uploadedArtifacts.push(artifact);
      }
    }
  }

  assert.ok(result.block.includes('Managed Evidence'));
  assert.ok(uploadedArtifacts.length >= 3);
  assert.ok(uploadedArtifacts.every((artifact) => artifact.public_url.startsWith(process.env.SUPABASE_URL)));
});
