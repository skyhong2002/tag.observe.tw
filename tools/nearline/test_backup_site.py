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

    def test_trim_rejects_unmounted_or_root_docker_storage(self):
        for root, mounted in (('/var/lib/docker', False), ('/', True), ('', True), ('relative', True)):
            with self.subTest(root=root), patch.object(module, 'run', return_value=Mock(stdout=root + '\n')) as run, patch.object(module.os.path, 'ismount', return_value=mounted), self.assertRaisesRegex(RuntimeError, 'mounted Docker data directory'):
                module.trim_docker_storage()
            self.assertEqual(run.call_count, 1)

    def test_trim_uses_docker_reported_data_root(self):
        with patch.object(module, 'run', return_value=Mock(stdout='/var/lib/docker\n')) as run, patch.object(module.os.path, 'ismount', return_value=True):
            result = module.trim_docker_storage()
        self.assertEqual(result['target'], '/var/lib/docker')
        self.assertIn('type=bind,src=/var/lib/docker,dst=/trim', run.call_args_list[1].args[0])

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


class ResticStoreTests(unittest.TestCase):
    """#33: nightly dumps go to a deduplicating restic repository on the NAS."""

    def fake_restic(self, verify=None):
        restic = Mock(repository='rclone:nas:test-restic')
        restic.object_name.side_effect = lambda snap: 'restic:rclone:nas:test-restic#' + snap
        restic.backup.return_value = {'snapshot': 'a' * 64, 'sql_sha256': 'b' * 64, 'data_added_packed': 1}
        if verify:
            restic.verify.side_effect = verify
        return restic

    def exercise(self, root, nas, restic):
        with patch.object(module, 'source_sql', side_effect=['1000', '']), \
                patch.object(module, 'source_storage_bytes', return_value=1000), \
                patch.object(module, 'schema_signature', return_value=(['articles'], 'schema')), \
                patch.object(module.shutil, 'disk_usage', return_value=Mock(free=100 * module.GIB)), \
                patch.object(module, 'export_database', side_effect=lambda p: p.write_bytes(b'archive')), \
                patch.object(module, 'restore_drill', Mock(return_value={'status': 'passed'})):
            return module.backup(root, nas, restic=restic)

    def nas(self):
        nas = Mock(remote='nas:test')
        nas.command.return_value = Mock(stdout=json.dumps({'free': 200 * module.GIB}))
        nas.publish.side_effect = lambda p, relative: 'nas:test/' + relative
        return nas

    def test_dump_is_one_row_per_insert(self):
        self.assertIn('--skip-extended-insert', module.DUMP_OPTIONS)
        self.assertIn('--no-autocommit', module.DUMP_OPTIONS)
        self.assertIn('--single-transaction', module.DUMP_OPTIONS)

    def test_success_stores_snapshot_verifies_it_then_publishes_manifest_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, nas, restic = Path(tmp), self.nas(), self.fake_restic()
            report = self.exercise(root, nas, restic)
            self.assertEqual(report['status'], 'verified')
            self.assertEqual(report['object'], 'restic:rclone:nas:test-restic#' + 'a' * 64)
            self.assertEqual(report['restic']['sql_sha256'], 'b' * 64)
            restic.verify.assert_called_once_with('a' * 64, 'b' * 64)
            self.assertEqual([c.args[1].split('/')[0] for c in nas.publish.call_args_list], ['manifests'])

    def test_failed_readback_is_not_success_and_preserves_local_dump(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, nas = Path(tmp), self.nas()
            restic = self.fake_restic(verify=RuntimeError('NAS restic readback checksum mismatch'))
            with self.assertRaisesRegex(RuntimeError, 'readback'):
                self.exercise(root, nas, restic)
            self.assertEqual(json.loads(next(root.glob('*.manifest.json')).read_text())['status'], 'failed')
            self.assertEqual(len(list(root.glob('*.sql.zst'))), 1)
            nas.publish.assert_not_called()

    def stored(self, root, day, restic):
        backup_id = '202611' + day + 'T000000Z-12345678'
        path = root / ('tag_observe-' + backup_id + '.sql.zst')
        path.write_bytes(('archive-' + day).encode())
        snap = day * 32
        module.atomic_json(path.with_suffix('.manifest.json'), {
            'backup_id': backup_id, 'file': path.name, 'status': 'verified', 'bytes': path.stat().st_size,
            'sha256': module.digest(path), 'restore': {'status': 'passed'},
            'restic': {'snapshot': snap, 'sql_sha256': 'c' * 64}, 'object': restic.object_name(snap)})
        return path

    def test_pressure_reclaims_restic_backed_dump_only_after_snapshot_readback(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, nas, restic = Path(tmp), Mock(remote='nas:test'), self.fake_restic()
            old = self.stored(root, '01', restic)
            latest = self.stored(root, '02', restic)
            nas.command.return_value.stdout = old.with_suffix('.manifest.json').read_bytes()
            restic.verify.side_effect = lambda *args: self.assertTrue(old.exists())
            with patch.object(module.shutil, 'disk_usage', return_value=Mock(free=0)):
                module.reclaim_for_capacity(root, nas, 100, root / 'current.json', {}, restic)
            self.assertFalse(old.exists())
            self.assertTrue(latest.exists())
            restic.verify.assert_called_once_with('01' * 32, 'c' * 64)
            nas.verify.assert_not_called()

    def test_restic_receipt_is_never_reclaimed_without_a_store_to_check_it(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, nas, restic = Path(tmp), Mock(remote='nas:test'), self.fake_restic()
            old = self.stored(root, '01', restic)
            self.stored(root, '02', restic)
            with patch.object(module.shutil, 'disk_usage', return_value=Mock(free=0)):
                module.reclaim_for_capacity(root, nas, 100, root / 'current.json', {})
            self.assertTrue(old.exists())

    @unittest.skipUnless(Path(module.RESTIC).is_file() and module.shutil.which('zstd'), 'restic and zstd required')
    def test_real_restic_round_trip_and_dedup(self):
        import subprocess
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'pw').write_text('test-password')
            repo = root / 'repo'
            restic = module.Restic(str(repo), root / 'pw', root / 'rclone.conf')
            subprocess.run([*restic.base, 'init', '-q'], env=restic.env, check=True)
            rows = [b"INSERT INTO `t` VALUES (%d,'%s');\n" % (i, b'x' * (i % 97)) for i in range(60000)]
            first, second = root / 'a.sql.zst', root / 'b.sql.zst'
            for path, body in ((first, b''.join(rows)), (second, b''.join(rows) + b"INSERT INTO `t` VALUES (60000,'new');\n")):
                subprocess.run(['zstd', '-q', '-o', str(path)], input=body, check=True)
            one = restic.backup(first, '20261113T000000Z-00000001')
            two = restic.backup(second, '20261113T000000Z-00000002')
            restic.verify(one['snapshot'], one['sql_sha256'])
            restic.verify(two['snapshot'], two['sql_sha256'])
            self.assertLess(two['data_added_packed'], one['data_added_packed'] / 2)
            with self.assertRaisesRegex(RuntimeError, 'readback'):
                restic.verify(two['snapshot'], one['sql_sha256'])


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

    def test_restore_capacity_is_checked_on_docker_filesystem(self):
        # sky-server: backups on /srv (85 GiB free), Docker on its own volume (174 GiB free).
        with tempfile.TemporaryDirectory() as tmp, tempfile.TemporaryDirectory() as docker_root:
            root, docker_root, nas = Path(tmp), Path(docker_root), Mock(remote='nas:test')
            nas.command.return_value = Mock(stdout=json.dumps({'free': 200*module.GIB}))
            nas.publish.side_effect = lambda p, relative: 'nas:test/' + relative
            free = lambda path: Mock(free=(174 if Path(path) == docker_root else 85)*module.GIB)
            with patch.object(module, 'source_sql', side_effect=['1000', '']), patch.object(module, 'source_storage_bytes', return_value=76*module.GIB), patch.object(module, 'schema_signature', return_value=(['articles'], 'schema')), patch.object(module.shutil, 'disk_usage', side_effect=free), patch.object(module, 'export_database', side_effect=lambda p: p.write_bytes(b'archive')), patch.object(module, 'restore_root', return_value=docker_root), patch.object(module, 'same_filesystem', return_value=False), patch.object(module, 'reclaim_for_capacity') as reclaim, patch.object(module, 'restore_drill', return_value={'status': 'passed'}) as restore:
                result = module.backup(root, nas, reclaim_verified=True)
            self.assertEqual(result['status'], 'verified')
            restore.assert_called_once()
            # Only post-backup maintenance runs, and it no longer charges the restore to /srv.
            reclaim.assert_called_once()
            self.assertLess(reclaim.call_args.args[2], module.RESERVE + module.GIB)

    def test_resume_checks_restore_capacity_on_docker_filesystem(self):
        with tempfile.TemporaryDirectory() as tmp, tempfile.TemporaryDirectory() as docker_root:
            root, docker_root, nas = Path(tmp), Path(docker_root), Mock(remote='nas:test')
            nas.command.return_value = Mock(stdout=json.dumps({'free': 200*module.GIB}))
            nas.publish.side_effect = lambda p, relative: 'nas:test/' + relative
            with patch.object(module, 'source_sql', side_effect=['1000', '']), patch.object(module, 'source_storage_bytes', return_value=76*module.GIB), patch.object(module, 'schema_signature', return_value=(['articles'], 'schema')), patch.object(module.shutil, 'disk_usage', return_value=Mock(free=85*module.GIB)), patch.object(module, 'export_database', side_effect=lambda p: p.write_bytes(b'archive')), patch.object(module, 'restore_root', return_value=root), patch.object(module, 'restore_drill') as restore:
                with self.assertRaisesRegex(RuntimeError, 'isolated restore'):
                    module.backup(root, nas)
                restore.assert_not_called()
            receipt = next(root.glob('*.manifest.json'))
            free = lambda path: Mock(free=(174 if Path(path) == docker_root else 85)*module.GIB)
            with patch.object(module.shutil, 'disk_usage', side_effect=free), patch.object(module, 'restore_root', return_value=docker_root), patch.object(module, 'same_filesystem', return_value=False), patch.object(module, 'restore_drill', return_value={'status': 'passed'}) as restore:
                result = module.resume_backup(root, receipt, nas)
            self.assertEqual(result['status'], 'verified')
            restore.assert_called_once()

    def test_space_loss_stops_stream_processes(self):
        process=Mock(); process.poll.return_value=None
        with patch.object(module.shutil,'disk_usage',return_value=Mock(free=module.RESERVE-1)):
            with self.assertRaisesRegex(RuntimeError,'25 GiB SSD reserve'):
                module.wait_pipeline([process],Path('/unused'))
        process.terminate.assert_called_once()

    def test_restore_estimate_keeps_all_headroom(self):
        self.assertEqual(module.restore_required(80*module.GIB),92*module.GIB+25*module.GIB)
