import importlib.util
import json
import pathlib
import signal
import subprocess
import tempfile
import unittest
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location('backup_v2', pathlib.Path(__file__).with_name('backup-v2.py'))
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)
FIXTURE = b'small compressed fixture (zstd mocked)'
META = dict(tables=['events'], schema_sha256='a' * 64, sample_counts={'events': 3},
            snapshot_binding='export-snapshot')
MANIFEST = dict(META, archive_key='backup-20261013T040000.sql.zst',
                archive_sha256=b.hashlib.sha256(FIXTURE).hexdigest())


class BackupV2Tests(unittest.TestCase):
    def config(self, directory):
        names = set(b.command_names('daily') + b.command_names('weekly'))
        return dict(directory=directory, reviewed=True, execution_host='mint-mbp',
                    mariadb_series='11.4', required_free_bytes={'daily': 1, 'weekly': 1},
                    commands={n: [n, '{archive}', '{manifest}', '{receipt}'] for n in names})

    def adapters(self, evidence=None, manifest=None, bad_readback=None):
        calls = []
        def runner(argv, **kwargs):
            name = argv[0]
            calls.append(name)
            if name in ['export', 'fetch_latest']:
                kwargs['stdout'].write(FIXTURE)
            if name in ['source_metadata', 'inspect', 'fetch_manifest']:
                data = (manifest if manifest is not None else MANIFEST) if name == 'fetch_manifest' else (
                    evidence if evidence is not None else META)
                kwargs['stdout'].write(json.dumps(data).encode())
        def remote_hash(argv):
            name = argv[0]
            calls.append(name)
            if name == bad_readback:
                return '0' * 64
            index = {'readback': 1, 'readback_manifest': 2, 'readback_receipt': 3}[name]
            return b.sha256(pathlib.Path(argv[index]))
        return runner, remote_hash, calls

    def test_plan_is_pure(self):
        with patch.object(b, 'run', side_effect=AssertionError('execution forbidden')):
            self.assertFalse(b.plan(self.config('/unused'), 'daily')['execute'])

    def test_daily_independent_manifest_and_receipt_verified(self):
        with tempfile.TemporaryDirectory() as directory:
            runner, remote_hash, calls = self.adapters()
            result = b.execute(self.config(directory), 'daily', runner, remote_hash)
            self.assertEqual(result['status'], 'nas-verified')
            self.assertNotIn('restore', calls)
            self.assertEqual(calls[-5:], ['readback', 'upload_manifest', 'readback_manifest',
                                        'upload_receipt', 'readback_receipt'])
            manifest = b.load_json(next(pathlib.Path(directory).glob('manifest-*')))
            self.assertEqual(manifest['sample_counts'], META['sample_counts'])

    def test_archive_hash_mismatch_never_publishes_receipt(self):
        with tempfile.TemporaryDirectory() as directory:
            runner, remote_hash, calls = self.adapters(bad_readback='readback')
            with self.assertRaises(RuntimeError):
                b.execute(self.config(directory), 'daily', runner, remote_hash)
            self.assertNotIn('upload_receipt', calls)

    def test_receipt_readback_failure_is_failure(self):
        for job in ['daily', 'weekly']:
            with self.subTest(job=job), tempfile.TemporaryDirectory() as directory:
                runner, remote_hash, calls = self.adapters(bad_readback='readback_receipt')
                with self.assertRaises(RuntimeError):
                    b.execute(self.config(directory), job, runner, remote_hash)
                self.assertEqual(calls[-1], 'readback_receipt')

    def test_weekly_valid_independent_comparison(self):
        with tempfile.TemporaryDirectory() as directory:
            runner, remote_hash, calls = self.adapters()
            result = b.execute(self.config(directory), 'weekly', runner, remote_hash)
            self.assertEqual(result['status'], 'restore-verified')
            self.assertLess(calls.index('fetch_manifest'), calls.index('restore'))
            self.assertEqual(result['source_archive'], MANIFEST['archive_key'])

    def test_weekly_fake_empty_or_invalid_evidence_rejected(self):
        bad = [dict(tables=[], schema_sha256='', sample_counts={}, matches_expected=True),
               dict(META, schema_sha256='not-a-hash', matches_expected=True),
               dict(META, sample_counts={}, matches_expected=True),
               dict(META, sample_counts={'events': True}, matches_expected=True)]
        for evidence in bad:
            with self.subTest(evidence=evidence), tempfile.TemporaryDirectory() as directory:
                runner, remote_hash, calls = self.adapters(evidence=evidence)
                with self.assertRaises(ValueError):
                    b.execute(self.config(directory), 'weekly', runner, remote_hash)
                self.assertNotIn('upload_receipt', calls)

    def test_weekly_mismatch_ignores_fake_match_assertion(self):
        for field, value in [('tables', ['wrong']), ('schema_sha256', 'b' * 64),
                             ('sample_counts', {'events': 4})]:
            evidence = dict(META, **{field: value}, matches_expected=True,
                            expected_sha256=MANIFEST['archive_sha256'])
            if field == 'tables':
                evidence['sample_counts'] = {'wrong': 3}
            with self.subTest(field=field), tempfile.TemporaryDirectory() as directory:
                runner, remote_hash, calls = self.adapters(evidence=evidence)
                with self.assertRaises(RuntimeError):
                    b.execute(self.config(directory), 'weekly', runner, remote_hash)
                self.assertNotIn('upload_receipt', calls)

    def test_weekly_manifest_hash_mismatch_blocks_restore(self):
        with tempfile.TemporaryDirectory() as directory:
            runner, remote_hash, calls = self.adapters(manifest=dict(MANIFEST, archive_sha256='b' * 64))
            with self.assertRaises(RuntimeError):
                b.execute(self.config(directory), 'weekly', runner, remote_hash)
            self.assertNotIn('restore', calls)

    def test_full_disk_stops_without_commands_or_delete(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(b.shutil, 'disk_usage') as usage:
                usage.return_value.free = 0
                with self.assertRaises(RuntimeError):
                    b.execute(self.config(directory), 'daily', lambda *a, **k: self.fail('command ran'))
            self.assertEqual(list(pathlib.Path(directory).iterdir()), [])

    def test_weekly_wrong_host_is_blocked(self):
        with tempfile.TemporaryDirectory() as directory:
            config = self.config(directory)
            config['execution_host'] = 'production'
            with self.assertRaises(ValueError):
                b.execute(config, 'weekly', lambda *a, **k: self.fail('command ran'))

    def test_copy_limit_cannot_exceed_two(self):
        for limit in [100, 0, True, '2']:
            config = self.config('/unused')
            config['local_copy_limit'] = limit
            with self.assertRaises(ValueError):
                b.plan(config, 'daily')

    def test_normal_exit_cleans_only_new_process_group(self):
        process = Mock(pid=123456)
        process.wait.return_value = 0
        with patch.object(b.subprocess, 'Popen', return_value=process) as popen, patch.object(b.os, 'killpg') as killpg:
            self.assertIsNone(b.run(['fixture']))
            self.assertTrue(popen.call_args.kwargs['start_new_session'])
            self.assertEqual(killpg.call_args_list[0].args, (123456, signal.SIGTERM))
            self.assertEqual(killpg.call_args_list[1].args, (123456, signal.SIGKILL))

    def test_timeout_cleans_only_new_process_group(self):
        process = Mock(pid=123456)
        process.wait.side_effect = [subprocess.TimeoutExpired('fixture', 1), 0, 0]
        with patch.object(b.subprocess, 'Popen', return_value=process) as popen, patch.object(b.os, 'killpg') as killpg:
            with self.assertRaises(subprocess.TimeoutExpired):
                b.run(['fixture'], timeout=1)
            self.assertTrue(popen.call_args.kwargs['start_new_session'])
            self.assertEqual(killpg.call_args_list[0].args, (123456, signal.SIGTERM))
            self.assertEqual(killpg.call_args_list[1].args, (123456, signal.SIGKILL))


if __name__ == '__main__':
    unittest.main()
