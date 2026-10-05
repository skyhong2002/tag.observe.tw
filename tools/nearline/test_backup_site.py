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
    def exercise(self, root, nas, restore):
        with patch.object(module, 'source_sql', side_effect=['1000', '']), patch.object(module, 'schema_signature', return_value=(['articles'], 'schema')), patch.object(module.shutil, 'disk_usage', return_value=Mock(free=100*module.GIB)), patch.object(module, 'export_database', side_effect=lambda p: p.write_bytes(b'archive')), patch.object(module, 'restore_drill', restore):
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
