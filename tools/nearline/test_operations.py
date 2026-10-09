import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch, Mock

from operations import Operations, RequestError
from query_index import build_index, query_index
from test_query_index import manifest


class OperationsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.index = self.root / 'index.sqlite'
        self.source = self.root / 'manifest.json'
        self.source.write_text(json.dumps(manifest()))
        build_index(self.index, [self.source])
        self.token = self.root / 'token'
        self.token.write_text('test-token-' * 8)
        self.ops = Operations({'state_dir': str(self.root / 'jobs'), 'index': str(self.index), 'token_file': str(self.token)})
        page = query_index(self.index, {'kind': 'sql_data', 'limit': 1})
        self.request = {'entryId': page['entries'][0]['id'], 'indexRevision': page['indexRevision']}

    def tearDown(self):
        self.tmp.cleanup()

    def enqueue(self, value=None):
        with patch('operations.shutil.disk_usage', return_value=Mock(free=100*2**30)):
            return self.ops.enqueue(value or self.request)

    def test_duplicate_enqueue_and_restart_recovery(self):
        job = self.enqueue()
        self.assertEqual(self.enqueue()['id'], job['id'])
        claimed = self.ops.claim()
        self.assertEqual(claimed['id'], job['id'])
        self.assertEqual(self.ops.job(job['id'])['attempts'], 1)
        self.ops.recover()
        self.assertEqual(self.ops.job(job['id'])['status'], 'queued')

    def test_snapshot_and_missing_source_are_rejected_before_work(self):
        with self.assertRaises(RequestError) as error:
            self.enqueue(self.request | {'indexRevision': 'stale'})
        self.assertEqual(error.exception.status, 409)
        gap = query_index(self.index, {'kind': 'source_gap'})['entries'][0]
        with self.assertRaises(RequestError):
            self.enqueue(self.request | {'entryId': gap['id']})
        with self.assertRaises(RequestError):
            self.enqueue(self.request | {'remote': 'untrusted:anywhere'})

    def test_selector_cannot_escape_package_and_ids_remain_strings(self):
        with self.assertRaises((RequestError, ValueError)):
            self.enqueue(self.request | {'selector': {'legacyId': 123}})
        entry = self.ops.entry(self.request['entryId'], self.request['indexRevision'])
        outside = str(int(entry['selector']['upperInclusive']) + 1)
        with self.assertRaises(RequestError):
            self.enqueue(self.request | {'selector': {'legacyId': outside}})

    def test_no_ssd_space_never_queues(self):
        with patch('operations.shutil.disk_usage', return_value=Mock(free=0)), self.assertRaises(RequestError) as error:
            self.ops.enqueue(self.request)
        self.assertEqual(error.exception.status, 503)
        self.assertIsNone(self.ops.claim())

    def test_worker_failure_does_not_claim_ready_and_retry_is_bounded(self):
        job = self.enqueue()
        for attempt in range(3):
            with patch.object(self.ops, 'execute', side_effect=RuntimeError('private remote/path')):
                self.assertTrue(self.ops.run_one())
            status = self.ops.job(job['id'])
            self.assertEqual(status['status'], 'failed')
            self.assertNotIn('private remote/path', status['error'])
            if attempt < 2:
                self.ops.retry(job['id'])
        with self.assertRaises(RequestError):
            self.ops.retry(job['id'])

    def test_result_pages_and_expiry(self):
        job = self.enqueue()
        directory = self.ops.root / job['id']; directory.mkdir()
        self.ops.records(directory, [{'raw': {'newsid': str(i)}} for i in range(5)], job['id'], {})
        self.ops.update(job['id'],status='ready',stage='ready',result=json.dumps({'records':5,'files':{}}))
        page = self.ops.results(job['id'],limit=2)
        self.assertEqual(page['count'],2)
        self.assertEqual(page['nextCursor'],'2')
        self.assertEqual(self.ops.results(job['id'],after=2,limit=10)['count'],3)
        with self.ops.connection() as db:
            db.execute("UPDATE jobs SET updated_at='2000-01-01T00:00:00+00:00' WHERE id=?",(job['id'],))
        self.ops.expire()
        self.assertFalse(directory.exists())
        with self.assertRaises(RequestError) as error:
            self.ops.results(job['id'])
        self.assertEqual(error.exception.status,410)
