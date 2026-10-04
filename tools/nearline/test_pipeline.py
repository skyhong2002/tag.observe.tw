import copy
import gzip
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock

from pipeline import Pipeline, plan_tables, schema_signature, validate_gzip, write_json


class ArchiveTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.cfg = json.loads(Path(__file__).with_name('config.example.json').read_text())
        self.cfg['state_dir'] = self.tmp.name
        self.inventory = {'tables': [['items', 'MyISAM', '100', '100000', '1000']],
                          'keys': [['items', 'id', 'bigint']]}
        self.pipeline = Pipeline(self.cfg)
        self.table = plan_tables(self.inventory, self.cfg)['items']
        self.pipeline.state = {'tables': {'items': self.table}}
        self.pipeline.checkpoint = Mock()

    def ready_table(self):
        self.table.update(schema={'structure_sha256': 's'}, maximum=100, after=20, chunk_rows=10, status='running')
        self.pipeline.source = Mock(return_value={'upper': 30})

    def test_failed_readback_does_not_advance_range(self):
        self.ready_table()
        self.pipeline.export = Mock(side_effect=RuntimeError('NAS checksum mismatch'))
        before = copy.deepcopy(self.table)
        with self.assertRaisesRegex(RuntimeError, 'checksum'):
            self.pipeline.step('items', self.table)
        self.assertEqual(self.table, before)
        self.pipeline.checkpoint.assert_not_called()

    def test_retry_uses_same_range_and_only_verified_object_is_committed(self):
        self.ready_table()
        self.pipeline.export = Mock(side_effect=[RuntimeError('disconnected'), {'sha256': 'verified'}])
        with self.assertRaises(RuntimeError):
            self.pipeline.step('items', self.table)
        self.pipeline.step('items', self.table)
        self.assertEqual(self.pipeline.export.call_args_list[0], self.pipeline.export.call_args_list[1])
        self.assertEqual(self.table['after'], 30)
        self.assertEqual(len(self.table['chunks']), 1)
        self.assertEqual(self.table['chunks'][0]['lower_exclusive'], 20)

    def test_size_limit_reduces_batch_without_skipping_data(self):
        self.ready_table()
        self.pipeline.export = Mock(side_effect=RuntimeError('RAW_LIMIT: too large'))
        self.pipeline.step('items', self.table)
        self.assertEqual(self.table['chunk_rows'], 5)
        self.assertEqual(self.table['after'], 20)
        self.assertEqual(self.table['chunks'], [])

    def test_failed_bounds_does_not_leave_incomplete_schema_state(self):
        self.pipeline.export = Mock(return_value={'structure_sha256': 's'})
        self.pipeline.source = Mock(side_effect=RuntimeError('timeout'))
        with self.assertRaises(RuntimeError):
            self.pipeline.step('items', self.table)
        self.assertNotIn('schema', self.table)

    def test_primary_key_is_not_assumed_for_composite_or_text_key(self):
        for keys in [[['items', 'id', 'varchar']], [['items', 'id', 'int'], ['items', 'other', 'int']]]:
            inv = dict(self.inventory, keys=keys)
            cfg = dict(self.cfg, max_unkeyed_bytes=1)
            table = plan_tables(inv, cfg)['items']
            self.assertEqual(table['status'], 'blocked')
            self.assertIsNone(table['pk'])

    def test_known_missing_table_remains_a_gap_when_inventory_omits_it(self):
        tables = plan_tables(self.inventory, self.cfg)
        self.assertEqual(tables['show_tag_hour']['status'], 'excluded')
        self.assertTrue(tables['show_tag_hour']['inventory_missing'])

    def test_auto_increment_changes_do_not_mask_real_ddl_change(self):
        paths = [Path(self.tmp.name) / str(i) for i in range(3)]
        for path, sql in zip(paths, [b'CREATE TABLE t (id int) AUTO_INCREMENT=1;',
                                     b'CREATE TABLE t (id int) AUTO_INCREMENT=2;',
                                     b'CREATE TABLE t (id bigint) AUTO_INCREMENT=2;']):
            path.write_bytes(gzip.compress(sql))
        self.assertEqual(schema_signature(paths[0]), schema_signature(paths[1]))
        self.assertNotEqual(schema_signature(paths[1]), schema_signature(paths[2]))

    def test_gzip_corruption_rejected(self):
        path = Path(self.tmp.name) / 'bad.gz'
        path.write_bytes(gzip.compress(b'important backup')[:-5])
        with self.assertRaises(EOFError):
            validate_gzip(path)

    def test_checkpoint_survives_process_restart(self):
        self.pipeline.state.update(source='tag-analysis/tag', remote=self.cfg['remote'])
        write_json(self.pipeline.state_path, self.pipeline.state)
        loaded = Pipeline(self.cfg)
        self.assertEqual(loaded.state, self.pipeline.state)

    def test_fetch_rejects_path_traversal_before_network_access(self):
        self.pipeline.rclone = Mock()
        with self.assertRaises(ValueError):
            self.pipeline.fetch_object({'sha256': '../secret', 'object': '../secret'}, Path(self.tmp.name) / 'out')
        self.pipeline.rclone.assert_not_called()


if __name__ == '__main__':
    unittest.main()
