#!/usr/bin/env python3
"""Verify a fetched article package, restore in isolation, and build staging JSONL."""
import argparse
import gzip
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import time
import uuid

from pipeline import sha256, validate_gzip


def run(*args, **kwargs):
    return subprocess.run(list(args), check=True, timeout=kwargs.pop('timeout', 180), **kwargs)


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--package', required=True)
    parser.add_argument('--media', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    package = Path(args.package).resolve()
    out = Path(args.out).resolve()
    manifest = json.loads((package / 'manifest.json').read_text())
    table = manifest['table']
    if not re.fullmatch(r'tag_[a-z0-9_]+', table) or table != 'tag_' + args.media:
        raise ValueError('Only explicitly mapped per-media article packages supported')
    files = [(package / 'schema.sql.gz', manifest['schema'])]
    data = sorted(package.glob('data-*.sql.gz'))
    if len(data) != len(manifest['chunks']):
        raise ValueError('Package file count differs from manifest')
    files += list(zip(data, manifest['chunks']))
    if sum(meta['raw_bytes'] for _, meta in files) > 256 * 2**20:
        raise ValueError('Staging budget exceeded; fetch one smaller chunk')
    for path, meta in files:
        if path.stat().st_size != meta['bytes'] or sha256(path) != meta['sha256'] or validate_gzip(path) != meta['raw_bytes']:
            raise ValueError('Package integrity check failed: ' + str(path))
    if out.exists() and any(out.iterdir()):
        raise ValueError('Output directory must be empty')
    out.mkdir(parents=True, exist_ok=True, mode=0o700)
    if shutil.disk_usage(out).free < 10 * 2**30:
        raise ValueError('Keep at least 10 GiB free on SSD')
    name = 'tag-nearline-stage-' + uuid.uuid4().hex[:12]
    try:
        run('docker', 'run', '--rm', '-d', '--name', name, '--network', 'none', '--cpus', '1',
            '--memory', '2g', '--tmpfs', '/var/lib/mysql:rw,size=1g',
            '-e', 'MARIADB_ALLOW_EMPTY_ROOT_PASSWORD=1', '-e', 'MARIADB_DATABASE=staging',
            'mariadb:11.4', '--skip-log-bin', '--event-scheduler=OFF', '--max-allowed-packet=256M', stdout=subprocess.DEVNULL)
        for _ in range(60):
            ready = subprocess.run(['docker', 'exec', name, 'mariadb-admin', '-uroot', 'ping'], capture_output=True, timeout=10)
            if ready.returncode == 0:
                break
            time.sleep(1)
        else:
            raise RuntimeError('Isolated MariaDB did not become ready')
        for path, _ in files:
            with gzip.open(path, 'rb') as sql, tempfile.TemporaryFile() as errors:
                p = subprocess.Popen(['docker', 'exec', '-i', name, 'mariadb', '-uroot', 'staging'],
                                     stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=errors)
                try:
                    for block in iter(lambda: sql.read(65536), b''):
                        p.stdin.write(block)
                    p.stdin.close()
                    if p.wait(timeout=180):
                        errors.seek(0)
                        raise RuntimeError(errors.read().decode(errors='replace'))
                finally:
                    if p.poll() is None:
                        p.kill()
                        p.wait()
        mysql = ['docker', 'exec', name, 'mariadb', '-uroot', '--batch', '--raw', '--skip-column-names',
                 '--quick', '--default-character-set=utf8mb4', 'staging', '-e']
        columns = run(*mysql, 'SHOW COLUMNS FROM `' + table + '`', capture_output=True, text=True).stdout
        names = [line.split('\t')[0] for line in columns.splitlines()]
        if any(not re.fullmatch(r'[a-zA-Z0-9_]+', column) for column in names):
            raise ValueError('Unsupported column identifier')
        fields = []
        for col in names:
            fields.extend(["'" + col + "'", 'CAST(`' + col + '` AS CHAR)' if col == 'newsid' else '`' + col + '`'])
        with tempfile.TemporaryDirectory(prefix='normalize-', dir=out.parent) as tmp:
            raw = Path(tmp) / 'raw.jsonl'
            with raw.open('wb') as f:
                run(*mysql, 'SELECT JSON_OBJECT(' + ','.join(fields) + ') FROM `' + table + '` ORDER BY newsid', stdout=f)
            run('node', str(Path(__file__).with_name('normalize.ts')), '--input', str(raw), '--manifest', str(package / 'manifest.json'),
                '--media', args.media, '--out', str(out))
        count = run(*mysql, 'SELECT COUNT(*) FROM `' + table + '`', capture_output=True, text=True).stdout.strip()
        report = json.loads((out / 'report.json').read_text())
        if report['rows'] != int(count):
            raise RuntimeError('Restored/normalized row count mismatch')
        report['restored_rows'] = int(count)
        report['restore_row_count_verified'] = True
        (out / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        shutil.copyfile(package / 'manifest.json', out / 'source-manifest.json')
    finally:
        subprocess.run(['docker', 'rm', '-f', name], capture_output=True, timeout=30)


if __name__ == '__main__':
    main()
