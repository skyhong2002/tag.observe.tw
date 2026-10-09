#!/usr/bin/env python3
"""Authenticated, bounded nearline retrieval service; SSD metadata and jobs."""
import argparse
from contextlib import contextmanager, closing
import datetime as dt
import fcntl
import gzip
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import subprocess
import threading
import time
from urllib.parse import parse_qs, urlsplit
import uuid

from pipeline import Pipeline, sha256, write_json, validate_gzip
from query_index import canonical, decimal, query_index

GIB = 2 ** 30
MAX_RAW = 256 * 2 ** 20
MAX_PENDING = 20
TTL = 86400


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


class RequestError(Exception):
    def __init__(self, status, code):
        self.status, self.code = status, code


class Operations:
    def __init__(self, config):
        self.config = config
        self.root = Path(config['state_dir'])
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.jobs = self.root / 'jobs.sqlite'
        self.token = Path(config['token_file']).read_text().strip()
        if len(self.token) < 32:
            raise ValueError('A private operations token is required')
        with self.connection() as db:
            db.executescript('''PRAGMA journal_mode=WAL;
              CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY, request_hash TEXT UNIQUE NOT NULL,
                status TEXT NOT NULL, stage TEXT NOT NULL, payload TEXT NOT NULL,
                created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0, processed INTEGER NOT NULL DEFAULT 0,
                total INTEGER, result TEXT, error TEXT);
              CREATE INDEX IF NOT EXISTS pending_jobs ON jobs(status,created_at);
            ''')

    @contextmanager
    def connection(self):
        db = sqlite3.connect(self.jobs, timeout=10)
        db.row_factory = sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()

    def query(self, query):
        return query_index(self.config['index'], query)

    def entry(self, entry_id, revision):
        response = self.query({'id': entry_id, 'limit': 1})
        if response['indexRevision'] != revision:
            raise RequestError(409, 'index_changed_restart_query')
        if not response['entries']:
            raise RequestError(404, 'archive_entry_not_found')
        return response['entries'][0]

    def enqueue(self, request):
        if not isinstance(request, dict) or set(request) - {'entryId', 'indexRevision', 'selector'}:
            raise RequestError(400, 'invalid_retrieval_request')
        entry = self.entry(request.get('entryId'), request.get('indexRevision'))
        if entry['availability'] != 'archived':
            raise RequestError(409, 'source_unavailable')
        selector = request.get('selector', {})
        if not isinstance(selector, dict) or set(selector) - {'legacyId'}:
            raise RequestError(400, 'invalid_selector')
        if selector:
            value = decimal(selector['legacyId'])
            span = entry['selector']
            if entry['kind'] != 'sql_data' or not span:
                raise RequestError(400, 'selector_requires_sql_data')
            if ((span['lowerExclusive'] is not None and int(value) <= int(span['lowerExclusive']))
                    or (span['upperInclusive'] is not None and int(value) > int(span['upperInclusive']))):
                raise RequestError(400, 'selector_outside_package')
        if entry['kind'] == 'sql_data' and sum(a['rawBytes'] or MAX_RAW + 1 for a in entry['artifacts']) > MAX_RAW:
            raise RequestError(413, 'package_exceeds_isolated_restore_budget')
        request_hash = hashlib.sha256(canonical(request).encode()).hexdigest()
        with self.connection() as db:
            db.execute('BEGIN IMMEDIATE')
            previous = db.execute('SELECT id FROM jobs WHERE request_hash=?', (request_hash,)).fetchone()
            if previous:
                return self.job(previous['id'])
            if db.execute("SELECT COUNT(*) FROM jobs WHERE status IN ('queued','running')").fetchone()[0] >= MAX_PENDING:
                raise RequestError(429, 'retrieval_queue_full')
            if shutil.disk_usage(self.root).free < 25 * GIB:
                raise RequestError(503, 'retrieval_ssd_reserve')
            identity, stamp = uuid.uuid4().hex, now()
            db.execute('INSERT INTO jobs (id,request_hash,status,stage,payload,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
                       (identity, request_hash, 'queued', 'queued', canonical({'entry': entry, 'selector': selector}), stamp, stamp))
        return self.job(identity)

    def job(self, identity):
        if not re.fullmatch(r'[a-f0-9]{32}', identity):
            raise RequestError(404, 'retrieval_not_found')
        with self.connection() as db:
            row = db.execute('SELECT * FROM jobs WHERE id=?', (identity,)).fetchone()
        if row is None:
            raise RequestError(404, 'retrieval_not_found')
        return {k: row[k] for k in ['id', 'status', 'stage', 'created_at', 'updated_at', 'attempts', 'processed', 'total', 'error']} | {
            'entryId': json.loads(row['payload'])['entry']['id'],
            'result': json.loads(row['result']) if row['result'] else None}

    def update(self, identity, **fields):
        allowed = {'status', 'stage', 'processed', 'total', 'result', 'error'}
        if not fields or set(fields) - allowed:
            raise ValueError('Invalid job update')
        fields['updated_at'] = now()
        with self.connection() as db:
            db.execute('UPDATE jobs SET ' + ','.join(k + '=?' for k in fields) + ' WHERE id=?', [*fields.values(), identity])

    def retry(self, identity):
        with self.connection() as db:
            updated = db.execute("UPDATE jobs SET status='queued',stage='queued',error=NULL,updated_at=? WHERE id=? AND status='failed' AND attempts<3", (now(), identity)).rowcount
        if not updated:
            raise RequestError(409, 'retrieval_not_retryable')
        return self.job(identity)

    def recover(self):
        with self.connection() as db:
            db.execute("UPDATE jobs SET status=CASE WHEN attempts<3 THEN 'queued' ELSE 'failed' END,stage='interrupted',error='worker_interrupted',updated_at=? WHERE status='running'", (now(),))

    def expire(self):
        # Only generated results, never NAS objects or source/backup directories.
        with self.connection() as db:
            ids = [r[0] for r in db.execute("SELECT id FROM jobs WHERE status IN ('ready','failed') AND updated_at<?", ((dt.datetime.now(dt.timezone.utc) - dt.timedelta(seconds=TTL)).isoformat(),))]
            for identity in ids:
                path = self.root / identity
                if path.is_dir() and not path.is_symlink():
                    shutil.rmtree(path)
                db.execute("UPDATE jobs SET status='expired',stage='expired',result=NULL,updated_at=? WHERE id=?", (now(), identity))

    def claim(self):
        with self.connection() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute("SELECT * FROM jobs WHERE status='queued' ORDER BY created_at LIMIT 1").fetchone()
            if row:
                db.execute("UPDATE jobs SET status='running',stage='fetching',attempts=attempts+1,updated_at=? WHERE id=?", (now(), row['id']))
            return dict(row) if row else None

    def checked_artifact(self, pipeline, artifact, target):
        if artifact['remote'].rstrip('/') != pipeline.cfg['remote'].rstrip('/'):
            raise ValueError('Archive remote differs from configured source')
        obj = {'object': artifact['key'], 'sha256': artifact['sha256'], 'bytes': artifact['bytes'], 'raw_bytes': artifact['rawBytes']}
        if obj['bytes'] is None or obj['raw_bytes'] is None or obj['raw_bytes'] > MAX_RAW:
            raise ValueError('Archive size budget unavailable or exceeded')
        if not re.fullmatch(r'objects/[a-f0-9]{2}/[a-f0-9]{64}\.sql\.gz', obj['object']):
            raise ValueError('Unsupported SQL object')
        pipeline.fetch_object(obj, target)
        if sha256(target) != obj['sha256'] or target.stat().st_size != obj['bytes'] or validate_gzip(target) != obj['raw_bytes']:
            raise ValueError('Archive verification failed')

    def records(self, root, values, identity, selector):
        partial = root / 'result.partial.sqlite'
        partial.unlink(missing_ok=True)
        processed, kept = 0, 0
        with closing(sqlite3.connect(partial)) as db:
            db.execute('CREATE TABLE records (seq INTEGER PRIMARY KEY, payload TEXT NOT NULL)')
            for value in values:
                processed += 1
                if not selector or str(value.get('raw', {}).get('newsid')) == selector['legacyId']:
                    kept += 1
                    db.execute('INSERT INTO records VALUES (?,?)', (kept, canonical(value)))
                if processed % 500 == 0:
                    if shutil.disk_usage(self.root).free < 25 * GIB:
                        raise RuntimeError('SSD reserve reached')
                    self.update(identity, processed=processed)
            db.commit()
            if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise ValueError('Result integrity check failed')
        partial.replace(root / 'result.sqlite')
        self.update(identity, processed=processed, total=processed)
        return kept

    def execute(self, row):
        identity = row['id']
        payload = json.loads(row['payload'])
        entry, selector = payload['entry'], payload['selector']
        root = self.root / identity
        if root.exists():
            shutil.rmtree(root)
        root.mkdir(mode=0o700)
        if shutil.disk_usage(self.root).free < 25 * GIB:
            raise RuntimeError('SSD reserve reached')
        # Completed result cache is bounded independently of free SSD capacity.
        used = sum(p.stat().st_size for p in self.root.rglob('*') if p.is_file())
        if used > self.config.get('cache_budget_bytes', 2 * GIB):
            raise RuntimeError('Result cache budget reached')
        files = {}
        if entry['kind'] == 'article_content':
            self.update(identity, stage='fetch_and_verify_content')
            request = root / 'entry.json'
            write_json(request, entry)
            target = root / 'article.json'
            self.command(['node', '--env-file=' + self.config['env_file'], str(Path(__file__).with_name('retrieve-content.ts')), '--entry', str(request), '--out', str(target)], root)
            kept = self.records(root, [json.loads(target.read_text())], identity, {})
            target.unlink()
            request.unlink()
            format_name = 'tag-content-v1'
        else:
            pipeline = Pipeline(json.loads(Path(self.config['backup_config']).read_text()))
            fetched = root / 'fetched'
            fetched.mkdir(mode=0o700)
            schema, chunks = None, []
            for artifact in entry['artifacts']:
                role = artifact['role']
                name = 'data-000000.sql.gz' if role == 'data' else role + '.sql.gz'
                target = fetched / name
                self.checked_artifact(pipeline, artifact, target)
                files[role] = {'bytes': target.stat().st_size, 'sha256': sha256(target)}
                obj = {'object': artifact['key'], 'sha256': artifact['sha256'], 'bytes': artifact['bytes'], 'raw_bytes': artifact['rawBytes']}
                if role == 'schema':
                    schema = obj
                elif role == 'data':
                    obj['captured_at'] = entry['verification']['observedAt']
                    chunks.append(obj)
            source = entry['source']
            if entry['kind'] == 'sql_data' and (entry['integration'] or {}).get('classification') == 'import_articles':
                self.update(identity, stage='isolated_restore_and_normalize')
                manifest = {'generation': source['generation'], 'source': 'tag-analysis/tag', 'table': source['table'], 'schema': schema, 'chunks': chunks, 'consistency': 'Source rolling scan; not an atomic cross-table snapshot'}
                write_json(fetched / 'manifest.json', manifest)
                prepared = root / 'prepared'
                media = 'mixed' if source['table'] in {'tag_news', 'tag_news_2024'} else source['table'].removeprefix('tag_')
                self.command(['python3', str(Path(__file__).with_name('prepare.py')), '--package', str(fetched), '--media', media, '--out', str(prepared)], root)
                self.update(identity, stage='building_result')
                report = json.loads((prepared / 'report.json').read_text())
                if report.get('restore_row_count_verified') is not True or report['restored_rows'] != report['rows'] or sha256(prepared / 'articles.jsonl.gz') != report['compressedSha256']:
                    raise ValueError('Prepared verification receipt invalid')
                self.update(identity, total=report['rows'])
                with gzip.open(prepared / 'articles.jsonl.gz', 'rt') as stream:
                    kept = self.records(root, (json.loads(line) for line in stream), identity, selector)
                if self.job(identity)['processed'] != report['rows']:
                    raise ValueError('Result row count differs from restored source')
                shutil.rmtree(prepared)
                format_name = report['adapter']
            else:
                kept, format_name = 0, 'verified-sql-package'
        result = {'format': format_name, 'records': kept, 'files': files, 'expiresAt': (dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=TTL)).isoformat(), 'requiresManualReview': format_name == 'verified-sql-package'}
        self.update(identity, status='ready', stage='ready', result=canonical(result), error=None)

    def command(self, args, root):
        with (root / 'operator.log').open('ab') as log:
            subprocess.run(args, check=True, stdout=log, stderr=log, cwd=Path(__file__).resolve().parents[2], timeout=1800)

    def run_one(self):
        row = self.claim()
        if not row:
            return False
        try:
            self.execute(row)
        except Exception:
            self.update(row['id'], status='failed', stage='failed', error='retrieval_failed_check_private_operator_log')
        return True

    def results(self, identity, after=0, limit=50):
        job = self.job(identity)
        if job['status'] == 'expired':
            raise RequestError(410, 'retrieval_result_expired')
        if job['status'] != 'ready':
            raise RequestError(409, 'retrieval_result_not_ready')
        if type(after) is not int or after < 0 or type(limit) is not int or not 1 <= limit <= 100:
            raise RequestError(400, 'invalid_result_page')
        path = self.root / identity / 'result.sqlite'
        if not path.exists():
            return {'jobId': identity, 'result': job['result'], 'count': 0, 'entries': [], 'nextCursor': None}
        with closing(sqlite3.connect(path.as_uri() + '?mode=ro', uri=True)) as db:
            rows = db.execute('SELECT seq,payload FROM records WHERE seq>? ORDER BY seq LIMIT ?', (after, limit + 1)).fetchall()
        entries = [json.loads(value) for _, value in rows[:limit]]
        return {'jobId': identity, 'result': job['result'], 'count': len(entries), 'entries': entries, 'nextCursor': str(rows[limit - 1][0]) if len(rows) > limit else None}

    def file(self, identity, role):
        job = self.job(identity)
        if job['status'] == 'expired':
            raise RequestError(410, 'retrieval_result_expired')
        if job['status'] != 'ready' or role not in (job['result'] or {}).get('files', {}):
            raise RequestError(404, 'retrieval_file_not_found')
        path = self.root / identity / 'fetched' / ('data-000000.sql.gz' if role == 'data' else role + '.sql.gz')
        proof = job['result']['files'][role]
        if path.is_symlink() or path.stat().st_size != proof['bytes'] or sha256(path) != proof['sha256']:
            raise RequestError(409, 'retrieval_file_changed')
        return path


def handler(operations):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def respond(self, status, value):
            data = canonical(value).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def dispatch(self):
            import hmac
            try:
                authorization = self.headers.get('Authorization', '')
                if not hmac.compare_digest(authorization.encode(), ('Bearer ' + operations.token).encode()):
                    raise RequestError(401, 'nearline_authorization_required')
                parsed = urlsplit(self.path)
                query = parse_qs(parsed.query)
                if any(len(v) != 1 for v in query.values()):
                    raise RequestError(400, 'duplicate_query_parameter')
                path = parsed.path
                body = None
                if self.command == 'POST':
                    length = int(self.headers.get('Content-Length', '0'))
                    if not 0 < length <= 8192:
                        raise RequestError(413, 'request_size_limit')
                    body = json.loads(self.rfile.read(length))
                if self.command == 'GET' and path == '/query':
                    self.respond(200, operations.query(json.loads(query.get('query', ['{}'])[0])))
                elif self.command == 'POST' and path == '/retrievals':
                    self.respond(202, operations.enqueue(body))
                elif self.command == 'GET' and path == '/status':
                    response = operations.query({'limit': 1})
                    checked = Path(operations.config['index']).parent / 'refresh-status.json'
                    self.respond(200, {'indexRevision': response['indexRevision'], 'indexBuiltAt': response['indexBuiltAt'], 'refresh': json.loads(checked.read_text()) if checked.exists() else None})
                elif (match := re.fullmatch(r'/retrievals/([a-f0-9]{32})(?:/(results|retry|files/(schema|data|programs)))?', path)):
                    identity, action, role = match.groups()
                    if self.command == 'POST' and action == 'retry':
                        self.respond(202, operations.retry(identity))
                    elif self.command == 'GET' and action == 'results':
                        self.respond(200, operations.results(identity, int(query.get('cursor', ['0'])[0]), int(query.get('limit', ['50'])[0])))
                    elif self.command == 'GET' and role:
                        file = operations.file(identity, role)
                        self.send_response(200)
                        self.send_header('Content-Type', 'application/gzip')
                        self.send_header('Cache-Control', 'no-store')
                        self.send_header('Content-Length', str(file.stat().st_size))
                        self.end_headers()
                        with file.open('rb') as stream:
                            shutil.copyfileobj(stream, self.wfile)
                    elif self.command == 'GET' and action is None:
                        self.respond(200, operations.job(identity))
                    else:
                        raise RequestError(404, 'not_found')
                else:
                    raise RequestError(404, 'not_found')
            except RequestError as error:
                self.respond(error.status, {'error': error.code})
            except (ValueError, KeyError, TypeError, json.JSONDecodeError):
                self.respond(400, {'error': 'invalid_nearline_request'})
            except (BrokenPipeError, ConnectionResetError):
                pass
            except Exception:
                self.respond(503, {'error': 'nearline_service_unavailable'})

        do_GET = dispatch
        do_POST = dispatch
    return Handler


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True)
    args = parser.parse_args()
    config = json.loads(Path(args.config).read_text())
    operations = Operations(config)
    lock = (operations.root / 'worker.lock').open('a')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    operations.recover()
    def worker():
        while True:
            try:
                operations.expire()
                if not operations.run_one():
                    time.sleep(2)
            except Exception:
                time.sleep(5)
    threading.Thread(target=worker, daemon=True).start()
    ThreadingHTTPServer(('127.0.0.1', config.get('port', 18135)), handler(operations)).serve_forever()


if __name__ == '__main__':
    main()
