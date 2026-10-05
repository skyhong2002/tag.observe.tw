import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch

from integrate import archive_directory, integrate, needs_processing, summarize


class IntegrationTests(unittest.TestCase):
    def test_readback_failure_does_not_publish_completion_manifest(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)
            (path / 'report.json').write_text('{"important":true}')
            pipeline = Mock()
            def rclone(*args, **kwargs):
                if args[0] == 'cat':
                    kwargs['stdout'].write(b'corrupt')
            pipeline.rclone.side_effect = rclone
            with self.assertRaisesRegex(RuntimeError, 'readback mismatch'):
                archive_directory(pipeline, path, 'nas:test')
            self.assertFalse((path / 'archive-manifest.json').exists())
            self.assertTrue((path / 'report.json').exists())

    def test_archive_includes_compressed_audit_and_verified_manifest(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)
            (path / 'outcomes.jsonl').write_text('{"articleId":"1"}\n')
            remote = {}
            pipeline = Mock()
            def rclone(*args, **kwargs):
                if args[0] == 'copyto':
                    remote[args[2]] = Path(args[1]).read_bytes()
                elif 'stdout' in kwargs:
                    kwargs['stdout'].write(remote[args[1]])
                else:
                    return Mock(stdout=remote[args[1]])
            pipeline.rclone.side_effect = rclone
            result = archive_directory(pipeline, path, 'nas:test')
            self.assertEqual([f['file'] for f in result['files']], ['outcomes.jsonl.gz'])
            self.assertEqual(json.loads(remote['nas:test/archive-manifest.json'])['status'], 'verified')

    def test_failed_audit_upload_resumes_committed_apply_before_cleaning_workspace(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            backup = root / 'backup.json'
            backup.write_text(json.dumps({'remote': 'nas:test'}))
            plan = root / 'plan.json'
            plan.write_text(json.dumps({'generation': 'test', 'tables': [{'table': 'tag_cna', 'media': 'cna', 'action': 'import_articles'}]}))
            manifest = {'source': 'tag-analysis/tag', 'consistency': 'rolling', 'tables': {'tag_cna': {'status': 'complete', 'schema': {}, 'chunks': [{'sha256': 'abc'}]}}}
            remote = {}
            pipeline = Mock()
            pipeline.cfg = {'remote': 'nas:test'}
            pipeline.load_manifest.return_value = manifest
            pipeline.fetch_object.side_effect = lambda obj, target: target.write_bytes(b'fake verified SQL')
            fail_audit = [True]
            def rclone(*args, **kwargs):
                if args[0] == 'copyto':
                    if fail_audit[0] and '/apply-' in args[2]:
                        raise RuntimeError('NAS audit upload interrupted')
                    remote[args[2]] = Path(args[1]).read_bytes()
                elif 'stdout' in kwargs:
                    kwargs['stdout'].write(remote[args[1]])
                else:
                    return Mock(stdout=remote[args[1]])
            pipeline.rclone.side_effect = rclone
            applies = []
            def run(command, **kwargs):
                out = Path(command[command.index('--out') + 1]); out.mkdir()
                if command[0] == 'python3':
                    (out / 'source-manifest.json').write_text('{}')
                    (out / 'report.json').write_text(json.dumps({'compressedSha256': 'data'}))
                    (out / 'articles.jsonl.gz').write_bytes(b'prepared')
                else:
                    applies.append(command)
                    recent = '--allow-recent' in command
                    counts = {'inserted': 1} if recent else {'quarantine': 1}
                    outcome = {'action': 'inserted'} if recent else {'action': 'quarantine', 'reason': 'recent_requires_separate_review'}
                    (out / 'report.json').write_text(json.dumps({'status': 'complete', 'processed': 1, 'rows': 1, 'packageSha256': 'data', 'counts': counts, 'verifiedOrigins': int(recent), 'allowRecent': recent}))
                    (out / 'outcomes.jsonl').write_text(json.dumps(outcome) + '\n')
            config = {'state_dir': str(root / 'state'), 'backup_config': str(backup), 'plan': str(plan), 'code_root': str(root), 'env_file': 'unused', 'pause_seconds': 0}
            with patch('integrate.Pipeline', return_value=pipeline), patch('integrate.run_checked', side_effect=run), patch('integrate.shutil.disk_usage', return_value=Mock(free=100*2**30)):
                with self.assertRaisesRegex(RuntimeError, 'audit upload interrupted'):
                    integrate(config)
                state = json.loads((root / 'state/state.json').read_text())
                self.assertEqual(state['completed'], {})
                self.assertTrue((root / 'state/work/unversioned/tag_cna/abc/prepared').exists())
                fail_audit[0] = False
                integrate(config)
                state = json.loads((root / 'state/state.json').read_text())
                self.assertEqual(state['status'], 'plan_complete')
                self.assertEqual(len(applies), 1, 'resume archives prior committed results, without repeating apply')
                self.assertFalse((root / 'state/work/unversioned/tag_cna/abc').exists())
                pipeline.load_manifest.reset_mock()
                integrate(config)
                pipeline.load_manifest.assert_not_called()
                old_result = state['completed']['tag_cna/abc']
                old_remote = dict(remote)
                config['allow_recent'] = True
                integrate(config)
                state = json.loads((root / 'state/state.json').read_text())
                latest = state['completed']['tag_cna/abc']
                self.assertEqual(len(applies), 2)
                self.assertIn('--allow-recent', applies[-1])
                self.assertTrue(latest['allow_recent'])
                self.assertEqual(latest['counts'], {'inserted': 1})
                self.assertIn('/integration-v3/unversioned/recent/', latest['audit'])
                self.assertEqual(state['previous_results']['tag_cna/abc'], [old_result])
                for path, data in old_remote.items():
                    if '/checkpoint.json' not in path:
                        self.assertEqual(remote[path], data, 'previous receipts remain immutable')
                integrate(config)
                self.assertEqual(len(applies), 2, 'completed recent pass is idempotent')

    def test_recent_policy_revisits_only_temporarily_held_chunks(self):
        recent = {'quarantine_reasons': {'recent_requires_separate_review': 10}}
        self.assertTrue(needs_processing(None, False))
        self.assertFalse(needs_processing(recent, False))
        self.assertTrue(needs_processing(recent, True))
        self.assertFalse(needs_processing(dict(recent, allow_recent=True), True))
        self.assertFalse(needs_processing({'quarantine_reasons': {'invalid_url': 10}}, True))

    def test_url_policy_revision_retries_host_and_invalid_url_quarantines_once(self):
        previous = {'mapping_sha256': 'old', 'quarantine_reasons': {'unreviewed_url_host,empty_title': 1}}
        self.assertTrue(needs_processing(previous, True, 'new'))
        self.assertFalse(needs_processing(previous, True, 'old'))
        invalid = {'mapping_sha256': 'old', 'quarantine_reasons': {'invalid_url,empty_title': 1}}
        self.assertTrue(needs_processing(invalid, True, 'new'))
        self.assertFalse(needs_processing(invalid, True, 'old'))
        self.assertFalse(needs_processing({'mapping_sha256': 'old', 'quarantine_reasons': {'invalid_publication_time': 1}}, True, 'new'))
        self.assertFalse(needs_processing({'mapping_sha256': 'old', 'quarantine_reasons': {'invalid_url': 0}}, True, 'new'))

    def test_summary_counts_quarantine_separately(self):
        state = {'completed': {'one': {'counts': {'inserted': 9, 'quarantine': 1}}, 'two': {'counts': {'already_imported': 2}}}}
        self.assertEqual(summarize(state), {'completed_chunks': 2, 'rows': 12, 'counts': {'inserted': 9, 'quarantine': 1, 'already_imported': 2}})


if __name__ == '__main__':
    unittest.main()
