# Local storage manager

A macOS maintenance program for a single explicitly selected APFS external volume.
It does not modify OpenWork/OpenCode conversation databases or session archives.

## Policy

- Offload an explicit cache allowlist to the external volume; retain original paths as symlinks.
- After 2 days without source/admin modifications, offload eligible **clean** linked Git worktrees.
- Running/open-file, dirty, locked, primary/protected, submodule-containing, and externally linked worktrees are skipped.
- Omit only Git-ignored `node_modules` and `.next` folders. Resuming development may require reinstalling dependencies/rebuilding.
- At 30 days of source inactivity, retire the external checkout behind a verified, immutable compressed source snapshot. Retain ignored local files and pin the current Git HEAD in the primary repository. Leave restoration instructions at the original path. A quarantined checkout is retained for one further day before removal; new writes, changed commits, open files, or incomplete deletion preserve it rather than overwriting the good snapshot.
- Source snapshots and conversation history are **not automatically deleted**.
- Original worktree paths remain usable through symlinks until retirement. After retirement, restoration is explicit; this is not a transparent filesystem tier.
- Source/archive files can contain private data. External folders/manifests are private to the current user by default. This is not encryption and does not replace a backup.

## Safety and limitations

The volume must be mounted, writable, APFS, and have the configured UUID. The manager pauses when it is absent; already offloaded files are unavailable while the drive is disconnected. Never create a fallback directory under `/Volumes`.

Copies are checksum-verified. Source inventories detect concurrent edits, including ignored files. The original is renamed on its own filesystem before the final copy verification. The filesystem is flushed and the volume rechecked before deleting local data. Interrupted worktree renames and retirement steps have conservative recovery paths; ambiguous states are preserved and logged rather than forcibly deleted.

Activity is estimated from source/admin modification times and visible processes/open files, **not guaranteed conversation read activity**. No filesystem scanner can prove that an idle chat has not recently read a file. This manager preserves recoverable source rather than destructively deleting it. OS process visibility is limited to what the current user can enumerate. Main repositories and explicitly protected paths remain internal.

Git history remains in the original primary repository. Source snapshots are not standalone full-repository backups: keep that repository or its remote. Pinned detached commits are protected from normal Git GC in that primary repository.

A single-instance lock prevents overlapping runs. Each batch is limited to four worktree moves and a ten-minute scanning budget (an in-progress verified copy may take longer).

## Commands

```sh
python3 storage_manager.py --config /path/to/config.json check           # temporary read/write probe only
python3 storage_manager.py --config /path/to/config.json run             # preview
python3 storage_manager.py --config /path/to/config.json --apply run     # apply
python3 storage_manager.py --config /path/to/config.json --apply caches
python3 storage_manager.py --config /path/to/config.json --apply worktrees
python3 storage_manager.py --config /path/to/config.json restore ARCHIVE_ID
python3 -m unittest discover -s storage-manager -v
```

The local configuration contains `mount`, `volume_uuid`, `archive_root`, `archive_after_days`, `delete_after_days`, `repos`, `protected`, `caches`, `lock`, `installed_script`, and `config_path`. Keep host-specific configuration outside Git. `max_archives_per_run` and `scan_budget_seconds` are optional limits.

## macOS installation

Install the reviewed script to a stable user-owned path outside any managed worktree. Install a LaunchAgent with explicit Python and script/config paths, `StartInterval: 3600`, `RunAtLoad: true`, `WatchPaths: ["/Volumes"]`, a low CPU priority, and stdout/stderr log paths. Validate with `plutil -lint`, then `launchctl bootstrap gui/UID ...`; inspect its live registration with `launchctl print`.

It runs when this user is logged in and the Mac is awake; it does not require OpenWork to be running. The initial batch should be run and inspected before installing the job.

Do not run the job with Apple's own Python (`/usr/bin/python3` or the Command Line Tools `Python.app`). Both are Apple platform binaries: macOS never prompts for, and never records, removable-volume access for them (`tccd` logs `Platform binary prompting is 'Deny'`), so the job is denied with `Operation not permitted` no matter what is toggled in System Settings. Use a non-Apple interpreter by absolute path, such as Homebrew's `/opt/homebrew/opt/python@3.x/bin/python3.x`. On its first run from launchd macOS shows the standard "would like to access files on a removable volume" prompt; the user approves it once. The grant is tied to the interpreter's installed path, so a Homebrew Python upgrade to a new version directory can prompt again. Do not change TCC databases, borrow another application's access, or grant Full Disk Access as a workaround. A terminal test is not proof of the LaunchAgent's access; test the registered job itself.

The script avoids `plistlib` (it reads `diskutil` output through `plutil`) because some Homebrew Python builds ship a `pyexpat` that cannot load against the system `libexpat`.

Apply/restore runs perform a temporary-file read/write access check before any data moves. A blocked drive or failed maintenance step returns exit code 1 and records a `blocked`/`error` result, rather than falsely reporting success. An absent expected volume or an overlapping run is a normal pause. The `check` command performs only this access probe and moves no user data.

## Conversation archival research (installed OpenCode v2.2.0)

The first-party `PATCH /api/session/{sessionID}` with `{"archived": true}` preserves the session inside the live database; it does not reclaim disk space. First-party session export/import exists, including attachment hydration, but each child session must be exported separately. Export is a projected transcript, not a full-state backup. OpenWork does not natively search a directory of external JSON exports.

An export-then-delete job therefore cannot satisfy transparent history access and is intentionally not implemented. Whole-store relocation requires a separate, verified, offline migration of the correct engine's store. Do not move, symlink, edit, vacuum, or delete a running SQLite database (including its WAL/SHM siblings).

References: https://opencode.ai/v2/docs/api and upstream v2.2.0 `packages/core/src/session/transfer.ts`, `packages/core/src/session/projector.ts`, and `packages/cli/src/database-path.ts`.
