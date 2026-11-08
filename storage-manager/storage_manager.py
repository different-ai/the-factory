#!/usr/bin/env python3
"""Local, volume-bound cold storage. Never edits or deletes conversation stores."""
import argparse
import contextlib
import fcntl
import hashlib
import json
import os
from pathlib import Path
import plistlib
import shutil
import subprocess
import sys
import tarfile
import time

DAY = 86400
GENERATED = {"node_modules", ".next"}
ERROR_COUNT = 0


def run(args, check=True, timeout=300):
    return subprocess.run([str(a) for a in args], text=True, capture_output=True,
                          check=check, timeout=timeout)


def git(path, *args, check=True):
    return run(["git", "--no-optional-locks", "-C", path, *args], check=check)


def save(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    temp = path.with_name(path.name + ".tmp")
    with temp.open("w") as stream:
        json.dump(data, stream, indent=2)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())
    os.chmod(temp, 0o600)
    os.replace(temp, path)
    descriptor = os.open(path.parent, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def emit(event, **fields):
    global ERROR_COUNT
    if event.endswith("_error"):
        ERROR_COUNT += 1
    print(json.dumps({"time": time.time(), "event": event, **fields}), flush=True)


def volume_ready(config):
    mount = Path(config["mount"])
    if not mount.is_mount():
        return False
    result = run(["diskutil", "info", "-plist", mount], check=False)
    if result.returncode:
        return False
    info = plistlib.loads(result.stdout.encode())
    return (info.get("VolumeUUID") == config["volume_uuid"]
            and info.get("Writable") is True
            and info.get("FilesystemType") == "apfs")


def busy(path):
    """Conservative: refuse if any process command, cwd or open file references it."""
    needle = str(path)
    processes = run(["ps", "-axo", "pid=,command="]).stdout
    for line in processes.splitlines():
        pid, _, command = line.strip().partition(" ")
        if pid != str(os.getpid()) and needle in command:
            return True
    result = run(["lsof", "-n", "-P", "-F", "pn"], check=False, timeout=45)
    if result.returncode not in (0, 1) or result.stderr.strip():
        raise RuntimeError("Cannot fully verify open files; refusing mutation")
    return any(line[1:] == needle or line[1:].startswith(needle + "/")
               for line in result.stdout.splitlines() if line.startswith("n"))


def ignored_generated(path):
    result = git(path, "ls-files", "--others", "--ignored", "--exclude-standard", "--directory", "-z")
    return sorted(entry.rstrip("/") for entry in result.stdout.split("\0")
                  if entry.endswith("/") and Path(entry.rstrip("/")).name in GENERATED)


def raise_walk_error(error):
    raise error


def activity(path, excluded=()):
    """Latest source/worktree administrative modification; never uses access times."""
    path = Path(path)
    latest = path.stat().st_mtime
    excluded = set(excluded)
    for root, dirs, files in os.walk(path, followlinks=False, onerror=raise_walk_error):
        rel = Path(root).relative_to(path)
        dirs[:] = [name for name in dirs if name != ".git"
                   and str(rel / name) not in excluded]
        for name in files:
            try:
                latest = max(latest, (Path(root) / name).lstat().st_mtime)
            except FileNotFoundError:
                raise RuntimeError("Worktree changed during activity scan")
    gitdir = git(path, "rev-parse", "--absolute-git-dir").stdout.strip()
    for rel in ("index", "logs/HEAD", "HEAD"):
        candidate = Path(gitdir) / rel
        if candidate.exists():
            latest = max(latest, candidate.stat().st_mtime)
    return latest


def source_state(path, excluded=()):
    """Detect additions and concurrent edits, including ignored personal files."""
    result = {}
    path = Path(path)
    excluded = set(excluded)
    for root, dirs, files in os.walk(path, followlinks=False, onerror=raise_walk_error):
        rel = Path(root).relative_to(path)
        dirs[:] = [name for name in dirs if name != ".git"
                   and str(rel / name) not in excluded]
        for name in dirs + files:
            item = Path(root) / name
            relative = str(item.relative_to(path))
            if relative == ".git":
                continue
            stat = item.lstat()
            result[relative] = (stat.st_mode, stat.st_size, stat.st_mtime_ns, stat.st_ctime_ns)
    return result


def clean(path):
    return not git(path, "status", "--porcelain", "--untracked-files=normal").stdout


def digest_id(path):
    return hashlib.sha256(str(path).encode()).hexdigest()[:16]


def verify_copy(source, target, excluded=()):
    # Verify bytes, names and link targets, not Git-repair timestamp changes.
    args = ["rsync", "-rlnc"]
    for item in excluded:
        args += ["--exclude", "/" + item + "/"]
    result = run(args + ["--delete", "--itemize-changes", str(source) + "/", str(target) + "/"], timeout=3600)
    differences = [line for line in result.stdout.splitlines()
                   if line not in (".f..T.... .git", ".f..t.... .git")]
    if differences:
        raise RuntimeError("Copy verification failed or source changed: " + "\n".join(differences)[:300])


def verified_copy(source, target, excluded=()):
    target.mkdir(parents=True, exist_ok=True, mode=0o700)
    args = ["rsync", "-a"]
    for item in excluded:
        args += ["--exclude", "/" + item + "/"]
    run(args + [str(source) + "/", str(target) + "/"], timeout=3600)
    verify_copy(source, target, excluded)


def durable(config):
    run(["sync"])
    if not volume_ready(config):
        raise RuntimeError("External volume disappeared; local data retained")


def move_cache(config, source, apply):
    source = Path(source).expanduser()
    target = Path(config["archive_root"]) / "caches" / digest_id(source) / source.name
    backup = source.with_name(source.name + ".storage-moving")
    if backup.is_dir() and apply:
        if not source.exists() and not source.is_symlink():
            os.rename(backup, source)
            emit("recovered_cache_original", path=str(source))
        elif source.is_symlink() and source.readlink() == target and target.is_dir():
            verify_copy(backup, target)
            if busy(backup):
                return
            durable(config)
            shutil.rmtree(backup)
            emit("recovered_cache_cleanup", path=str(source))
    if source.is_symlink() or not source.is_dir():
        return
    if busy(source):
        emit("skip_busy_cache", path=str(source))
        return
    target = Path(config["archive_root"]) / "caches" / digest_id(source) / source.name
    if target.exists():
        emit("skip_existing_cache_destination", path=str(source))
        return
    emit("offload_cache" if apply else "plan_cache", path=str(source), target=str(target))
    if not apply:
        return
    verified_copy(source, target)
    if not volume_ready(config) or busy(source):
        raise RuntimeError("Drive disappeared or cache became active; original retained")
    backup = source.with_name(source.name + ".storage-moving")
    if backup.exists():
        raise RuntimeError("Interrupted move exists; inspect before continuing")
    os.rename(source, backup)
    try:
        source.symlink_to(target, target_is_directory=True)
        if not source.is_dir():
            raise RuntimeError("New cache link is unreadable")
    except Exception:
        if source.is_symlink():
            source.unlink()
        os.rename(backup, source)
        raise
    # Recheck the renamed source, not just the pre-rename copy. Rebuildable caches
    # are the only data moved without a long rollback grace period.
    verify_copy(backup, target)
    if busy(backup):
        raise RuntimeError("Cache still has open files; rollback copy retained")
    durable(config)
    verify_copy(backup, target)
    if busy(backup):
        raise RuntimeError("Cache became active; rollback copy retained")
    shutil.rmtree(backup)
    emit("cache_offloaded", path=str(source), target=str(target))


def worktrees(config):
    seen = set()
    protected = {str(Path(p).expanduser().resolve()) for p in config["protected"]}
    mount = Path(config["mount"])
    for repo in config["repos"]:
        repo = Path(repo).expanduser()
        if not repo.is_dir():
            continue
        result = git(repo, "worktree", "list", "--porcelain", check=False)
        if result.returncode:
            continue
        for block in result.stdout.strip().split("\n\n")[1:]:
            entry = dict(line.partition(" ")[::2] for line in block.splitlines())
            path = Path(entry.get("worktree", ""))
            key = str(path)
            if key in seen:
                continue
            seen.add(key)
            if (not path.is_dir() or path.is_symlink() or "locked" in entry
                    or str(path.resolve()) in protected or mount in path.parents):
                continue
            entry["repo"] = str(repo)
            yield entry


def archive_worktree(config, entry, apply):
    path = Path(entry["worktree"])
    # Nested repositories/submodules cannot safely be relocated by this manager.
    if any(line.startswith("160000 ") for line in git(path, "ls-files", "--stage").stdout.splitlines()):
        emit("skip_submodules", path=str(path))
        return
    if not clean(path):
        emit("skip_dirty", path=str(path))
        return
    excludes = ignored_generated(path)
    latest = activity(path, excludes)
    if time.time() - latest < config["archive_after_days"] * DAY:
        return
    if busy(path):
        emit("skip_busy_worktree", path=str(path))
        return
    ident = digest_id(path)
    folder = Path(config["archive_root"]) / "worktrees" / ident
    checkout = folder / "checkout"
    if folder.exists():
        emit("skip_existing_archive", path=str(path), archive=str(folder))
        return
    emit("archive_worktree" if apply else "plan_worktree", path=str(path), last_activity=latest)
    if not apply:
        return True
    staging = folder / "copying"
    before = source_state(path, excludes)
    for relative in before:
        item = path / relative
        if item.is_symlink():
            resolved = item.resolve()
            if resolved != path.resolve() and path.resolve() not in resolved.parents:
                emit("skip_external_symlink", path=str(path), file=relative)
                return
    verified_copy(path, staging, excludes)
    if (not volume_ready(config) or not clean(path) or busy(path)
            or source_state(path, excludes) != before or activity(path, excludes) != latest):
        raise RuntimeError("Worktree changed during copy; original retained")
    backup = path.with_name(path.name + ".storage-moving")
    if backup.exists():
        raise RuntimeError("Interrupted move exists; inspect before continuing")
    record = {**entry, "id": ident, "original": str(path), "checkout": str(checkout),
              "archived_at": time.time(), "last_activity": latest, "excluded_generated": excludes,
              "rollback": str(backup), "state": "moving"}
    save(folder / "manifest.json", record)
    os.rename(staging, checkout)
    os.rename(path, backup)
    try:
        path.symlink_to(checkout, target_is_directory=True)
        git(entry["repo"], "worktree", "repair", checkout)
        if git(path, "rev-parse", "HEAD").stdout.strip() != entry["HEAD"]:
            raise RuntimeError("Relocated worktree HEAD verification failed")
    except Exception:
        if path.is_symlink():
            path.unlink()
        os.rename(backup, path)
        git(entry["repo"], "worktree", "repair", path, check=False)
        raise
    verify_copy(backup, checkout, excludes)
    if busy(backup):
        raise RuntimeError("Original worktree still open; rollback copy retained")
    durable(config)
    # Commit an independently usable external checkout before removing local bytes.
    record["state"] = "online"
    record["source_signature"] = hashlib.sha256(json.dumps(source_state(checkout, excludes), sort_keys=True).encode()).hexdigest()
    record["rollback"] = str(backup)
    save(folder / "manifest.json", record)
    verify_copy(backup, checkout, excludes)
    if busy(backup):
        raise RuntimeError("Original became active; rollback copy retained")
    shutil.rmtree(backup)
    record.pop("rollback", None)
    save(folder / "manifest.json", record)
    emit("worktree_archived", path=str(path), target=str(checkout))
    return True


def retire(config, manifest, apply):
    record = json.loads(manifest.read_text())
    if record["state"] != "online":
        return
    checkout = Path(record["checkout"])
    original = Path(record["original"])
    if not checkout.is_dir() or busy(checkout) or busy(original) or not clean(checkout):
        return
    excludes = ignored_generated(checkout)
    signature = hashlib.sha256(json.dumps(source_state(checkout, excludes), sort_keys=True).encode()).hexdigest()
    latest = record["last_activity"]
    if signature != record.get("source_signature"):
        latest = max(latest, activity(checkout, excludes))
    if time.time() - latest < config["delete_after_days"] * DAY:
        return
    emit("retire_worktree" if apply else "plan_retire", path=str(original))
    if not apply:
        return
    # Immutable versions: an interrupted deletion must never overwrite a good copy.
    snapshot = manifest.parent / ("source-" + str(time.time_ns()) + ".tar.gz")
    partial = snapshot.with_suffix(".gz.partial")
    excluded = set(ignored_generated(checkout))
    before = source_state(checkout, excluded)
    current_head = git(checkout, "rev-parse", "HEAD").stdout.strip()
    def keep(info):
        name = info.name.removeprefix("./").rstrip("/")
        if name == ".git" or any(name == x or name.startswith(x + "/") for x in excluded):
            return None
        return info
    with tarfile.open(partial, "w:gz") as archive:
        archive.add(checkout, arcname=".", filter=keep)
    # Verify the snapshot contains exactly the source inventory and matching bytes,
    # including ignored local files. Merely decompressing a tar is insufficient.
    members = set()
    with tarfile.open(partial, "r:gz") as archive:
        for member in archive:
            name = member.name.removeprefix("./").rstrip("/")
            if name in ("", "."):
                continue
            members.add(name)
            source = checkout / name
            if member.isfile() or member.islnk():
                left = hashlib.sha256()
                right = hashlib.sha256()
                with archive.extractfile(member) as archived, source.open("rb") as live:
                    for block in iter(lambda: archived.read(1024 * 1024), b""):
                        left.update(block)
                    for block in iter(lambda: live.read(1024 * 1024), b""):
                        right.update(block)
                if left.digest() != right.digest():
                    raise RuntimeError("Snapshot bytes differ from source")
            elif member.issym() and member.linkname != os.readlink(source):
                raise RuntimeError("Snapshot link differs from source")
    if members != set(before):
        raise RuntimeError("Snapshot file inventory differs from source")
    if (not volume_ready(config) or busy(checkout) or busy(original) or not clean(checkout)
            or before != source_state(checkout, excluded)
            or git(checkout, "rev-parse", "HEAD").stdout.strip() != current_head):
        raise RuntimeError("Retirement blocked by new activity")
    os.replace(partial, snapshot)
    os.chmod(snapshot, 0o600)
    # Pin the CURRENT head, including commits made after initial offload.
    git(record["repo"], "update-ref", "refs/storage-manager/" + record["id"], current_head)
    quarantine = manifest.parent / ("quarantine-" + str(time.time_ns()))
    record.update(HEAD=current_head, state="quarantining", snapshot=str(snapshot), quarantine=str(quarantine), quarantine_signature=before)
    save(manifest, record)
    durable(config)
    # Recheck AFTER durability work. Move rather than delete; old file handles and
    # processes get a full-day quarantine grace period before permanent removal.
    if (busy(checkout) or busy(original) or not clean(checkout)
            or before != source_state(checkout, excluded)
            or git(checkout, "rev-parse", "HEAD").stdout.strip() != current_head):
        record["state"] = "online"
        save(manifest, record)
        raise RuntimeError("New activity prevented retirement; snapshot retained")
    git(record["repo"], "worktree", "move", checkout, quarantine)
    make_stub(config, record)
    record.update(state="quarantined", quarantined_at=time.time())
    save(manifest, record)
    emit("worktree_retired_source_preserved", path=str(original), snapshot=str(snapshot))


def make_stub(config, record):
    original = Path(record["original"])
    checkout = Path(record["checkout"])
    if original.is_symlink() and original.readlink() == checkout:
        original.unlink()
    if not original.exists():
        original.mkdir(mode=0o700)
        text = ("# Archived worktree\n\nSource preserved at " + record["snapshot"]
                + "\n\nRestore before working on this directory:\n\n    "
                + config["installed_script"] + " --config " + config["config_path"]
                + " restore " + record["id"] + "\n")
        (original / "ARCHIVED.md").write_text(text)
        (original / "AGENTS.md").write_text(text)


def purge_quarantine(config, manifest, apply):
    record = json.loads(manifest.read_text())
    if record["state"] != "quarantined":
        return
    quarantine = Path(record["quarantine"])
    if not quarantine.exists():
        record["state"] = "snapshot"
        if apply:
            save(manifest, record)
        return
    if time.time() - record["quarantined_at"] < config.get("quarantine_grace_days", 1) * DAY:
        return
    expected = json.loads(json.dumps(record["quarantine_signature"]))
    current = json.loads(json.dumps(source_state(quarantine, ignored_generated(quarantine))))
    if current != expected or not clean(quarantine) or git(quarantine, "rev-parse", "HEAD").stdout.strip() != record["HEAD"]:
        emit("preserve_changed_quarantine", path=str(quarantine))
        return
    if not apply:
        emit("plan_quarantine_delete", path=str(quarantine))
        return
    durable(config)
    if (busy(quarantine) or not clean(quarantine)
            or json.loads(json.dumps(source_state(quarantine, ignored_generated(quarantine)))) != expected
            or git(quarantine, "rev-parse", "HEAD").stdout.strip() != record["HEAD"]):
        return
    # The original path has pointed at a restore stub for a full day. A partial
    # deletion can never overwrite the immutable verified snapshot.
    git(record["repo"], "worktree", "remove", quarantine)
    record["state"] = "snapshot"
    record["retired_at"] = time.time()
    save(manifest, record)
    emit("quarantine_deleted", path=record["original"])


def restore(config, ident):
    if len(ident) != 16 or any(c not in "0123456789abcdef" for c in ident):
        raise ValueError("Invalid archive ID")
    manifest = Path(config["archive_root"]) / "worktrees" / ident / "manifest.json"
    record = json.loads(manifest.read_text())
    if record["state"] not in ("snapshot", "quarantined", "restoring"):
        raise RuntimeError("Archive is already online or not ready")
    checkout = Path(record["checkout"])
    original = Path(record["original"])
    if original.exists() and (original.is_symlink() or set(p.name for p in original.iterdir()) != {"ARCHIVED.md", "AGENTS.md"}):
        raise RuntimeError("Original path contains new work; refusing overwrite")
    if record["state"] == "quarantined" and Path(record["quarantine"]).exists():
        git(record["repo"], "worktree", "move", record["quarantine"], checkout)
        for name in ("ARCHIVED.md", "AGENTS.md"):
            (original / name).unlink()
        original.rmdir()
        original.symlink_to(checkout, target_is_directory=True)
        record.update(state="online", last_activity=time.time(), archived_at=time.time())
        save(manifest, record)
        emit("restored", path=str(original))
        return
    if record["state"] == "restoring" and checkout.exists():
        raise RuntimeError("Interrupted restoration preserved; inspect existing checkout before retry")
    # Preflight before creating a checkout. Links are created last, so they cannot
    # redirect extraction of a later file outside the destination.
    with tarfile.open(record["snapshot"], "r:gz") as archive:
        members = archive.getmembers()
        for member in members:
            name = Path(member.name)
            if name.is_absolute() or ".." in name.parts or ".git" in name.parts:
                raise RuntimeError("Unsafe snapshot path")
            if not (member.isfile() or member.isdir() or member.issym() or member.islnk()):
                raise RuntimeError("Unsupported snapshot special file")
        record["state"] = "restoring"
        save(manifest, record)
        git(record["repo"], "worktree", "add", "--no-checkout", "--detach", checkout, record["HEAD"])
        try:
            for member in members:
                target = checkout / member.name
                if member.issym():
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)
                if member.isdir():
                    target.mkdir(exist_ok=True)
                else:
                    with archive.extractfile(member) as source, target.open("wb") as out:
                        shutil.copyfileobj(source, out)
                    os.chmod(target, member.mode)
                    os.utime(target, (member.mtime, member.mtime))
            for member in members:
                if member.issym():
                    target = checkout / member.name
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.symlink_to(member.linkname)
            git(checkout, "reset", "--mixed", record["HEAD"])
        except Exception:
            # The just-created destination is exclusively ours; preserve the snapshot.
            result = git(record["repo"], "worktree", "remove", "--force", checkout, check=False)
            if result.returncode == 0:
                record["state"] = "snapshot"
                save(manifest, record)
            raise
    if original.exists():
        (original / "ARCHIVED.md").unlink()
        (original / "AGENTS.md").unlink()
        original.rmdir()
    original.symlink_to(checkout, target_is_directory=True)
    record.update(state="online", last_activity=time.time(), archived_at=time.time())
    save(manifest, record)
    emit("restored", path=str(original))


def reconcile(config, manifest):
    """Complete safe commits, or restore the original after interrupted renames."""
    record = json.loads(manifest.read_text())
    original = Path(record["original"])
    checkout = Path(record["checkout"])
    backup = Path(record.get("rollback", str(original) + ".storage-moving"))
    if record["state"] in ("moving", "online") and backup.is_dir():
        if not original.exists() and not original.is_symlink():
            os.rename(backup, original)
            git(record["repo"], "worktree", "repair", original)
            record["state"] = "rolled_back"
            save(manifest, record)
            emit("recovered_original_worktree", path=str(original))
        elif original.is_symlink() and original.readlink() == checkout and checkout.is_dir():
            if busy(backup):
                return
            git(record["repo"], "worktree", "repair", checkout)
            verify_copy(backup, checkout, record["excluded_generated"])
            durable(config)
            record["state"] = "online"
            record["source_signature"] = hashlib.sha256(json.dumps(source_state(checkout, record["excluded_generated"]), sort_keys=True).encode()).hexdigest()
            save(manifest, record)
            verify_copy(backup, checkout, record["excluded_generated"])
            if busy(backup):
                return
            shutil.rmtree(backup)
            record.pop("rollback", None)
            save(manifest, record)
    if record["state"] == "quarantining":
        quarantine = Path(record["quarantine"])
        if quarantine.is_dir():
            make_stub(config, record)
            record.update(state="quarantined", quarantined_at=time.time())
            save(manifest, record)
        elif checkout.is_dir():
            record["state"] = "online"
            save(manifest, record)
        else:
            emit("preserved_interrupted_retirement", path=str(manifest))
    if record["state"] == "retiring":
        # Older versions may have started deleting. Never resnapshot a partial tree.
        record["state"] = "interrupted_retirement"
        save(manifest, record)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("command", choices=["run", "caches", "worktrees", "restore"])
    parser.add_argument("id", nargs="?")
    args = parser.parse_args()
    os.umask(0o077)
    config = json.loads(Path(args.config).read_text())
    if not volume_ready(config):
        emit("paused_external_drive_unavailable")
        return
    lock = Path(config["lock"])
    lock.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with lock.open("a") as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            emit("already_running")
            return
        if args.command == "restore":
            restore(config, args.id)
            return
        if args.command in ("run", "caches"):
            for source in config["caches"]:
                try:
                    move_cache(config, source, args.apply)
                except Exception as error:
                    emit("cache_error", path=source, error=str(error))
        if args.command in ("run", "worktrees"):
            manifests = list((Path(config["archive_root"]) / "worktrees").glob("*/manifest.json"))
            if args.apply:
                for manifest in manifests:
                    try:
                        reconcile(config, manifest)
                    except Exception as error:
                        emit("recovery_error", path=str(manifest), error=str(error))
            count = 0
            started = time.monotonic()
            for entry in worktrees(config):
                if (count >= config.get("max_archives_per_run", 4)
                        or time.monotonic() - started > config.get("scan_budget_seconds", 600)):
                    emit("batch_limit_reached", archived=count)
                    break
                try:
                    if archive_worktree(config, entry, args.apply):
                        count += 1
                except Exception as error:
                    emit("worktree_error", path=entry["worktree"], error=str(error))
                    break  # Stop the batch on a failed relocation, never fan out.
            for manifest in (Path(config["archive_root"]) / "worktrees").glob("*/manifest.json"):
                try:
                    retire(config, manifest, args.apply)
                    purge_quarantine(config, manifest, args.apply)
                except Exception as error:
                    emit("retirement_error", path=str(manifest), error=str(error))
        emit("finished", free_internal_bytes=shutil.disk_usage(Path.home()).free)
        if ERROR_COUNT and args.apply and config.get("notify_on_errors", False):
            alert = Path(config["lock"]).with_suffix(".last-alert")
            if not alert.exists() or time.time() - alert.stat().st_mtime > DAY:
                run(["osascript", "-e", 'display notification "A maintenance step was paused to preserve your files. Check the storage-manager log." with title "OpenWork storage"'], check=False)
                alert.touch()


if __name__ == "__main__":
    main()
