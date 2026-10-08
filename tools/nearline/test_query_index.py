import copy
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

from query_index import build_index, entry_id, legacy_entries, query_index


def obj(letter):
    sha = letter * 64
    return {'sha256': sha, 'object': f'objects/{sha[:2]}/{sha}.sql.gz', 'bytes': 10, 'raw_bytes': 100}


def manifest():
    return {'generation': 'generation-1', 'remote': 'nas:Archive/legacy', 'updated_at': '2026-10-08T00:00:00Z',
            'tables': {'tag_test': {'status': 'complete', 'pk': 'newsid', 'schema': obj('a'), 'chunks': [
                {**obj('b'), 'lower_exclusive': None, 'upper_inclusive': 9007199254740993},
                {**obj('c'), 'lower_exclusive': 9007199254740993, 'upper_inclusive': 18446744073709551615}]},
                'show_tag_hour': {'status': 'excluded', 'error': 'Source table unavailable'}}, 'programs': obj('d')}


def site_record():
    sha = 'e' * 64
    return {'type': 'archive', 'articleId': '9007199254740993', 'contentHash': 'f' * 64,
            'objectHash': sha, 'objectKey': f'objects/{sha[:2]}/{sha}.json.gz',
            'archiveRemote': 'nas:Archive/site', 'archivedAt': '2026-10-08T00:00:00Z', 'verifiedAt': '2026-10-08T00:01:00Z'}


class QueryIndexTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.index = self.root / 'index.sqlite'
        self.manifest = self.root / 'manifest.json'
        self.write_manifest(manifest())
        self.site = self.root / 'site.jsonl'
        self.site.write_text('\n'.join(json.dumps(x) for x in [
            {'type': 'header', 'format': 'tag-site-archive-snapshot-v1'}, site_record(), {'type': 'footer', 'records': 1}]) + '\n')

    def tearDown(self):
        self.temp.cleanup()

    def write_manifest(self, value):
        self.manifest.write_text(json.dumps(value))

    def build(self):
        return build_index(self.index, [self.manifest], site_snapshot=self.site)

    def test_both_sources_keep_different_granularity_and_gap(self):
        result = self.build()
        self.assertEqual(result['counts'], {'sql_schema': 1, 'sql_data': 2, 'source_gap': 1, 'sql_programs': 1, 'article_content': 1})
        site = query_index(self.index, {'articleId': '9007199254740993'})['entries'][0]
        self.assertEqual(site['retrieval'], {'adapter': 'site-content-v1', 'requiresConversion': False})
        self.assertIsNone(site['artifacts'][0]['bytes'])
        gap = query_index(self.index, {'table': 'show_tag_hour'})['entries'][0]
        self.assertEqual(gap['availability'], 'unavailable')
        self.assertEqual(gap['artifacts'], [])
        self.assertFalse(site['verification']['freshObjectReadback'])

    def test_big_primary_keys_and_exclusive_lower_bound(self):
        self.build()
        base = {'generation': 'generation-1', 'table': 'tag_test'}
        first = query_index(self.index, {**base, 'legacyId': '9007199254740993'})['entries']
        second = query_index(self.index, {**base, 'legacyId': '9007199254740994'})['entries']
        self.assertEqual(len(first), 1)
        self.assertEqual(len(second), 1)
        self.assertNotEqual(first[0]['id'], second[0]['id'])
        self.assertEqual(len(query_index(self.index, {**base, 'legacyId': '18446744073709551615'})['entries']), 1)
        for query in [{'legacyId': '1'}, {**base, 'legacyId': 9007199254740993}, {'articleId': '01'}]:
            with self.assertRaises(ValueError):
                query_index(self.index, query)

    def test_whole_table_and_empty_table_schema_remain_discoverable(self):
        m = manifest()
        m['tables']['tag_test']['pk'] = None
        m['tables']['tag_test']['chunks'] = [obj('b')]
        m['tables']['empty'] = {'status': 'complete', 'schema': obj('c'), 'chunks': []}
        self.write_manifest(m)
        self.build()
        result = query_index(self.index, {'generation': 'generation-1', 'table': 'tag_test', 'legacyId': '999'})
        self.assertEqual(result['count'], 1)
        self.assertTrue(result['entries'][0]['selector']['wholeTable'])
        self.assertEqual(query_index(self.index, {'table': 'empty'})['entries'][0]['kind'], 'sql_schema')

    def test_keyset_pagination_and_snapshot_bound_cursor(self):
        self.build()
        entries, cursor = [], None
        while True:
            q = {'limit': 2, **({'cursor': cursor} if cursor else {})}
            page = query_index(self.index, q)
            entries.extend(e['id'] for e in page['entries'])
            cursor = page['nextCursor']
            if cursor is None:
                break
        self.assertEqual(len(entries), 6)
        self.assertEqual(len(set(entries)), 6)
        cursor = query_index(self.index, {'limit': 1})['nextCursor']
        with self.assertRaises(ValueError):
            query_index(self.index, {'source': 'legacy', 'cursor': cursor})
        m = manifest(); m['updated_at'] = '2026-10-09T00:00:00Z'; self.write_manifest(m); self.build()
        with self.assertRaises(ValueError):
            query_index(self.index, {'cursor': cursor})

    def test_failed_refresh_does_not_replace_valid_index(self):
        self.build()
        old = self.index.read_bytes()
        self.site.write_text(self.site.read_text().split('{"type": "footer"')[0])
        with self.assertRaises(ValueError):
            self.build()
        self.assertEqual(self.index.read_bytes(), old)
        self.assertFalse(list(self.root.glob('*.partial')))

    def test_invalid_artifacts_and_false_catalog_links_are_rejected(self):
        for modify in [lambda m: m['tables']['tag_test']['chunks'][0].update(object='../wrong.sql.gz'),
                       lambda m: m['tables']['tag_test'].pop('schema')]:
            m = manifest(); modify(m)
            with self.assertRaises(ValueError):
                list(legacy_entries(m))
        catalog = {'generation': 'generation-1', 'tables': [
            {'table': table, 'source_status': info['status'], 'raw_chunks': len(info.get('chunks', [])),
             'action': 'import_articles', 'rows_accounted_for': 1, 'counts': {}, 'evidence': []}
            for table, info in manifest()['tables'].items()]}
        catalog['tables'][0]['evidence'] = [{'chunk': 0, 'raw_sha256': 'f' * 64}]
        with self.assertRaises(ValueError):
            list(legacy_entries(manifest(), catalog))

    def test_query_is_read_only_and_requires_known_fields(self):
        self.build(); before = self.index.read_bytes()
        self.assertEqual(query_index(self.index, {'objectHash': 'b' * 64})['count'], 1)
        self.assertEqual(self.index.read_bytes(), before)
        for q in [{'q': 'unimplemented full text'}, {'limit': 101}, {'limit': True}, {'source': 'unknown'}]:
            with self.assertRaises(ValueError):
                query_index(self.index, q)

    def test_typescript_adapters_produce_identical_entry_ids_and_site_contract(self):
        # Cross-language agreement is essential for article_origins -> package lookup.
        repo = Path(__file__).resolve().parents[2]
        script = '''import { siteArchiveEntry, legacyOriginReference } from './app/src/nearline/query-index.ts';
const record = JSON.parse(process.argv[1]);
console.log(JSON.stringify({site:siteArchiveEntry(record), origin:legacyOriginReference({sourceKey:'tag-analysis/tag/tag_test/9007199254740994', rawHash:'a'.repeat(64),articleId:record.articleId,generation:'generation-1',sourceObject:'c'.repeat(64)})}));'''
        data = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', script, json.dumps(site_record())], cwd=repo, text=True))
        self.build()
        self.assertEqual(data['site'], query_index(self.index, {'articleId': site_record()['articleId']})['entries'][0])
        match = query_index(self.index, data['origin']['query'])['entries']
        self.assertEqual(len(match), 1)
        self.assertEqual(match[0]['id'], entry_id('sql_data', 'generation-1', 'tag_test', 'c' * 64))


if __name__ == '__main__':
    unittest.main()
