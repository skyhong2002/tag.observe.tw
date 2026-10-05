import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('integration_status', Path(__file__).with_name('integration-status.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class StatusTests(unittest.TestCase):
    def test_revised_receipts_and_pending_replays_are_not_reported_as_currently_complete(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            backup = root / 'backup'
            backup.mkdir()
            def write(path, value):
                path.write_text(json.dumps(value))
            write(root / 'backup-config.json', {'state_dir': str(backup)})
            write(backup / 'state.json', {'generation': 'g', 'tables': {'tag_cna': {'status': 'complete', 'chunks': [{'sha256': 'a'}]}}})
            write(root / 'plan.json', {'generation': 'g', 'mappingSha256': 'new', 'tables': [{'table': 'tag_cna', 'action': 'import_articles'}]})
            row = {'rows': 10, 'audit': 'new-audit', 'counts': {'quarantine': 10}, 'quarantine_reasons': {'unreviewed_url_host': 10}, 'mapping_sha256': 'old'}
            write(root / 'state.json', {'generation': 'g', 'status': 'running', 'completed': {'tag_cna/a': row}})
            write(root / 'reconciliation.json', {'generation': 'g', 'chunks': {'tag_cna/a': {'audit': 'old-audit'}}})
            cfg = {'state_dir': str(root), 'plan': str(root / 'plan.json'), 'backup_config': str(root / 'backup-config.json'), 'allow_recent': True}
            result = module.status(cfg)
            self.assertEqual(result['completed_tables'], [])
            self.assertEqual(result['reprocessing_pending_chunks'], 1)
            self.assertEqual(result['independently_verified_current_chunks'], 0)
            row['mapping_sha256'] = 'new'
            write(root / 'state.json', {'generation': 'g', 'status': 'running', 'completed': {'tag_cna/a': row}})
            write(root / 'reconciliation.json', {'generation': 'g', 'chunks': {'tag_cna/a': {'audit': 'new-audit'}}})
            result = module.status(cfg)
            self.assertEqual(result['completed_tables'], ['tag_cna'])
            self.assertEqual(result['independently_verified_current_rows'], 10)
            self.assertEqual(result['successful_origins'], 0)
