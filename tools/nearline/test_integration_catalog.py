import copy
import unittest

from integration_catalog import catalog


class CatalogTests(unittest.TestCase):
    def setUp(self):
        self.plan = {'generation': 'g', 'mappingSha256': 'v2', 'tables': [
            {'table': 'tag_a', 'action': 'import_articles', 'reason': 'mapped'},
            {'table': 'show_a', 'action': 'nearline_only', 'reason': 'cache'},
            {'table': 'show_missing', 'action': 'source_gap', 'reason': 'source absent'},
        ]}
        self.manifest = {'generation': 'g', 'tables': {
            'tag_a': {'status': 'complete', 'schema': {'sha256': 'schema'},
                      'chunks': [{'sha256': 'raw', 'bytes': 10, 'raw_bytes': 100}]},
            'show_a': {'status': 'pending', 'chunks': []},
            'show_missing': {'status': 'excluded', 'error': '1146'},
        }}
        receipt = {'table': 'tag_a', 'chunk': 0, 'object': 'raw', 'rows': 2,
                   'counts': {'inserted': 1, 'quarantine': 1}, 'audit': 'audit-v2', 'prepared': 'prepared-v2',
                   'mapping_sha256': 'v2', 'allow_recent': True}
        self.state = {'generation': 'g', 'completed': {'tag_a/raw': receipt}}
        self.reconciled = {'generation': 'g', 'chunks': {'tag_a/raw': {
            'rows': 2, 'counts': receipt['counts'].copy(), 'raw_object': 'raw',
            'audit': 'audit-v2', 'prepared': 'prepared-v2', 'verifiedOrigins': 1,
            'quarantine_reasons': {'empty_title': 1},
        }}}

    def report(self):
        return catalog(self.plan, self.manifest, self.state, self.reconciled, True)

    def test_distinguishes_article_verification_quarantine_pending_archive_and_source_gap(self):
        report = self.report()
        self.assertTrue(report['summary']['all_article_tables_verified'])
        self.assertEqual(report['summary']['successful_origins'], 1)
        self.assertEqual(report['summary']['quarantined_rows'], 1)
        self.assertEqual(report['summary']['raw_pending_tables'], ['show_a'])
        self.assertEqual(report['summary']['declared_source_gaps'], ['show_missing'])
        self.assertEqual(report['tables'][0]['quarantine_reasons'], {'empty_title': 1})
        self.assertFalse(report['tables'][1]['raw_backup_complete'])

    def test_old_audit_does_not_prove_current_receipt(self):
        self.reconciled['chunks']['tag_a/raw']['audit'] = 'audit-v1'
        report = self.report()
        self.assertFalse(report['summary']['all_article_tables_verified'])
        self.assertEqual(report['tables'][0]['independently_verified_chunks'], 0)

    def test_policy_replay_prevents_verified_completion_even_when_old_audit_was_checked(self):
        receipt = self.state['completed']['tag_a/raw']
        receipt.update(mapping_sha256='v1', quarantine_reasons={'unreviewed_url_host': 1})
        report = self.report()
        self.assertEqual(report['tables'][0]['pending_policy_replays'], 1)
        self.assertFalse(report['summary']['all_article_tables_verified'])

    def test_missing_object_in_finished_table_prevents_completion(self):
        self.manifest['tables']['tag_a']['chunks'].append({'sha256': 'raw2', 'bytes': 1, 'raw_bytes': 2})
        self.assertFalse(self.report()['summary']['all_article_tables_verified'])

    def test_rejects_wrong_generation_unclassified_table_and_inconsistent_live_origin_proof(self):
        original = copy.deepcopy(self.reconciled)
        self.reconciled['generation'] = 'other'
        with self.assertRaisesRegex(ValueError, 'different generations'):
            self.report()
        self.reconciled = original
        self.manifest['tables']['unknown'] = {'status': 'pending'}
        with self.assertRaisesRegex(ValueError, 'exactly every source table'):
            self.report()
        del self.manifest['tables']['unknown']
        self.reconciled['chunks']['tag_a/raw']['verifiedOrigins'] = 0
        with self.assertRaisesRegex(ValueError, 'inconsistent evidence'):
            self.report()


if __name__ == '__main__':
    unittest.main()
