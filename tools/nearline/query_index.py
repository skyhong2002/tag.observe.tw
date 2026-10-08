#!/usr/bin/env python3
"""Build and query an SSD metadata index; never fetch or execute archived SQL."""
import argparse
import base64
from collections import Counter
from contextlib import closing
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import tempfile

FORMAT = 'tag-nearline-index-v1'
QUERY_FORMAT = 'tag-nearline-query-v1'
SOURCES = {'legacy', 'site'}
KINDS = {'sql_data', 'sql_schema', 'sql_programs', 'article_content', 'source_gap'}
HASH = re.compile(r'^[a-f0-9]{64}$')
NAME = re.compile(r'^[A-Za-z0-9_-]{1,128}$')


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def digest(data):
    return hashlib.sha256(data).hexdigest()


def entry_id(kind, *parts):
    return 'nli1_' + digest('\0'.join([kind, *parts]).encode())


def decimal(value):
    # Require strings at the external boundary: JS numbers can lose primary keys.
    if not isinstance(value, str) or not re.fullmatch(r'-?(0|[1-9]\d*)', value) or value == '-0':
        raise ValueError('IDs and primary-key bounds must be canonical decimal strings')
    number = int(value)
    if not -(2 ** 63) <= number <= 2 ** 64 - 1:
        raise ValueError('Primary key outside MySQL 64-bit integer range')
    return value


def sortable_key(value):
    return str(int(decimal(value)) + 2 ** 63).zfill(20)


def name(value):
    if not isinstance(value, str) or not NAME.fullmatch(value):
        raise ValueError('Invalid generation or table name')
    return value


def artifact(remote, obj, role, suffix):
    sha = obj.get('sha256')
    if not isinstance(sha, str) or not HASH.fullmatch(sha):
        raise ValueError('Invalid artifact SHA256')
    key = f'objects/{sha[:2]}/{sha}.{suffix}'
    if obj.get('object') != key:
        raise ValueError('Artifact key and digest do not match')
    for field in ['bytes', 'raw_bytes']:
        value = obj.get(field)
        if value is not None and (type(value) is not int or value < 0):
            raise ValueError('Invalid artifact size')
    if not isinstance(remote, str) or not re.fullmatch(r'[A-Za-z0-9_-]+:[^\x00\r\n]+', remote):
        raise ValueError('Invalid configured archive remote')
    return {'role': role, 'remote': remote.rstrip('/'), 'key': key, 'sha256': sha,
            'bytes': obj.get('bytes'), 'rawBytes': obj.get('raw_bytes')}


def legacy_entries(manifest, catalog=None):
    generation = name(manifest['generation'])
    remote = manifest['remote']
    classified = {}
    if catalog is not None:
        if catalog['generation'] != generation:
            raise ValueError('Catalog and manifest generations differ')
        classified = {t['table']: t for t in catalog['tables']}
        if len(classified) != len(catalog['tables']) or set(classified) != set(manifest['tables']):
            raise ValueError('Catalog must account for exactly the manifest tables')
    for table, info in manifest['tables'].items():
        name(table)
        classification = classified.get(table)
        if classification and (classification['source_status'] != info['status']
                               or classification['raw_chunks'] != len(info.get('chunks', []))):
            raise ValueError('Catalog table status/chunk count differs from manifest')
        source = {'type': 'legacy', 'generation': generation, 'table': table,
                  'tableComplete': info['status'] == 'complete'}
        integration = {'classification': classification['action'] if classification else 'unclassified',
                       'mappingSha256': catalog.get('mapping_sha256') if catalog else None,
                       'tableRowsAccountedFor': classification['rows_accounted_for'] if classification else None,
                       'tableQuarantinedRows': classification.get('counts', {}).get('quarantine', 0) if classification else None}
        if info['status'] == 'excluded':
            yield {'id': entry_id('source_gap', generation, table), 'kind': 'source_gap', 'source': source,
                   'availability': 'unavailable', 'format': None, 'selector': None, 'artifacts': [],
                   'retrieval': {'adapter': None, 'requiresConversion': False}, 'integration': integration,
                   'verification': None, 'reason': info.get('error', 'Excluded source table')}
            continue
        schema = artifact(remote, info['schema'], 'schema', 'sql.gz') if info.get('schema') else None
        evidence = {e['chunk']: e for e in classification.get('evidence', [])} if classification else {}
        if schema:
            yield {'id': entry_id('sql_schema', generation, table, schema['sha256']), 'kind': 'sql_schema',
                   'source': source, 'availability': 'archived', 'format': 'mysql-sql-gzip', 'selector': None,
                   'artifacts': [schema], 'retrieval': {'adapter': 'legacy-isolated-sql', 'requiresConversion': True},
                   'integration': integration, 'verification': {'basis': 'source-manifest-receipt',
                   'observedAt': manifest.get('updated_at'), 'freshObjectReadback': False}}
        for index, chunk in enumerate(info.get('chunks', [])):
            if not schema:
                raise ValueError('Data package has no captured schema')
            data = artifact(remote, chunk, 'data', 'sql.gz')
            lower, upper = chunk.get('lower_exclusive'), chunk.get('upper_inclusive')
            lower = decimal(str(lower)) if lower is not None else None
            upper = decimal(str(upper)) if upper is not None else None
            if lower is not None and upper is not None and int(lower) >= int(upper):
                raise ValueError('Invalid primary-key interval')
            proof = evidence.get(index)
            if proof and proof['raw_sha256'] != data['sha256']:
                raise ValueError('Catalog evidence references a different package')
            yield {'id': entry_id('sql_data', generation, table, data['sha256']), 'kind': 'sql_data',
                   'source': {**source, 'chunk': index}, 'availability': 'archived', 'format': 'mysql-sql-gzip',
                   'selector': {'type': 'legacy_range', 'key': info.get('pk'), 'lowerExclusive': lower,
                                'upperInclusive': upper, 'wholeTable': not bool(info.get('pk'))},
                   'artifacts': [schema, data],
                   'retrieval': {'adapter': 'legacy-isolated-sql', 'requiresConversion': True},
                   'integration': {**integration, 'packageIndependentlyVerified': bool(proof and proof['independently_verified']),
                                   'packageReplayPending': bool(proof and proof.get('policy_replay_pending')),
                                   'preparedReceipt': proof['prepared'] if proof else None,
                                   'applyReceipt': proof['audit'] if proof else None},
                   'verification': {'basis': 'source-manifest-receipt', 'observedAt': chunk.get('captured_at'),
                                    'freshObjectReadback': False}}
    if manifest.get('programs'):
        programs = artifact(remote, manifest['programs'], 'programs', 'sql.gz')
        yield {'id': entry_id('sql_programs', generation, programs['sha256']), 'kind': 'sql_programs',
               'source': {'type': 'legacy', 'generation': generation, 'table': None, 'tableComplete': None},
               'availability': 'archived', 'format': 'mysql-sql-gzip', 'selector': None, 'artifacts': [programs],
               'retrieval': {'adapter': 'legacy-programs-review', 'requiresConversion': True}, 'integration': None,
               'verification': {'basis': 'source-manifest-receipt', 'observedAt': manifest.get('updated_at'),
                                'freshObjectReadback': False}}


def site_entries(path):
    """Consume a complete, framed, read-only export of article_archives."""
    with Path(path).open() as stream:
        header = json.loads(next(stream))
        if header.get('format') != 'tag-site-archive-snapshot-v1' or header.get('type') != 'header':
            raise ValueError('Unsupported site archive snapshot')
        count = 0
        for line in stream:
            row = json.loads(line)
            if row.get('type') == 'footer':
                if row.get('records') != count or any(line.strip() for line in stream):
                    raise ValueError('Site snapshot footer count or trailing data mismatch')
                return
            if row.get('type') != 'archive':
                raise ValueError('Invalid site archive snapshot record')
            article_id = decimal(row['articleId'])
            if int(article_id) <= 0 or not HASH.fullmatch(row['contentHash']):
                raise ValueError('Invalid site article identity')
            obj = artifact(row['archiveRemote'], {'object': row['objectKey'], 'sha256': row['objectHash']}, 'content', 'json.gz')
            if not isinstance(row.get('verifiedAt'), str):
                raise ValueError('Site content has no verification receipt')
            if dt.datetime.fromisoformat(row['verifiedAt'].replace('Z', '+00:00')).tzinfo is None:
                raise ValueError('Verification time must include its timezone')
            yield {'id': entry_id('article_content', article_id, row['contentHash']), 'kind': 'article_content',
                   'source': {'type': 'site', 'generation': None, 'table': 'articles', 'tableComplete': None},
                   'availability': 'archived', 'format': 'tag-content-v1-gzip',
                   'selector': {'type': 'article_version', 'articleId': article_id, 'contentHash': row['contentHash']},
                   'artifacts': [obj], 'retrieval': {'adapter': 'site-content-v1', 'requiresConversion': False},
                   'integration': None, 'verification': {'basis': 'article-archives-receipt',
                   'observedAt': row['verifiedAt'], 'freshObjectReadback': False}}
            count += 1
    raise ValueError('Truncated site snapshot: missing footer')


SCHEMA = '''
CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE entries (
 id TEXT PRIMARY KEY, source TEXT NOT NULL, kind TEXT NOT NULL,
 generation TEXT, table_name TEXT, article_id TEXT, object_hash TEXT,
 lower_key TEXT, upper_key TEXT, whole_table INTEGER NOT NULL, payload TEXT NOT NULL);
CREATE INDEX legacy_lookup ON entries(generation,table_name,kind,upper_key);
CREATE INDEX article_lookup ON entries(article_id,id);
CREATE INDEX object_lookup ON entries(object_hash,id);
CREATE INDEX source_lookup ON entries(source,kind,id);
'''


def build_index(output, manifests, catalogs=(), site_snapshot=None):
    output = Path(output)
    if output.is_symlink():
        raise ValueError('Index destination must not be a symlink')
    output.parent.mkdir(parents=True, exist_ok=True)
    inputs, catalog_by_generation = [], {}
    for path in catalogs:
        data = Path(path).read_bytes(); catalog = json.loads(data)
        if catalog['generation'] in catalog_by_generation:
            raise ValueError('Duplicate catalog generation')
        catalog_by_generation[catalog['generation']] = catalog
        inputs.append({'role': 'catalog', 'sha256': digest(data), 'observedAt': catalog.get('observed_at')})
    seen = set()
    fd, temporary = tempfile.mkstemp(prefix=output.name + '.', suffix='.partial', dir=output.parent)
    os.close(fd)
    connection = sqlite3.connect(temporary)
    counts = Counter()
    try:
        connection.executescript(SCHEMA)
        def insert(entry):
            selector = entry['selector'] or {}
            primary = next((obj for obj in entry['artifacts'] if obj['role'] != 'schema'), None)
            if primary is None and entry['artifacts']:
                primary = entry['artifacts'][0]
            connection.execute('INSERT INTO entries VALUES (?,?,?,?,?,?,?,?,?,?,?)', (
                entry['id'], entry['source']['type'], entry['kind'], entry['source'].get('generation'),
                entry['source'].get('table'), selector.get('articleId'), primary['sha256'] if primary else None,
                sortable_key(selector['lowerExclusive']) if selector.get('lowerExclusive') is not None else None,
                sortable_key(selector['upperInclusive']) if selector.get('upperInclusive') is not None else None,
                int(selector.get('wholeTable', False)), canonical(entry)))
            counts[entry['kind']] += 1
        for path in manifests:
            data = Path(path).read_bytes(); manifest = json.loads(data)
            generation = manifest['generation']
            if generation in seen:
                raise ValueError('Duplicate manifest generation')
            seen.add(generation)
            inputs.append({'role': 'legacy-manifest', 'generation': generation, 'sha256': digest(data),
                           'observedAt': manifest.get('updated_at')})
            for entry in legacy_entries(manifest, catalog_by_generation.get(generation)):
                insert(entry)
        if set(catalog_by_generation) - seen:
            raise ValueError('Catalog supplied without its source manifest')
        if site_snapshot is not None:
            with Path(site_snapshot).open('rb') as stream:
                sha = hashlib.file_digest(stream, 'sha256').hexdigest()
            with Path(site_snapshot).open() as stream:
                captured_at = json.loads(next(stream)).get('capturedAt')
            inputs.append({'role': 'site-snapshot', 'sha256': sha, 'observedAt': captured_at})
            for entry in site_entries(site_snapshot):
                insert(entry)
            with Path(site_snapshot).open('rb') as stream:
                if hashlib.file_digest(stream, 'sha256').hexdigest() != sha:
                    raise ValueError('Site snapshot changed during index build')
        if not inputs:
            raise ValueError('At least one source snapshot is required')
        metadata = {'format': FORMAT, 'revision': digest(canonical(sorted(inputs, key=canonical)).encode()),
                    'builtAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'inputs': inputs,
                    'counts': dict(counts), 'scope': 'Metadata receipts only; no archive objects fetched or restored.'}
        connection.execute('INSERT INTO metadata VALUES (?,?)', ('snapshot', canonical(metadata)))
        connection.commit()
        assert connection.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
        connection.close()
        with open(temporary, 'rb') as stream:
            os.fsync(stream.fileno())
        os.replace(temporary, output)
        return metadata
    finally:
        connection.close()
        Path(temporary).unlink(missing_ok=True)


def query_index(path, query):
    allowed = {'source', 'kind', 'generation', 'table', 'articleId', 'legacyId', 'objectHash', 'id', 'limit', 'cursor'}
    if not isinstance(query, dict) or set(query) - allowed:
        raise ValueError('Unknown query fields')
    limit = query.get('limit', 50)
    if type(limit) is not int or not 1 <= limit <= 100:
        raise ValueError('limit must be an integer from 1 to 100')
    filters = {k: v for k, v in query.items() if k not in {'limit', 'cursor'}}
    clauses, values = [], []
    for key, value in filters.items():
        column = {'table': 'table_name', 'articleId': 'article_id', 'objectHash': 'object_hash'}.get(key, key)
        if key in {'articleId', 'legacyId'}:
            decimal(value)
            if key == 'articleId' and int(value) <= 0:
                raise ValueError('articleId must be positive')
        elif key in {'generation', 'table'}:
            name(value)
        elif key == 'objectHash':
            if not isinstance(value, str) or not HASH.fullmatch(value):
                raise ValueError('Invalid objectHash')
        elif key == 'source' and (not isinstance(value, str) or value not in SOURCES):
            raise ValueError('Invalid source')
        elif key == 'kind' and (not isinstance(value, str) or value not in KINDS):
            raise ValueError('Invalid kind')
        elif key == 'id' and (not isinstance(value, str) or not re.fullmatch(r'nli1_[a-f0-9]{64}', value)):
            raise ValueError('Invalid entry id')
        if key != 'legacyId':
            clauses.append(column + ' = ?'); values.append(value)
    if 'legacyId' in filters:
        if not filters.get('generation') or not filters.get('table'):
            raise ValueError('legacyId requires generation and table')
        key = sortable_key(filters['legacyId'])
        clauses.append("kind = 'sql_data' AND (whole_table = 1 OR ((lower_key IS NULL OR lower_key < ?) AND (upper_key IS NULL OR upper_key >= ?)))")
        values.extend([key, key])
    with closing(sqlite3.connect(Path(path).resolve().as_uri() + '?mode=ro', uri=True)) as connection:
        metadata = json.loads(connection.execute("SELECT value FROM metadata WHERE key='snapshot'").fetchone()[0])
        if metadata['format'] != FORMAT:
            raise ValueError('Unsupported index format')
        filter_hash = digest(canonical(filters).encode())
        if query.get('cursor') is not None:
            try:
                cursor = query['cursor']
                if not isinstance(cursor, str) or len(cursor) > 2048:
                    raise ValueError('Invalid cursor')
                token = json.loads(base64.urlsafe_b64decode(cursor + '=' * (-len(cursor) % 4)))
                if token['revision'] != metadata['revision'] or token['filters'] != filter_hash:
                    raise ValueError('Cursor belongs to a different snapshot or query; restart pagination')
                if not re.fullmatch(r'nli1_[a-f0-9]{64}', token['after']):
                    raise ValueError('Invalid cursor entry id')
            except (KeyError, TypeError, UnicodeError, json.JSONDecodeError) as error:
                raise ValueError('Invalid cursor') from error
            clauses.append('id > ?'); values.append(token['after'])
        sql = 'SELECT payload FROM entries' + (' WHERE ' + ' AND '.join('(' + c + ')' for c in clauses) if clauses else '')
        rows = connection.execute(sql + ' ORDER BY id LIMIT ?', [*values, limit + 1]).fetchall()
    entries = [json.loads(row[0]) for row in rows[:limit]]
    next_cursor = None
    if len(rows) > limit:
        token = {'revision': metadata['revision'], 'filters': filter_hash, 'after': entries[-1]['id']}
        next_cursor = base64.urlsafe_b64encode(canonical(token).encode()).decode().rstrip('=')
    return {'format': QUERY_FORMAT, 'indexRevision': metadata['revision'], 'indexBuiltAt': metadata['builtAt'],
            'sourceSnapshots': metadata['inputs'],
            'count': len(entries), 'entries': entries, 'nextCursor': next_cursor}


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    build = sub.add_parser('build')
    build.add_argument('--index', required=True)
    build.add_argument('--legacy-manifest', action='append', default=[])
    build.add_argument('--catalog', action='append', default=[])
    build.add_argument('--site-snapshot')
    query = sub.add_parser('query')
    query.add_argument('--index', required=True)
    query.add_argument('--query', required=True, help='JSON query object')
    args = parser.parse_args()
    if args.command == 'build':
        result = build_index(args.index, args.legacy_manifest, args.catalog, args.site_snapshot)
    else:
        result = query_index(args.index, json.loads(args.query))
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
