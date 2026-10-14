---
name: verify-openwork
description: |
  Verify OpenWork's primary native desktop surface on an isolated local macOS instance using the existing @openwork/testkit agent-first harness. Use when asked to "verify OpenWork", "prove a desktop journey", or "check the OpenWork feature map"; note separate MCP gateway and Den requirements.
---

# Verify OpenWork

Read [features/README.md](features/README.md) first; select the feature and entry point, not a convenient substitute. This skill lives in the enterprise `.opencode/skills` directory. Commands below start at the enterprise root, whose product checkout is `_repos/openwork`. Stay on this computer when local verification is requested. Never delegate the drive to a remote session.

The product is a local-first desktop app for doing work with AI on your files. Secondary surfaces are the **MCP gateway** (`ee/apps/den-api`, `/mcp/agent`, capability search/execution) and **Den** (`ee/apps/den-*`, team/org control plane). A standalone desktop proof does not verify those surfaces, sign-in, live models, Windows/Linux, or packaged release bytes.

## Launch

1. Inspect `git status --short --branch --ignore-submodules=all` here and `git -C _repos/openwork status --short --branch`. Preserve user work. A symlinked product checkout is not a normal submodule: do not replace it, run recursive submodule updates, reset, stash user changes, or repin it to make this skill work. Use a dedicated task worktree of each repository, fetched without submodule recursion, and report both HEADs. No commit/push/PR unless requested.
2. Read product `AGENTS.md`, `.opencode/skills/run-tests/SKILL.md`, `preview-my-work/SKILL.md`, `write-a-spec/SKILL.md`; for a red run read `diagnose-a-red-run/SKILL.md` before changing anything. Product root `ARCHITECTURE.md` was absent at the source revision below; the actual route/control architecture is `apps/app/src/react-app/ARCHITECTURE.md`.
3. Requirements: Node 24 (README/.nvmrc), pnpm 11.4.0, macOS GUI login session and Xcode command-line tools for native dependencies/signing. Do not source personal `.env` files or inject org secrets. Prepare both separate workspaces:

   ```sh
   pnpm -C _repos/openwork install --frozen-lockfile
   pnpm -C _repos/openwork --dir evals install --frozen-lockfile
   pnpm -C _repos/openwork world help preview-desktop --json
   ```

4. Choose a **new** lowercase stage for each independent run; keep the same shell variables for doctor and cleanup:

   ```sh
   export VERIFY_STAGE="verify-openwork-$(date +%Y%m%d%H%M%S)-$$"
   export VERIFY_PROOF="$PWD/outputs/verify-openwork/$VERIFY_STAGE"
   mkdir -p "$VERIFY_PROOF"
   pnpm -C _repos/openwork world plan preview-desktop --place local --stage "$VERIFY_STAGE"
   pnpm -C _repos/openwork world up preview-desktop --place local --stage "$VERIFY_STAGE" --detach --timeout 600000
   pnpm -C _repos/openwork world outputs preview-desktop --stage "$VERIFY_STAGE" --json
   ```

`preview-desktop` → `standaloneApp` uses the existing host/AsyncDisposableStack lifecycle: new profile, isolated HOME/XDG/app/server config, free Vite/CDP ports, mock keychain, no Den account, no seed workspace. Source/sidecars/native workspace preparation can take minutes. Readiness is the completed `up`, `alive: true`, correct source `ref`, then **Doctor**, not merely a TCP listener. A first-run UI is usable for settings/workspace navigation, not authenticated model chat. Do not fabricate credentials or bypass onboarding. Creating a workspace is a user action, not launch seeding.

This opens a separate native window; use only when explicitly requested or verifying a native capability. Ordinary UI work defaults to headless `seed.appWeb` per product AGENTS.md. Never use `live-desktop --allow-shared-state`, bare `pnpm dev`, installed `/Applications/OpenWork.app`, port 9823, or production profile/database paths for this proof. Do not change global browser-tool configuration to point at the user's desktop.

For other surfaces, inspect `pnpm -C _repos/openwork world help preview-den --json` / `preview-full --json` before launching. Local Den needs MySQL/Redis and built workspace packages (`run-tests`); do not start/stop a shared database automatically. No Den is needed for the standalone smoke below.

## Doctor

One bounded **read-only** check before driving this preview and after anything surprising:

```sh
node .opencode/skills/verify-openwork/scripts/doctor.mjs _repos/openwork "$VERIFY_STAGE" > "$VERIFY_PROOF/doctor.json"
```

Exit 0 requires the exact local/macOS world receipt and current source HEAD; the world process command matches this checkout; the dynamic CDP listener descends from the receipt's recorded process tree; its disposable profile exists below this checkout's default `.surfaces`; and the renderer has body content and the existing control rail. It reports route/composer/focus without typing, navigating, focusing, setting storage, executing control commands, or contacting Den. It disconnects its inspection socket. The auth baseline is explicitly signed-out standalone, **not** a validated Den/provider session. A reused/custom surfaces override intentionally fails closed: inspect ownership rather than weakening the check.

A healthy process with a wedged UI is not usable: inspect the failed artifacts, clean up that owned stage, relaunch and doctor again. Never switch to the user's working desktop. Testkit-managed worlds have independent ownership/readiness; a doctor of this preview is not permission to attach a spec to another CDP port.

## Drive

Use `@openwork/testkit`, not a new browser/HTTP harness. Feature maps name existing specs and the exact stable user targets. `pnpm evals:e2e` owns the local placement decision, cold launch, ready gate, world binding and disposal. `--surface` only validates a declared world; it does **not** convert a web test to Electron. Do not label headless proof as native.

Initial proof target: [workspace approval mode](features/workspace-approval-mode.md). Run exactly this after the preview doctor; it cold-boots its **own** isolated native fixture, performs its own read-only baseline doctor before permission-changing input, and automatically disposes that fixture:

```sh
OPENWORK_EVAL_SURFACE_LOGS_DIR="$VERIFY_PROOF/surface-logs" \
  pnpm -C _repos/openwork evals:e2e composer-run-mode --local --engine v1 --surface electron \
  > "$VERIFY_PROOF/drive.log" 2>&1
```

Read `drive.log` and record its exit status immediately. The expected named test count is 1 passed / 0 failed / 0 skipped, with 7 passed steps and no pending assertions; actual counts, not this expectation, determine the verdict. A process failure before any test is **Failed/blocked**, never a pass. Run the feature's whole journey, including cancel/defaults/hide; do not stop after the first happy path.

Channels: `seed` arranges fixtures **before** acts; `user.click/type/press/reload/see/screenshot` is real trusted input; `agent` uses the product's existing `window.__openworkControl` automation rail; `probe` observes (GET/DOM/storage); `step` and ambient `evidence.recordAssertionEvidence` record claims. No product-state setters, invented control actions, seed-after-act shortcuts, or assertions of prose alone. Extend an existing journey only when it lacks a necessary claim; this docs task does not change app behavior.

For interactive exploration use product `drive-desktop-cdp`, with CDP read privately from **this stage's** owner-only receipt, never a guessed port. Its `eval` is not a replacement for testkit verdicts. No browser MCP connection in this environment has been established as targeting this owned instance; do not use an ambient desktop MCP connection speculatively.

## Evidence

Proof must include the feature ID and entry point, exact command/placement line, both source HEADs, exit code and passed/failed/skipped counts; action **and** resulting screen; and an independent read-only observation of durable/observable side effects. New task/workspace claims require the canonical `/workspace/:workspaceId/session/:sessionId` route with both IDs resolved, an empty ready composer and active element `[contenteditable="true"][data-lexical-editor="true"][role="textbox"]`, not just a changed URL. A mapped but unexercised entry point stays unverified.

Existing ambient evidence lives under `_repos/openwork/evals/results/test-runs/`: `test-run.json`, `index.html`, numbered PNGs, layout JSON, steps, traces and machine assertions. Inspect the actual images and captions. Screenshots explain assertions, never replace them. Pending `looks()` judgments or skips mean **Incomplete**, even with exit 0. Named skipped tests exit 2. Keep failures and not-reached steps; never weaken a journey to pass.

Keep durable proof in `$VERIFY_PROOF` (`outputs/` is ignored), **outside** disposable profiles and `.surfaces`. Copy the newly produced run directories there before removing scratch state. After the initial approval-mode command, this copies only matching records created since this run's doctor and writes a SHA-256 manifest; run it from the enterprise root:

```sh
python3 - "$VERIFY_PROOF" <<'PY'
from pathlib import Path
import sys, json, shutil, hashlib
proof = Path(sys.argv[1]).resolve()
cutoff = (proof / 'doctor.json').stat().st_mtime
runs = Path('_repos/openwork/evals/results/test-runs')
copied = []
for record in runs.glob('*/test-run.json'):
    data = json.loads(record.read_text())
    if record.stat().st_mtime >= cutoff and str(data.get('specFile', '')).endswith('composer-run-mode.e2e.test.ts'):
        dest = proof / 'test-runs' / record.parent.name
        shutil.copytree(record.parent, dest)
        copied.append(dest)
assert copied, 'No matching test evidence; preserve logs and report failure'
files = [p for d in copied for p in d.rglob('*') if p.is_file()]
manifest = {str(p.relative_to(proof)): hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
(proof / 'evidence-sha256.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'Saved {len(copied)} run(s), {len(files)} files')
PY
```

Do not rerun that copy into an existing destination or overwrite a prior proof: choose a fresh proof directory. Never copy owner-only world receipts wholesale; they can contain tokens/URLs. Do not save environment dumps, credentials, customer names or production data in repo artifacts. Surface logs are optional and potentially sensitive: use the existing `OPENWORK_EVAL_SURFACE_LOGS_DIR` outside `.surfaces`, review before sharing. A dry-run flag is not a network guarantee; this flow downloads dependencies/sidecars during preparation, but standalone drives must not send model/provider requests. No publishing/upload commands are part of this skill.

## Cleanup

Always stop the **exact stage this run created**, including after any failed attempt:

```sh
pnpm -C _repos/openwork world down preview-desktop --stage "$VERIFY_STAGE"
pnpm -C _repos/openwork world outputs preview-desktop --stage "$VERIFY_STAGE" --json
```

Require `exists: false` (the current `world outputs` command intentionally exits **1** when absent; that is expected after successful teardown; pnpm can append an `ELIFECYCLE` note after the JSON), recorded CDP listener/process group gone and the recorded disposable profile removed. The world stack disposes owned children and profile state; it does not own the user's desktop. For testkit specs, disposal runs even on test failure; independently check that their recorded profile/listener is gone.

**Observed harness gap:** `emptyDesktopSession`'s `seed.tmpPath("empty-session")` workspace can survive profile disposal. Remove only the exact workspace recorded by this run's `seed.workspace` trace, after its processes have stopped; never glob `/tmp/openwork-*`. The current fixture creates its scratch workspace under `/tmp` regardless of this host's preferred temporary root. For the approval-mode proof, this narrow cleanup refuses symlinks, unfamiliar contents and running processes, and touches no evidence:

```sh
python3 - "$VERIFY_PROOF" <<'PY'
from pathlib import Path
import sys, json, re, subprocess, shutil
proof = Path(sys.argv[1])
processes = subprocess.check_output(['ps', '-axo', 'command='], text=True)
for record in (proof / 'test-runs').glob('*/test-run.json'):
    data = json.loads(record.read_text())
    assert str(data.get('specFile', '')).endswith('composer-run-mode.e2e.test.ts')
    for trace in data['trace']:
        if trace.get('stage') != 'world' or trace.get('channel') != 'seed' or trace.get('verb') != 'workspace' or not trace.get('ok'):
            continue
        match = re.fullmatch(r'workspace\((/tmp/openwork-empty-session-[0-9]+)\)', trace['detail'])
        assert match, 'Unexpected fixture path: inspect before deleting'
        path = Path(match[1])
        assert str(path) not in processes, 'Fixture may still be in use'
        assert not path.is_symlink(), 'Refusing a symlinked fixture'
        if path.exists():
            assert path.parent.resolve() == Path('/private/tmp')
            assert all(p.is_file() and not p.is_symlink() and p.name in {'opencode.json', 'opencode.jsonc'} for p in path.iterdir()), 'Unexpected fixture contents: inspect manually'
            shutil.rmtree(path)
        assert not path.exists()
        print('Removed owned fixture workspace:', path.name)
PY
```

If teardown fails, preserve evidence and report the precise owned residue; inspect its receipt/ledger before any targeted repair. Never `pkill`, `killall`, kill by process name, kill an arbitrary port listener, remove shared DBs or recursively delete all eval results. Do not delete this task's worktrees or installed build prerequisites as part of instance teardown.

After teardown, check saved `test-run.json`, HTML and nonempty PNGs still exist in `$VERIFY_PROOF`, including the manifest written above:

```sh
python3 - "$VERIFY_PROOF" <<'PY'
from pathlib import Path
import sys, json, hashlib
proof = Path(sys.argv[1])
manifest = json.loads((proof / 'evidence-sha256.json').read_text())
assert manifest
for name, digest in manifest.items():
    p = proof / name
    assert p.is_file() and p.stat().st_size and hashlib.sha256(p.read_bytes()).hexdigest() == digest, name
assert list((proof / 'test-runs').glob('*/test-run.json'))
assert list((proof / 'test-runs').glob('*/index.html'))
assert list((proof / 'test-runs').rglob('*.png'))
print(f'PASS: {len(manifest)} evidence files survive cleanup unchanged')
PY
```
Cleanup that removes proof is a failed verification. Retain red artifacts as well as green ones. Do not commit/push or open a PR automatically.

## Helpers

- `scripts/doctor.mjs` is executable; invocation is shown above. It only inspects one owned preview and uses the repo's existing `@openwork/cdp` implementation for a read-only renderer query. It is not another drive harness.
- `.env.example` documents that no credentials are required; `.env` is ignored and is neither needed nor created.
- Product source anchors: `worlds/preview-desktop.ts`, `worlds/lib/preview.ts`, `evals/packages/hosts/src/local.ts`, `evals/packages/testkit/src/index.ts`, `evals/README.md` and the specs linked in the feature map.

Generated by following upstream [pstack create-verification-skill](https://github.com/backnotprop/pstack/tree/main/skills/create-verification-skill), including all `references/feature-map-example` files (path commit `fce11a3442cfd59a21136de0b7010474c6a10ef5`). Grounded against OpenWork `e1a9590a2954c6a2540951874f5273b4a927263f`, not a permanent compatibility guarantee. Use `/maintain-verification-skill` for future source-and-live map upkeep; installation of that upstream command is not implied. It must retain the user's no-commit/no-PR restriction unless separately authorized.
