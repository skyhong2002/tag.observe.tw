#!/usr/bin/env python3
"""Resumable, versioned nearline archives. Python stdlib + ssh + rclone only."""
import argparse
import base64
import contextlib
import datetime as dt
import fcntl
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time
import uuid

HERE = Path(__file__).resolve().parent
INTEGER_TYPES = {'tinyint', 'smallint', 'mediumint', 'int', 'bigint'}


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def write_json(path, obj):
    partial = path.with_suffix('.tmp')
    partial.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n')
    with partial.open('rb') as f:
        os.fsync(f.fileno())
    partial.replace(path)
    fd = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def sha256(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for data in iter(lambda: f.read(1024 * 1024), b''):
            h.update(data)
    return h.hexdigest()


def validate_gzip(path):
    size = 0
    with gzip.open(path, 'rb') as f:
        for data in iter(lambda: f.read(1024 * 1024), b''):
            size += len(data)
    return size


def schema_signature(path):
    # MySQL changes the next AUTO_INCREMENT value while writers are active;
    # this is metadata, not a DDL change. Keep the original dump in the archive.
    with gzip.open(path, 'rb') as f:
        sql = f.read()
    return hashlib.sha256(re.sub(rb'\bAUTO_INCREMENT=\d+\b', b'AUTO_INCREMENT=0', sql)).hexdigest()


def apply_chunk_row_caps(tables, cfg):
    """Apply explicit per-table caps once; retain adaptive reductions on retries."""
    changed = False
    for name, cap in cfg.get('table_chunk_row_caps', {}).items():
        if isinstance(cap, bool) or not isinstance(cap, int) or not 1 <= cap <= 500000:
            raise ValueError('Table chunk row cap must be an integer from 1 to 500000')
        if name not in tables:
            raise ValueError('Unknown table chunk row cap: ' + name)
        table = tables[name]
        if table['status'] not in ('pending', 'running') or not table.get('pk'):
            continue
        policy = {'max_rows': cap, 'target_raw_bytes': cfg['target_raw_bytes']}
        if table.get('chunk_row_policy') == policy:
            continue
        average = max(1, table['data_bytes'] / max(1, table['estimated_rows']))
        table['chunk_rows'] = max(1, min(cap, int(cfg['target_raw_bytes'] / average)))
        table['chunk_row_policy'] = policy
        changed = True
    return changed


def plan_tables(inventory, cfg):
    keys = {}
    for table, col, kind in inventory['keys']:
        keys.setdefault(table, []).append((col, kind))
    tables = {}
    for name, engine, rows, data, indexes in inventory['tables']:
        rows, data, indexes = [0 if x == 'NULL' else int(x) for x in (rows, data, indexes)]
        key = keys.get(name, [])
        pk = key[0][0] if len(key) == 1 and key[0][1] in INTEGER_TYPES else None
        chunk_rows = max(1, min(cfg['max_chunk_rows'], int(cfg['target_raw_bytes'] / max(1, data / max(1, rows)))))
        table = {'engine': engine, 'estimated_rows': rows, 'data_bytes': data, 'index_bytes': indexes,
                 'pk': pk, 'chunk_rows': chunk_rows, 'after': None, 'chunks': [], 'status': 'pending'}
        if name in cfg['exclude']:
            table.update(status='excluded', error=cfg['exclude'][name])
        elif not pk and data > cfg['max_unkeyed_bytes']:
            table.update(status='blocked', error='No single integer primary key; exceeds whole-table budget')
        tables[name] = table
    # Some broken MySQL tables disappear from information_schema entirely.
    # Configured known gaps must remain visible even when inventory omits them.
    for name, reason in cfg['exclude'].items():
        tables.setdefault(name, {'status': 'excluded', 'error': reason, 'chunks': [], 'data_bytes': 0,
                                 'inventory_missing': True})
    apply_chunk_row_caps(tables, cfg)
    return tables


class Pipeline:
    def __init__(self, cfg):
        self.cfg = cfg
        self.root = Path(cfg['state_dir']).expanduser()
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.state_path = self.root / 'state.json'
        self.rc = ['rclone', '--config', cfg['rclone_config'], '--bwlimit', cfg['bandwidth'],
                   '--retries', '4', '--retries-sleep', '2s', '--low-level-retries', '2', '--contimeout', '15s', '--timeout', '60s']
        self.state = json.loads(self.state_path.read_text()) if self.state_path.exists() else None
        if self.state:
            self.check_identity(self.state)

    def check_identity(self, state):
        if state['source'] != self.cfg['ssh_host'] + '/' + self.cfg['database'] or state['remote'] != self.cfg['remote']:
            raise RuntimeError('State belongs to another source or archive destination')

    def rclone(self, *args, **kwargs):
        return subprocess.run(self.rc + list(args), check=True, timeout=kwargs.pop('timeout', 900), **kwargs)

    def remote_path(self, relative):
        return self.cfg['remote'].rstrip('/') + '/' + relative

    def source(self, action, output=None, **params):
        request = dict(action=action, database=self.cfg['database'], max_raw_bytes=self.cfg['max_raw_bytes'], **params)
        code = base64.b64encode((HERE / 'source.py').read_bytes()).decode()
        args = base64.b64encode(json.dumps(request).encode()).decode()
        timeout = int(self.cfg['source_timeout_seconds'])
        script = ("exec nice -n 10 timeout %d python - <<'NEARLINE_REMOTE'\nimport json,base64\n"
                  "REQUEST=json.loads(base64.b64decode('%s'))\n"
                  "exec(compile(base64.b64decode('%s'), '<nearline>', 'exec'))\nNEARLINE_REMOTE\n") % (timeout, args, code)
        with tempfile.TemporaryFile(dir=self.root) as frames, tempfile.TemporaryFile(dir=self.root) as errors:
            p = subprocess.run(['ssh', '-T', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15',
                                '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3',
                                self.cfg['ssh_host'], 'sudo -n /bin/su -'],
                               input=script.encode(), stdout=frames, stderr=errors, timeout=timeout + 30)
            frames.seek(0)
            end = None
            result = None
            failure = None
            with output.open('wb') if output else contextlib.nullcontext() as f:
                for line in frames:
                    if not line.startswith(b'NEARLINE1:'):
                        continue  # Login banners are outside the framed protocol.
                    item = json.loads(line[len(b'NEARLINE1:'):])
                    if item['type'] == 'data':
                        if f is None or end is not None:
                            raise RuntimeError('Unexpected data frame')
                        f.write(base64.b64decode(item['base64'], validate=True))
                    elif item['type'] == 'end':
                        end = item
                    elif item['type'] == 'result':
                        result = item
                    elif item['type'] == 'error':
                        failure = item['message']
            if failure or p.returncode:
                errors.seek(0)
                raise RuntimeError(failure or ('SSH/export failed: ' + errors.read().decode(errors='replace')[-1500:]))
            if output:
                if not end or sha256(output) != end['sha256'] or validate_gzip(output) != end['raw_bytes']:
                    raise RuntimeError('Incomplete or corrupt source stream')
                return end
            if result is None:
                raise RuntimeError('No framed result from source')
            return result

    def capacity(self):
        if shutil.disk_usage(self.root).free < self.cfg['local_free_min_bytes']:
            raise RuntimeError('Local free space below reserve; no progress discarded')
        share = self.cfg['remote'].split(':', 1)
        share_root = share[0] + ':' + share[1].split('/')[0]
        free = json.loads(self.rclone('about', share_root, '--json', capture_output=True).stdout)['free']
        if free < self.cfg['nas_free_min_bytes']:
            raise RuntimeError('NAS free space below reserve; archives are never auto-deleted')

    def verify_remote(self, relative, expected):
        with tempfile.TemporaryFile(dir=self.root) as f:
            self.rclone('cat', self.remote_path(relative), stdout=f)
            f.seek(0)
            digest = hashlib.file_digest(f, 'sha256').hexdigest()
        if digest != expected:
            raise RuntimeError('NAS readback checksum mismatch: ' + relative)

    def publish_file(self, local, relative):
        # A failed transfer leaves a visibly incomplete file, never a committed manifest.
        partial = relative + '.partial'
        self.rclone('copyto', str(local), self.remote_path(partial), '--ignore-times')
        self.verify_remote(partial, sha256(local))
        self.rclone('moveto', self.remote_path(partial), self.remote_path(relative), '--ignore-times')

    def put_object(self, local, raw_bytes):
        digest = sha256(local)
        relative = 'objects/' + digest[:2] + '/' + digest + '.sql.gz'
        # Listing succeeds even for an absent filename; network errors must not mean "absent".
        self.rclone('mkdir', self.remote_path('objects/' + digest[:2]))
        listing = json.loads(self.rclone('lsjson', self.remote_path('objects/' + digest[:2]),
                                        '--files-only', '--include', digest + '.sql.gz', capture_output=True).stdout)
        if listing:
            self.verify_remote(relative, digest)
        else:
            self.publish_file(local, relative)
        return {'sha256': digest, 'bytes': local.stat().st_size, 'raw_bytes': raw_bytes, 'object': relative}

    def checkpoint(self):
        self.state['updated_at'] = now()
        write_json(self.state_path, self.state)
        self.publish_file(self.state_path, 'generations/' + self.state['generation'] + '/manifest.json')

    def export(self, action, **params):
        tmp = self.root / 'chunk.sql.gz.partial'
        try:
            meta = self.source(action, output=tmp, **params)
            obj = self.put_object(tmp, meta['raw_bytes'])
            if action == 'schema':
                obj['structure_sha256'] = schema_signature(tmp)
            return obj
        finally:
            tmp.unlink(missing_ok=True)

    def begin(self):
        inventory = self.source('inventory')
        generation = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:8]
        self.state = {'version': 1, 'generation': generation, 'source': self.cfg['ssh_host'] + '/' + self.cfg['database'],
                      'remote': self.cfg['remote'], 'started_at': now(), 'status': 'running', 'server': inventory['server'],
                      'consistency': 'Online unlocked rolling scan. Not an atomic backup or point-in-time recovery. Deletes between scans may be missed.',
                      'tables': plan_tables(inventory, self.cfg), 'programs': None, 'errors': []}
        self.checkpoint()

    def step(self, name, table):
        if 'schema' not in table:
            schema = self.export('schema', table=name)
            if table['pk']:
                table['maximum'] = self.source('bounds', table=name, pk=table['pk'])['maximum']
            table['schema'] = schema
            table['capture_started_at'] = now()
            self.checkpoint()
            return
        if table['pk'] and table['maximum'] is None:
            table['status'] = 'scanned'
        else:
            upper = None
            if table['pk']:
                upper = self.source('boundary', table=name, pk=table['pk'], after=table['after'],
                                    maximum=table['maximum'], chunk_rows=table['chunk_rows'])['upper']
                if table['after'] is not None and upper <= table['after']:
                    raise RuntimeError('Non-advancing chunk boundary')
            started = now()
            try:
                obj = self.export('data', table=name, pk=table['pk'], after=table['after'], upper=upper)
            except RuntimeError as error:
                if 'RAW_LIMIT:' in str(error) and table['pk'] and table['chunk_rows'] > 1:
                    table['chunk_rows'] = max(1, table['chunk_rows'] // 2)
                    self.checkpoint()
                    return
                raise
            obj.update(lower_exclusive=table['after'], upper_inclusive=upper, capture_started_at=started, captured_at=now())
            table['chunks'].append(obj)
            table['after'] = upper
            table['status'] = 'scanned' if not table['pk'] or upper == table['maximum'] else 'running'
            # Commit verified data before the independent schema check, so a retry cannot skip/repeat a range.
        self.checkpoint()

    def finish_table(self, name, table):
        schema = self.export('schema', table=name)
        if schema['structure_sha256'] != table['schema']['structure_sha256']:
            table['schema_after'] = schema
            table['status'] = 'blocked'
            table['error'] = 'Schema changed during capture; table requires a new generation'
        else:
            table['status'] = 'complete'
            table['capture_finished_at'] = now()
        self.checkpoint()

    def run(self, max_steps=None, only_tables=None):
        self.capacity()
        if self.state and self.state['status'] in ('complete', 'complete_with_gaps'):
            finished = dt.datetime.fromisoformat(self.state['finished_at'])
            if (dt.datetime.now(dt.timezone.utc) - finished).total_seconds() < self.cfg['generation_interval_days'] * 86400:
                print('Waiting for next scheduled generation.', flush=True)
                return
            self.state = None
        if not self.state:
            self.begin()
        else:
            for name, reason in self.cfg['exclude'].items():
                self.state['tables'].setdefault(name, {'status': 'excluded', 'error': reason, 'chunks': [],
                                                       'data_bytes': 0, 'inventory_missing': True})
            apply_chunk_row_caps(self.state['tables'], self.cfg)
            self.checkpoint()  # Repair an interrupted publication before advancing.
        if not self.state['programs']:
            try:
                self.state['programs'] = self.export('programs', exclude=list(self.cfg['exclude']))
                self.state.pop('programs_error', None)
            except Exception as error:
                self.state['programs_error'] = str(error)
                print('Programmable objects: ' + str(error), file=sys.stderr, flush=True)
            self.checkpoint()
        start = time.monotonic()
        steps = 0
        priority = {name: i for i, name in enumerate(self.cfg['priority_tables'])}
        order = sorted(self.state['tables'], key=lambda n: (priority.get(n, 9999), self.state['tables'][n]['data_bytes'], n))
        if only_tables:
            unknown = set(only_tables) - set(order)
            if unknown:
                raise ValueError('Unknown tables: ' + ', '.join(sorted(unknown)))
            order = [name for name in order if name in only_tables]
        limit = max_steps or self.cfg['max_chunks_per_run']
        failed = []
        for name in order:
            table = self.state['tables'][name]
            if table['status'] in ('complete', 'excluded', 'blocked'):
                continue
            while steps < limit and time.monotonic() - start < self.cfg['max_run_seconds']:
                self.capacity()
                try:
                    if table['status'] == 'scanned':
                        self.finish_table(name, table)
                    else:
                        self.step(name, table)
                    table.pop('last_error', None)
                    print(json.dumps({'at': now(), 'table': name, 'status': table['status'],
                                      'chunks': len(table['chunks']), 'after': table['after']}), flush=True)
                except Exception as error:
                    table['last_error'] = str(error)[-2000:]
                    table['last_error_at'] = now()
                    self.checkpoint()
                    failed.append(name)
                    print(name + ': ' + str(error), file=sys.stderr, flush=True)
                    break  # Other tables can still make progress; this table retries next run.
                steps += 1
                if table['status'] in ('complete', 'blocked'):
                    break
                time.sleep(self.cfg['pause_seconds'])
            if steps >= limit or time.monotonic() - start >= self.cfg['max_run_seconds']:
                break
        pending = [t for t in self.state['tables'].values() if t['status'] not in ('complete', 'excluded', 'blocked')]
        if not pending:
            if not self.state['programs']:
                try:
                    self.state['programs'] = self.export('programs', exclude=list(self.cfg['exclude']))
                    self.state.pop('programs_error', None)
                except Exception as error:
                    self.state['programs_error'] = str(error)
                    self.checkpoint()
                    raise
            gaps = any(t['status'] != 'complete' for t in self.state['tables'].values())
            self.state['status'] = 'complete_with_gaps' if gaps else 'complete'
            self.state['finished_at'] = now()
        self.checkpoint()
        print(json.dumps(self.status(), ensure_ascii=False), flush=True)
        if failed:
            raise RuntimeError('Incomplete tables will retry next run: ' + ', '.join(failed))

    def status(self):
        if not self.state:
            return {'status': 'not_started'}
        counts = {}
        for t in self.state['tables'].values():
            counts[t['status']] = counts.get(t['status'], 0) + 1
        objects = [obj for t in self.state['tables'].values() for obj in t['chunks']]
        return {'generation': self.state['generation'], 'status': self.state['status'], 'tables': counts,
                'data_chunks': len(objects), 'compressed_bytes': sum(o['bytes'] for o in objects),
                'raw_sql_bytes': sum(o['raw_bytes'] for o in objects), 'updated_at': self.state.get('updated_at'),
                'errors': {n: t.get('last_error') or t.get('error') for n, t in self.state['tables'].items()
                           if t.get('last_error') or t.get('error')}, 'programs_error': self.state.get('programs_error')}

    def load_manifest(self, generation):
        if not re.fullmatch(r'\d{8}T\d{6}Z-[0-9a-f]{8}', generation):
            raise ValueError('Invalid generation ID')
        data = self.rclone('cat', self.remote_path('generations/' + generation + '/manifest.json'), capture_output=True).stdout
        manifest = json.loads(data)
        self.check_identity(manifest)
        if manifest['generation'] != generation or manifest['version'] != 1:
            raise RuntimeError('Unexpected manifest identity or version')
        return manifest

    def fetch_object(self, obj, dest):
        digest = obj['sha256']
        if not re.fullmatch('[0-9a-f]{64}', digest) or obj['object'] != 'objects/' + digest[:2] + '/' + digest + '.sql.gz':
            raise ValueError('Unsafe object reference')
        partial = dest.with_suffix(dest.suffix + '.partial')
        self.rclone('copyto', self.remote_path(obj['object']), str(partial))
        if partial.stat().st_size != obj['bytes'] or sha256(partial) != digest or validate_gzip(partial) != obj['raw_bytes']:
            raise RuntimeError('Retrieved object failed integrity check')
        partial.replace(dest)

    def fetch(self, generation, table_name, dest, chunk=None):
        manifest = self.load_manifest(generation)
        table = manifest['tables'][table_name]
        if 'schema' not in table:
            raise RuntimeError('No captured schema for this table')
        if chunk is None and table['status'] != 'complete':
            raise RuntimeError('Table incomplete; select an explicit --chunk for partial analysis')
        selected = list(enumerate(table['chunks'])) if chunk is None else [(chunk, table['chunks'][chunk])]
        needed = table['schema']['bytes'] + sum(o['bytes'] for _, o in selected)
        dest = Path(dest)
        dest.mkdir(parents=True, exist_ok=True, mode=0o700)
        if any(dest.iterdir()):
            raise RuntimeError('Fetch destination must be empty; existing files are never overwritten')
        if shutil.disk_usage(dest).free < needed + self.cfg['local_free_min_bytes']:
            raise RuntimeError('Insufficient local space for fetch plus reserve')
        self.fetch_object(table['schema'], dest / 'schema.sql.gz')
        for number, obj in selected:
            self.fetch_object(obj, dest / ('data-%06d.sql.gz' % number))
        write_json(dest / 'manifest.json', {'generation': generation, 'source': manifest['source'], 'table': table_name,
                                          'consistency': manifest['consistency'], 'schema': table['schema'],
                                          'chunks': [obj for _, obj in selected]})
        print('Fetched and verified into ' + str(dest))


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True)
    sub = parser.add_subparsers(dest='command', required=True)
    run = sub.add_parser('run')
    run.add_argument('--max-steps', type=int)
    run.add_argument('--table', action='append', help='Only advance named tables in this run; repeatable')
    sub.add_parser('inventory')
    sub.add_parser('status')
    sub.add_parser('list')
    recover = sub.add_parser('recover')
    recover.add_argument('--generation', required=True)
    fetch = sub.add_parser('fetch')
    fetch.add_argument('--generation', required=True)
    fetch.add_argument('--table', required=True)
    fetch.add_argument('--dest', required=True)
    fetch.add_argument('--chunk', type=int)
    args = parser.parse_args()
    cfg = json.loads(Path(args.config).read_text())
    pipeline = Pipeline(cfg)
    if args.command == 'status':
        print(json.dumps(pipeline.status(), ensure_ascii=False, indent=2))
        return
    if args.command == 'list':
        pipeline.rclone('lsf', pipeline.remote_path('generations'), '--dirs-only')
        return
    if args.command == 'fetch':
        if args.chunk is not None and args.chunk < 0:
            parser.error('--chunk must be nonnegative')
        pipeline.fetch(args.generation, args.table, args.dest, args.chunk)
        return
    with (pipeline.root / 'lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        # A previous writer may have committed between construction and lock acquisition.
        pipeline.state = json.loads(pipeline.state_path.read_text()) if pipeline.state_path.exists() else None
        if pipeline.state:
            pipeline.check_identity(pipeline.state)
        if args.command == 'run':
            if args.max_steps is not None and args.max_steps <= 0:
                parser.error('--max-steps must be positive')
            pipeline.run(args.max_steps, args.table)
        elif args.command == 'inventory':
            print(json.dumps(pipeline.source('inventory'), ensure_ascii=False, indent=2))
        elif args.command == 'recover':
            if pipeline.state:
                raise RuntimeError('Recovery requires an empty state directory')
            write_json(pipeline.state_path, pipeline.load_manifest(args.generation))
            print('Recovered verified-progress manifest; next run will resume.')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('nearline: ' + str(error), file=sys.stderr)
        sys.exit(1)
