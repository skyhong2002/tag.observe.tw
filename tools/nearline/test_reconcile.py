import gzip
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from reconcile import reconcile_rows


class ReconciliationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.prepared = self.root / 'prepared.gz'
        self.outcomes = self.root / 'outcomes.gz'
        self.lineage = {'sourceKey': 'parent/tag/tag_cna/1', 'rawSha256': 'a'*64, 'generation': 'test', 'objects': ['b'*64]}
        self.row = {'lineage': self.lineage, 'raw': {'title': '中文\u2028原文'}}
        self.outcome = {'sourceKey': self.lineage['sourceKey'], 'rawHash': self.lineage['rawSha256'], 'action': 'inserted', 'articleId': '20'}

    def write(self, rows, outcomes):
        for path, contents in [(self.prepared, rows), (self.outcomes, outcomes)]:
            path.write_bytes(gzip.compress(''.join(json.dumps(row, ensure_ascii=False)+'\n' for row in contents).encode()))

    def check(self, count=1):
        return reconcile_rows(self.prepared, self.outcomes, count, 'tag_cna', 'parent/tag', 'test', 'b'*64)

    def test_full_accounting_and_decompressed_hash(self):
        self.write([self.row], [self.outcome])
        result = self.check()
        self.assertEqual(result['counts'], {'inserted': 1})
        self.assertEqual(result['normalized_sha256'], hashlib.sha256(gzip.decompress(self.prepared.read_bytes())).hexdigest())

    def test_missing_outcome_is_not_completion(self):
        self.write([self.row], [])
        with self.assertRaisesRegex(ValueError, 'row count mismatch'):
            self.check()

    def test_wrong_raw_identity_or_repeated_row_rejected(self):
        self.write([self.row], [dict(self.outcome, rawHash='c'*64)])
        with self.assertRaisesRegex(ValueError, 'corresponding prepared row'):
            self.check()
        self.write([self.row, self.row], [self.outcome, self.outcome])
        with self.assertRaisesRegex(ValueError, 'Duplicate source identity'):
            self.check(2)

    def test_quarantine_requires_reason_and_is_not_imported(self):
        self.write([self.row], [dict(self.outcome, action='quarantine', articleId=None, reason='invalid_url')])
        result = self.check()
        self.assertEqual(result['counts'], {'quarantine': 1})
        self.assertEqual(result['quarantine_reasons'], {'invalid_url': 1})
        self.write([self.row], [dict(self.outcome, action='quarantine', articleId=None)])
        with self.assertRaisesRegex(ValueError, 'Invalid quarantine'):
            self.check()


if __name__ == '__main__':
    unittest.main()
