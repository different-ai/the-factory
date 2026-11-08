import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("manager", Path(__file__).with_name("storage_manager.py"))
manager = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(manager)
VOLUME_READY = manager.volume_ready


def git(path, *args):
    return subprocess.run(["git", "-C", str(path), *args], check=True, text=True, capture_output=True).stdout.strip()


class StorageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="storage-manager-test-")
        self.root = Path(self.temp.name)
        self.repo = self.root / "repo"
        self.repo.mkdir()
        git(self.repo, "init")
        git(self.repo, "config", "user.name", "Storage Test")
        git(self.repo, "config", "user.email", "storage-test@example.invalid")
        (self.repo / "source.txt").write_text("original source\n")
        (self.repo / "link").symlink_to("source.txt")
        (self.repo / ".gitignore").write_text("node_modules/\n.env\n")
        git(self.repo, "add", ".")
        git(self.repo, "commit", "-m", "fixture")
        self.work = self.root / "work"
        git(self.repo, "worktree", "add", "--detach", str(self.work))
        (self.work / ".env").write_text("fixture local data, not a real credential\n")
        (self.work / "node_modules").mkdir()
        (self.work / "node_modules" / "generated").write_text("rebuildable")
        self.config = {"archive_root": str(self.root / "external"), "archive_after_days": 2,
                       "delete_after_days": 30, "installed_script": "/manager.py", "config_path": "/config.json"}
        self.entry = {"worktree": str(self.work), "repo": str(self.repo),
                      "HEAD": git(self.work, "rev-parse", "HEAD")}
        self.old = time.time() - 40 * manager.DAY
        self.patches = [patch.object(manager, "busy", return_value=False),
                        patch.object(manager, "volume_ready", return_value=True),
                        patch.object(manager, "durable"),
                        patch.object(manager, "activity", return_value=self.old)]
        for item in self.patches:
            item.start()

    def tearDown(self):
        for item in reversed(self.patches):
            item.stop()
        self.temp.cleanup()

    def manifest(self):
        return next((Path(self.config["archive_root"]) / "worktrees").glob("*/manifest.json"))

    def test_archive_retire_restore_preserves_source_and_ignored_files(self):
        manager.archive_worktree(self.config, self.entry, True)
        self.assertTrue(self.work.is_symlink())
        self.assertEqual((self.work / "source.txt").read_text(), "original source\n")
        self.assertTrue((self.work / ".env").is_file())
        self.assertFalse((self.work / "node_modules").exists())
        self.assertEqual(git(self.work, "rev-parse", "HEAD"), self.entry["HEAD"])
        manifest = self.manifest()
        manager.retire(self.config, manifest, True)
        record = json.loads(manifest.read_text())
        self.assertEqual(record["state"], "quarantined")
        self.assertTrue((self.work / "ARCHIVED.md").exists())
        record["quarantined_at"] = self.old
        manager.save(manifest, record)
        manager.purge_quarantine(self.config, manifest, True)
        self.assertEqual(json.loads(manifest.read_text())["state"], "snapshot")
        manager.restore(self.config, record["id"])
        self.assertTrue(self.work.is_symlink())
        self.assertEqual((self.work / "source.txt").read_text(), "original source\n")
        self.assertTrue((self.work / "link").is_symlink())
        self.assertEqual((self.work / "link").read_text(), "original source\n")
        self.assertEqual((self.work / ".env").read_text(), "fixture local data, not a real credential\n")
        self.assertEqual(git(self.work, "status", "--porcelain"), "")

    def test_retirement_pins_new_detached_commit(self):
        manager.archive_worktree(self.config, self.entry, True)
        (self.work / "source.txt").write_text("new detached source\n")
        git(self.work, "add", "source.txt")
        git(self.work, "commit", "-m", "new detached commit")
        head = git(self.work, "rev-parse", "HEAD")
        manifest = self.manifest()
        manager.retire(self.config, manifest, True)
        record = json.loads(manifest.read_text())
        self.assertEqual(record["HEAD"], head)
        self.assertEqual(git(self.repo, "rev-parse", "refs/storage-manager/" + record["id"]), head)

    def test_dirty_worktree_is_not_archived(self):
        (self.work / "source.txt").write_text("uncommitted\n")
        manager.archive_worktree(self.config, self.entry, True)
        self.assertFalse(self.work.is_symlink())
        self.assertEqual((self.work / "source.txt").read_text(), "uncommitted\n")

    def test_copy_failure_preserves_original(self):
        with patch.object(manager, "verified_copy", side_effect=RuntimeError("fixture copy failure")):
            with self.assertRaises(RuntimeError):
                manager.archive_worktree(self.config, self.entry, True)
        self.assertTrue(self.work.is_dir())
        self.assertFalse(self.work.is_symlink())

    def test_busy_worktree_is_not_archived(self):
        with patch.object(manager, "busy", return_value=True):
            manager.archive_worktree(self.config, self.entry, True)
        self.assertFalse(self.work.is_symlink())

    def test_new_ignored_write_in_quarantine_is_preserved(self):
        manager.archive_worktree(self.config, self.entry, True)
        manifest = self.manifest()
        manager.retire(self.config, manifest, True)
        record = json.loads(manifest.read_text())
        snapshot_bytes = Path(record["snapshot"]).read_bytes()
        quarantine = Path(record["quarantine"])
        (quarantine / ".env").write_text("new data after retirement")
        record["quarantined_at"] = self.old
        manager.save(manifest, record)
        manager.purge_quarantine(self.config, manifest, True)
        self.assertTrue(quarantine.exists())
        self.assertEqual((quarantine / ".env").read_text(), "new data after retirement")
        self.assertEqual(Path(record["snapshot"]).read_bytes(), snapshot_bytes)

    def test_missing_snapshot_prevents_quarantine_deletion(self):
        manager.archive_worktree(self.config, self.entry, True)
        manifest = self.manifest()
        manager.retire(self.config, manifest, True)
        record = json.loads(manifest.read_text())
        Path(record["snapshot"]).unlink()
        record["quarantined_at"] = self.old
        manager.save(manifest, record)
        with self.assertRaises(RuntimeError):
            manager.purge_quarantine(self.config, manifest, True)
        self.assertTrue(Path(record["quarantine"]).is_dir())

    def test_recovery_finishes_interrupted_worktree_move(self):
        original_rmtree = manager.shutil.rmtree
        def stop_cleanup(path, *args, **kwargs):
            if str(path).endswith(".storage-moving"):
                raise RuntimeError("simulated crash before local cleanup")
            return original_rmtree(path, *args, **kwargs)
        with patch.object(manager.shutil, "rmtree", side_effect=stop_cleanup):
            with self.assertRaises(RuntimeError):
                manager.archive_worktree(self.config, self.entry, True)
        manager.reconcile(self.config, self.manifest())
        self.assertTrue(self.work.is_symlink())
        self.assertEqual((self.work / ".env").read_text(), "fixture local data, not a real credential\n")
        self.assertFalse(self.work.with_name("work.storage-moving").exists())

    def test_cache_moves_with_content_verification(self):
        source = self.root / "cache"
        source.mkdir()
        (source / "data").write_bytes(b"rebuildable fixture")
        manager.move_cache(self.config, source, True)
        self.assertTrue(source.is_symlink())
        self.assertEqual((source / "data").read_bytes(), b"rebuildable fixture")
        self.assertFalse(source.with_name("cache.storage-moving").exists())

    def test_external_symlink_prevents_worktree_move(self):
        (self.work / "link").unlink()
        (self.work / "link").symlink_to("../outside")
        git(self.work, "add", "link")
        git(self.work, "commit", "-m", "external link")
        self.entry["HEAD"] = git(self.work, "rev-parse", "HEAD")
        manager.archive_worktree(self.config, self.entry, True)
        self.assertFalse(self.work.is_symlink())

    def test_source_changed_during_copy_is_preserved(self):
        original = manager.verified_copy
        def writer(source, target, excluded=()):
            original(source, target, excluded)
            (source / ".env").write_text("new local data during copy")
        with patch.object(manager, "verified_copy", side_effect=writer):
            with self.assertRaises(RuntimeError):
                manager.archive_worktree(self.config, self.entry, True)
        self.assertFalse(self.work.is_symlink())
        self.assertEqual((self.work / ".env").read_text(), "new local data during copy")

    def test_offline_drive_is_rejected(self):
        with patch.object(Path, "is_mount", return_value=False):
            self.assertFalse(VOLUME_READY({"mount": "/not-a-volume"}))


if __name__ == "__main__":
    unittest.main()
