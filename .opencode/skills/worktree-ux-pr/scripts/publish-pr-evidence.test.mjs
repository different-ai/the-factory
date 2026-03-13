import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EVIDENCE_BLOCK_END,
  EVIDENCE_BLOCK_START,
  renderEvidenceBlock,
  upsertManagedBlock,
} from './publish-pr-evidence.mjs';

test('upsertManagedBlock appends a managed block when one does not exist', () => {
  const original = '# Summary\nExisting body';
  const block = `${EVIDENCE_BLOCK_START}\nmanaged\n${EVIDENCE_BLOCK_END}`;
  const nextBody = upsertManagedBlock(original, block);

  assert.match(nextBody, /# Summary/);
  assert.match(nextBody, /managed/);
  assert.match(nextBody, new RegExp(`${EVIDENCE_BLOCK_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
});

test('upsertManagedBlock replaces the existing managed block in place', () => {
  const original = [
    '# Summary',
    '',
    EVIDENCE_BLOCK_START,
    'old block',
    EVIDENCE_BLOCK_END,
    '',
    'tail',
  ].join('\n');
  const block = `${EVIDENCE_BLOCK_START}\nnew block\n${EVIDENCE_BLOCK_END}`;
  const nextBody = upsertManagedBlock(original, block);

  assert.doesNotMatch(nextBody, /old block/);
  assert.match(nextBody, /new block/);
  assert.match(nextBody, /tail/);
});

test('renderEvidenceBlock includes before and after Supabase URLs', () => {
  const block = renderEvidenceBlock({
    repo: 'different-ai/openwork',
    prNumber: 414,
    artifacts: {
      before: {
        image: { public_url: 'https://example.com/before.png' },
        preview: { public_url: 'https://example.com/before.gif' },
        video: { public_url: 'https://example.com/before.mp4' },
      },
      after: {
        image: { public_url: 'https://example.com/after.png' },
        preview: null,
        video: null,
      },
    },
  });

  assert.match(block, /Managed Evidence/);
  assert.match(block, /https:\/\/example.com\/before.png/);
  assert.match(block, /https:\/\/example.com\/before.gif/);
  assert.match(block, /https:\/\/example.com\/before.mp4/);
  assert.match(block, /https:\/\/example.com\/after.png/);
});
