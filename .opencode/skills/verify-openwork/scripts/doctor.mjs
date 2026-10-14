#!/usr/bin/env node
// Read-only inspection of one locally owned preview. No commands, focus, or writes.
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [repoArg, stage] = process.argv.slice(2);
if (!repoArg || !stage || !/^[a-z0-9-]+$/.test(stage)) {
  throw new Error('Usage: doctor.mjs REPO_ROOT STAGE (lowercase letters, digits, hyphens)');
}
const repo = realpathSync(repoArg);
const name = `preview-desktop--${stage}`;
const base = join(repo, 'evals/results/.worlds/scripts', name);
const receipt = JSON.parse(readFileSync(`${base}.json`, 'utf8'));
const ledger = readFileSync(`${base}.ledger.jsonl`, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const check = (ok, reason) => { if (!ok) throw new Error(reason); };
check(receipt.name === name && receipt.stage === stage && receipt.place === 'local' && receipt.os === 'macos', 'Not the requested local macOS preview');
check(resolve(receipt.sourcePath) === join(repo, 'worlds/preview-desktop.ts'), 'Receipt belongs to another checkout');
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
check(receipt.outputs.ref === sha, 'Source HEAD changed: stop this stage and launch a new one');
const processRows = execFileSync('ps', ['-axo', 'pid=,ppid=,pgid=,command='], { encoding: 'utf8' }).trim().split('\n').map(line => {
  const match = line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/);
  return match ? { pid: Number(match[1]), ppid: Number(match[2]), pgid: Number(match[3]), command: match[4] } : null;
}).filter(Boolean);
const processes = new Map(processRows.map(row => [row.pid, row]));
check(processes.get(receipt.pid)?.command.includes(receipt.sourcePath), 'World PID is dead or no longer belongs to this receipt');
const url = new URL(receipt.outputs.cdp);
check(url.protocol === 'http:' && url.hostname === '127.0.0.1' && Number(url.port) > 0, 'Refusing a non-loopback CDP endpoint');
const listeners = execFileSync('lsof', ['-nP', `-iTCP:${url.port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' }).trim().split('\n').map(Number);
const ownedRoots = ledger.filter(entry => entry.kind === 'process').map(entry => Number(entry.id));
check(listeners.length > 0 && listeners.every(pid => {
  const seen = new Set();
  while (pid && !seen.has(pid)) {
    if (pid === receipt.pid || ownedRoots.includes(pid)) return true;
    seen.add(pid);
    pid = processes.get(pid)?.ppid;
  }
  return false;
}), 'CDP port is not owned by the receipt process tree');
const profile = ledger.find(entry => entry.kind === 'tmpdir' && entry.label === 'electron-profile')?.id;
check(profile && realpathSync(profile).startsWith(`${repo}/evals/results/.surfaces/`) && existsSync(profile), 'Missing isolated profile or unexpected surfaces override; inspect ownership manually');
const { attachSurface, evaluateOnSurface } = await import(pathToFileURL(join(repo, 'evals/packages/cdp/src/index.ts')).href);
const surface = await attachSurface({ name, kind: 'electron', hostKind: 'local', cdpUrl: url.origin }, { timeoutMs: 15000 });
let ui;
try {
  ui = await evaluateOnSurface(surface, () => ({
    title: document.title,
    readyState: document.readyState,
    path: location.pathname,
    controlReady: typeof window.__openworkControl === 'object' && window.__openworkControl !== null,
    bodyPresent: Boolean(document.body?.innerText.trim()),
    composerPresent: Boolean(document.querySelector('[contenteditable="true"][data-lexical-editor="true"][role="textbox"]')),
    composerFocused: Boolean(document.activeElement?.matches('[contenteditable="true"][data-lexical-editor="true"][role="textbox"]')),
  }), { timeoutMs: 15000, reattachAttempts: 0 });
} finally { await surface.stop(); }
check(ui.readyState === 'complete' && ui.bodyPresent && ui.controlReady, 'Renderer is not ready to drive; inspect the screen before proceeding');
console.log(JSON.stringify({ ok: true, source: sha, stage, surface: 'native-macos-electron', ownedListener: true, isolatedProfile: true, auth: 'signed-out standalone; no Den or provider credentials seeded', ui }, null, 2));
