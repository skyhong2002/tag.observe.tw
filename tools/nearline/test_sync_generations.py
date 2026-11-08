import unittest
import importlib.util
from pathlib import Path
from integrate import needs_processing

spec=importlib.util.spec_from_file_location('sync_generations',Path(__file__).with_name('sync-generations.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)


class ContinuousPolicyTest(unittest.TestCase):
    def test_replay_targets_only_collision_receipts_until_reviewed(self):
        previous={'mapping_sha256':'mapped','allow_recent':True,'quarantine_reasons':{'input_identity_collision':7}}
        self.assertTrue(needs_processing(previous,True,'mapped','binary-equivalent-v1'))
        self.assertFalse(needs_processing(previous|{'identity_policy':'binary-equivalent-v1'},True,'mapped','binary-equivalent-v1'))
        self.assertFalse(needs_processing(previous|{'quarantine_reasons':{'existing_identity_or_metadata_conflict':7}},True,'mapped','binary-equivalent-v1'))

    def test_continuous_import_waits_for_completed_article_tables(self):
        plan={'mappingSha256':'mapped','tables':[{'table':'tag_a','action':'import_articles'},{'table':'tag_b','action':'import_articles'},{'table':'show_cache','action':'nearline_only'}]}
        source={'tables':{'tag_a':{'status':'complete','chunks':[{'sha256':'hash'}]},'tag_b':{'status':'running','chunks':[{'sha256':'hash2'}]},'show_cache':{'status':'complete','chunks':[{'sha256':'hash3'}]}}}
        self.assertEqual(module.pending_chunks(plan,{'completed':{}},source,'binary-equivalent-v1'),[('tag_a',0)])


import fcntl
import json
import subprocess
import sys
import tempfile
import threading
import time
from unittest import mock


class LockContentionTest(unittest.TestCase):
    """Colliding sync/replay invocations: keep mutual exclusion, never crash, never report skipped work as success."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.config = {'sync_state_dir': str(self.root), 'lock_wait_seconds': 0.3}
        self.held = []

    def tearDown(self):
        for handle in self.held:
            handle.close()
        self.tmp.cleanup()

    def hold(self, name):
        handle = (self.root / name).open('a')
        fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        self.held.append(handle)
        return handle

    def backup_running(self):
        # Proves the lock was acquired: the first step after locking is the backup check.
        return mock.patch.object(module.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, stdout='active\n'))

    def test_contended_shared_lock_writes_fresh_deferred_receipt_instead_of_raising(self):
        self.hold('lock')
        (self.root / 'status-replay.json').write_text(json.dumps({'status': 'replay_complete', 'updated_at': 'old'}))
        with self.backup_running() as run:
            status = module.synchronize(self.config, 'replay')
        run.assert_not_called()
        self.assertEqual(status['status'], 'deferred')
        self.assertEqual(status['reason'], 'shared_lock_busy')
        receipt = json.loads((self.root / 'status-replay.json').read_text())
        self.assertEqual(receipt['status'], 'deferred')
        self.assertNotEqual(receipt['updated_at'], 'old')

    def test_waits_for_a_short_overlapping_run_then_proceeds(self):
        handle = self.hold('lock')
        threading.Timer(0.2, handle.close).start()
        with self.backup_running() as run:
            status = module.synchronize(self.config | {'lock_wait_seconds': 5}, 'sync')
        run.assert_called_once()
        self.assertEqual(status['status'], 'waiting_for_verified_backup')

    def test_same_mode_collision_leaves_the_running_receipt_untouched(self):
        self.hold('lock-sync')
        (self.root / 'status-sync.json').write_text('{"status": "running"}')
        status = module.synchronize(self.config, 'sync')
        self.assertEqual((status['status'], status['reason']), ('deferred', 'same_mode_running'))
        self.assertEqual(json.loads((self.root / 'status-sync.json').read_text()), {'status': 'running'})

    def test_cli_exits_tempfail_for_deferred_work(self):
        self.hold('lock')
        config = self.root / 'config.json'
        config.write_text(json.dumps(self.config))
        result = subprocess.run([sys.executable, str(Path(module.__file__)), '--config', str(config), '--mode', 'replay'],
                                capture_output=True, text=True, cwd=Path(module.__file__).parent, timeout=30)
        self.assertEqual(result.returncode, module.DEFERRED_EXIT, result.stderr)
        self.assertNotIn('BlockingIOError', result.stderr)
        self.assertEqual(json.loads(result.stdout)['status'], 'deferred')

    def test_wait_for_lock_is_bounded(self):
        self.hold('lock')
        with (self.root / 'lock').open('a') as other:
            start = time.monotonic()
            self.assertFalse(module.wait_for_lock(other, 0.2))
            self.assertLess(time.monotonic() - start, 2)
