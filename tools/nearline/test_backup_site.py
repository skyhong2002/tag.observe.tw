import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location('backup_site', Path(__file__).with_name('backup-site.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class BackupTests(unittest.TestCase):
    def stored_backup(self, root, day, nas):
        backup_id = '202610' + day + 'T000000Z-12345678'
        path = root / ('tag_observe-' + backup_id + '.sql.zst')
        path.write_bytes(('archive-' + day).encode())
        sha = module.digest(path)
        data = {'backup_id': backup_id, 'file': path.name, 'status': 'verified',
                'bytes': path.stat().st_size, 'sha256': sha, 'restore': {'status': 'passed'},
                'object': nas.remote + '/objects/' + sha + '.sql.zst'}
        module.atomic_json(path.with_suffix('.manifest.json'), data)
        return path

    def reclaim(self, root, nas):
        report = {}
        module.reclaim_for_capacity(root, nas, 100, root / 'current.json', report)
        return report

    def test_pressure_reclaims_only_after_remote_verification_and_keeps_latest(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, nas = Path(tmp), Mock(remote='nas:test')
            old = self.stored_backup(root, '01', nas)
            latest = self.stored_backup(root, '02', nas)
            nas.command.return_value.stdout = old.with_suffix('.manifest.json').read_bytes()
            nas.verify.side_effect = lambda *args: self.assertTrue(old.exists())
            with patch.object(module.shutil, 'disk_usage', return_value=Mock(free=0)):
                report = self.reclaim(root, nas)
            self.assertFalse(old.exists())
            self.assertTrue(latest.exists())
            self.assertTrue(old.with_suffix('.manifest.json').exists())
            self.assertEqual(report['capacity_reclaims'][0]['status'], 'local_removed_nas_retained')
            nas.verify.assert_called_once()

    def test_pressure_preserves_copies_on_receipt_or_object_verification_failure(self):
        for failure in ['receipt', 'object']:
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as tmp:
                root, nas = Path(tmp), Mock(remote='nas:test')
                old = self.stored_backup(root, '01', nas)
                latest = self.stored_backup(root, '02', nas)
                nas.command.return_value.stdout = b'wrong' if failure == 'receipt' else old.with_suffix('.manifest.json').read_bytes()
                nas.verify.side_effect = RuntimeError('bad checksum')
                with patch.object(module.shutil, 'disk_usage', return_value=Mock(free=0)), self.assertRaises(RuntimeError):
                    self.reclaim(root, nas)
                self.assertTrue(old.exists())
                self.assertTrue(latest.exists())

    def test_pressure_preserves_older_copy_if_latest_verified_dump_is_damaged(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, nas = Path(tmp), Mock(remote='nas:test')
            old = self.stored_backup(root, '01', nas)
            latest = self.stored_backup(root, '02', nas)
            latest.write_bytes(b'corrupted')
            with self.assertRaisesRegex(RuntimeError, 'Newest verified local backup is damaged'):
                self.reclaim(root, nas)
            self.assertTrue(old.exists())
            nas.verify.assert_not_called()

    def test_pressure_preserves_failed_and_unknown_dumps_and_last_verified(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, nas = Path(tmp), Mock(remote='nas:test')
            verified = self.stored_backup(root, '01', nas)
            failed = self.stored_backup(root, '02', nas)
            receipt = failed.with_suffix('.manifest.json')
            data = json.loads(receipt.read_text()); data['status'] = 'failed'
            module.atomic_json(receipt, data)
            unknown = root / 'tag_observe-20261003T000000Z-12345678.sql.zst'
            unknown.write_bytes(b'no receipt')
            with patch.object(module.shutil, 'disk_usage', return_value=Mock(free=0)):
                self.reclaim(root, nas)
            self.assertTrue(all(p.exists() for p in [verified, failed, unknown]))
            nas.verify.assert_not_called()

    def test_pressure_preserves_candidate_changed_during_nas_check(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, nas = Path(tmp), Mock(remote='nas:test')
            old = self.stored_backup(root, '01', nas)
            self.stored_backup(root, '02', nas)
            nas.command.return_value.stdout = old.with_suffix('.manifest.json').read_bytes()
            nas.verify.side_effect = lambda *args: old.write_bytes(b'changed')
            with patch.object(module.shutil, 'disk_usage', return_value=Mock(free=0)), self.assertRaisesRegex(RuntimeError, 'changed during NAS verification'):
                self.reclaim(root, nas)
            self.assertTrue(old.exists())

    def test_trim_rejects_unexpected_docker_storage(self):
        with patch.object(module, 'run', return_value=Mock(stdout='/different')), patch.object(module.os.path, 'ismount', return_value=True), self.assertRaisesRegex(RuntimeError, 'expected mounted'):
            module.trim_docker_storage()

    def test_insufficient_capacity_after_trim_and_reclaim_never_exports(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, nas = Path(tmp), Mock(remote='nas:test')
            with patch.object(module, 'source_sql', return_value='1000'), patch.object(module, 'source_storage_bytes', return_value=1000), patch.object(module.shutil, 'disk_usage', return_value=Mock(free=0)), patch.object(module, 'trim_docker_storage', return_value={'output': 'trimmed'}) as trim, patch.object(module, 'export_database') as export:
                with self.assertRaisesRegex(RuntimeError, 'Insufficient local space'):
                    module.backup(root, nas, trim_docker=True, reclaim_verified=True)
                trim.assert_called_once()
                export.assert_not_called()
            report = json.loads(next(root.glob('*.manifest.json')).read_text())
            self.assertEqual(report['status'], 'failed')
            self.assertEqual(report['required_free_bytes'], 500 + 25 * module.GIB)

    def exercise(self, root, nas, restore):
        with patch.object(module, 'source_sql', side_effect=['1000', '']), patch.object(module, 'source_storage_bytes', return_value=1000), patch.object(module, 'schema_signature', return_value=(['articles'], 'schema')), patch.object(module.shutil, 'disk_usage', return_value=Mock(free=100*module.GIB)), patch.object(module, 'export_database', side_effect=lambda p: p.write_bytes(b'archive')), patch.object(module, 'restore_drill', restore):
            return module.backup(root, nas)

    def test_failed_restore_preserves_files_and_never_publishes_success(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            nas = Mock()
            with self.assertRaisesRegex(RuntimeError, 'restore failed'):
                self.exercise(root, nas, Mock(side_effect=RuntimeError('restore failed')))
            nas.publish.assert_not_called()
            self.assertEqual(len(list(root.glob('*.sql.zst'))), 1)
            self.assertEqual(json.loads(next(root.glob('*.manifest.json')).read_text())['status'], 'failed')

    def test_failed_nas_receipt_is_not_success_and_preserves_local_dump(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            nas = Mock(remote='nas:test')
            nas.command.return_value = Mock(stdout=json.dumps({'free': 200*module.GIB}))
            nas.publish.side_effect = ['nas:test/objects/hash.sql.zst', RuntimeError('readback failed')]
            with self.assertRaisesRegex(RuntimeError, 'readback failed'):
                self.exercise(root, nas, Mock(return_value={'status': 'passed'}))
            self.assertEqual(json.loads(next(root.glob('*.manifest.json')).read_text())['status'], 'failed')
            self.assertEqual(len(list(root.glob('*.sql.zst'))), 1)

    def test_success_publishes_dump_before_restored_manifest(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            nas = Mock(remote='nas:test')
            nas.command.return_value = Mock(stdout=json.dumps({'free': 200*module.GIB}))
            nas.publish.side_effect = lambda p, relative: 'nas:test/' + relative
            report = self.exercise(root, nas, Mock(return_value={'status': 'passed'}))
            self.assertEqual(report['status'], 'verified')
            self.assertTrue(nas.publish.call_args_list[0].args[1].startswith('objects/'))
            self.assertTrue(nas.publish.call_args_list[1].args[1].startswith('manifests/'))
            nas.command.assert_called_once_with('about', 'nas:test', '--json', capture_output=True, text=True)

    def test_resume_reuses_restore_proof_but_rejects_changed_dump(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            nas = Mock(remote='nas:test')
            nas.command.return_value = Mock(stdout=json.dumps({'free': 200*module.GIB}))
            nas.publish.side_effect = ['nas:test/objects/hash.sql.zst', RuntimeError('network interrupted')]
            with self.assertRaisesRegex(RuntimeError, 'network interrupted'):
                self.exercise(root, nas, Mock(return_value={'status': 'passed'}))
            receipt = next(root.glob('*.manifest.json'))
            nas.publish.side_effect = lambda p, relative: 'nas:test/' + relative
            with patch.object(module, 'export_database') as export, patch.object(module, 'restore_drill') as restore:
                result = module.resume_backup(root, receipt, nas)
                self.assertEqual(result['status'], 'verified')
                self.assertNotIn('error', result)
                export.assert_not_called()
                restore.assert_not_called()
            next(root.glob('*.sql.zst')).write_bytes(b'changed archive')
            nas.publish.reset_mock()
            with self.assertRaisesRegex(RuntimeError, 'changed since restore'):
                module.resume_backup(root, receipt, nas)
            nas.publish.assert_not_called()


class PhaseCapacityTests(unittest.TestCase):
    def test_export_success_without_restore_capacity_preserves_dump_and_can_resume(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, nas = Path(tmp), Mock(remote='nas:test')
            nas.command.return_value = Mock(stdout=json.dumps({'free': 200*module.GIB}))
            nas.publish.side_effect = lambda p, relative: 'nas:test/' + relative
            with patch.object(module, 'source_sql', side_effect=['1000', '']), patch.object(module, 'source_storage_bytes', return_value=80*module.GIB), patch.object(module, 'schema_signature', return_value=(['articles'], 'schema')), patch.object(module.shutil, 'disk_usage', return_value=Mock(free=60*module.GIB)), patch.object(module, 'export_database', side_effect=lambda p:p.write_bytes(b'archive')), patch.object(module, 'restore_drill') as restore:
                with self.assertRaisesRegex(RuntimeError, 'isolated restore'):
                    module.backup(root,nas)
                restore.assert_not_called()
                nas.publish.assert_not_called()
            receipt = next(root.glob('*.manifest.json'))
            self.assertEqual(json.loads(receipt.read_text())['export_status'],'passed')
            with patch.object(module.shutil, 'disk_usage', return_value=Mock(free=150*module.GIB)), patch.object(module, 'restore_drill', return_value={'status':'passed'}) as restore, patch.object(module, 'export_database') as export:
                result=module.resume_backup(root,receipt,nas)
                self.assertEqual(result['status'],'verified')
                restore.assert_called_once()
                export.assert_not_called()

    def test_space_loss_stops_stream_processes(self):
        process=Mock(); process.poll.return_value=None
        with patch.object(module.shutil,'disk_usage',return_value=Mock(free=module.RESERVE-1)):
            with self.assertRaisesRegex(RuntimeError,'25 GiB SSD reserve'):
                module.wait_pipeline([process],Path('/unused'))
        process.terminate.assert_called_once()

    def test_restore_estimate_keeps_all_headroom(self):
        self.assertEqual(module.restore_required(80*module.GIB),92*module.GIB+25*module.GIB)
