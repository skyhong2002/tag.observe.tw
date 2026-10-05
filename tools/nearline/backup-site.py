#!/usr/bin/env python3
"""Verified new-site logical backup, isolated restore, and NAS publication."""
import argparse
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import time
import uuid

DOCKER = '/home/deck/.local/bin/docker'
RCLONE = '/home/deck/.local/bin/rclone'
GIB = 1024 ** 3


def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def atomic_json(path, data):
    temporary = path.with_suffix(path.suffix + '.partial')
    temporary.write_text(json.dumps(data, indent=2) + '\n')
    temporary.replace(path)


def source_sql(query):
    env = dict(os.environ, MYSQL_PWD=os.environ['TAG_DB_PASSWORD'])
    return run([DOCKER, 'exec', '-e', 'MYSQL_PWD', 'tag-db', 'mariadb', '-utag_observe', '-N', '-B', 'tag_observe', '-e', query],
               env=env, capture_output=True, text=True, timeout=60).stdout


def schema_signature():
    # Detect concurrent DDL without confusing normal row/index-statistic changes with DDL.
    tables = source_sql("SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME").splitlines()
    definitions = [source_sql('SHOW CREATE TABLE `' + name.replace('`', '``') + '`') for name in tables]
    import re
    normalized = re.sub(r' AUTO_INCREMENT=\d+', '', '\n'.join(definitions))
    return tables, hashlib.sha256(normalized.encode()).hexdigest()


def export_database(path):
    partial = path.with_suffix(path.suffix + '.partial')
    env = dict(os.environ, MYSQL_PWD=os.environ['TAG_DB_PASSWORD'])
    with partial.open('xb') as output:
        dump = subprocess.Popen([DOCKER, 'exec', '-e', 'MYSQL_PWD', 'tag-db', 'mariadb-dump', '-utag_observe',
                                 '--single-transaction', '--quick', '--routines', '--events', '--hex-blob', 'tag_observe'],
                                env=env, stdout=subprocess.PIPE)
        try:
            compressed = subprocess.Popen(['zstd', '-T2', '-q'], stdin=dump.stdout, stdout=output)
            dump.stdout.close()
            compression_code = compressed.wait()
            dump_code = dump.wait()
            if compression_code or dump_code:
                raise RuntimeError('Logical export or compression failed')
        finally:
            if dump.poll() is None:
                dump.terminate()
                dump.wait(timeout=30)
    run(['zstd', '-t', '-q', str(partial)], timeout=3600)
    if partial.stat().st_size < 100000:
        raise RuntimeError('Database export unexpectedly small')
    partial.replace(path)


def restore_drill(path, expected_tables):
    name = 'tag-site-backup-check-' + uuid.uuid4().hex[:10]
    started = time.monotonic()
    try:
        run([DOCKER, 'run', '-d', '--name', name, '--network', 'none', '--memory=2g', '--cpus=2',
             '-e', 'MARIADB_ALLOW_EMPTY_ROOT_PASSWORD=1', '-e', 'MARIADB_DATABASE=restore_check',
             'mariadb:11.4', '--skip-networking', '--event-scheduler=OFF', '--local-infile=0'], capture_output=True)
        ready = False
        for _ in range(90):
            result = subprocess.run([DOCKER, 'exec', name, 'mariadb', '-uroot', 'restore_check', '-N', '-e', 'SELECT 1'],
                                    capture_output=True, timeout=10)
            if result.returncode == 0:
                # Socket can belong to the temporary initialization server; require final daemon PID1.
                command = run([DOCKER, 'exec', name, 'cat', '/proc/1/comm'], capture_output=True, text=True).stdout.strip()
                if command == 'mariadbd':
                    ready = True
                    break
            time.sleep(1)
        if not ready:
            raise RuntimeError('Isolated restore database did not initialize')
        decompress = subprocess.Popen(['zstd', '-dc', str(path)], stdout=subprocess.PIPE)
        try:
            run([DOCKER, 'exec', '-i', name, 'mariadb', '-uroot', '--binary-mode', 'restore_check'], stdin=decompress.stdout)
            decompress.stdout.close()
            if decompress.wait() != 0:
                raise RuntimeError('Restore decompression failed')
        finally:
            if decompress.poll() is None:
                decompress.terminate()
                decompress.wait(timeout=30)
        tables = run([DOCKER, 'exec', name, 'mariadb', '-uroot', '-N', '-B', 'restore_check', '-e',
                      'SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME'],
                     capture_output=True, text=True).stdout.splitlines()
        if tables != expected_tables:
            raise RuntimeError('Restored table inventory differs from source')
        return {'status': 'passed', 'tables': tables, 'duration_seconds': round(time.monotonic() - started, 2)}
    finally:
        run([DOCKER, 'rm', '-f', '-v', name], capture_output=True)


class Nas:
    def __init__(self, remote, config):
        self.remote = remote.rstrip('/')
        self.config = config

    def command(self, *args, **kwargs):
        return run([RCLONE, '--config', self.config, '--bwlimit', '8M', *args], **kwargs)

    def verify(self, remote, expected_hash):
        process = subprocess.Popen([RCLONE, '--config', self.config, '--bwlimit', '8M', 'cat', remote], stdout=subprocess.PIPE)
        h = hashlib.sha256()
        for chunk in iter(lambda: process.stdout.read(1024 * 1024), b''):
            h.update(chunk)
        process.stdout.close()
        if process.wait() != 0 or h.hexdigest() != expected_hash:
            raise RuntimeError('NAS readback checksum mismatch')

    def publish(self, local, relative):
        remote = self.remote + '/' + relative
        self.command('copyto', str(local), remote)
        self.verify(remote, digest(local))
        return remote


def publish_restored(path, report_path, report, nas):
    if report.get('restore', {}).get('status') != 'passed':
        raise RuntimeError('A successful full restore receipt is required')
    if path.stat().st_size != report['bytes'] or digest(path) != report['sha256']:
        raise RuntimeError('Local backup changed since restore verification')
    report.pop('error', None)
    report['status'] = 'publishing'
    atomic_json(report_path, report)
    backend, path_in_backend = nas.remote.split(':', 1)
    share_root = backend + ':' + path_in_backend.split('/')[0]
    capacity = json.loads(nas.command('about', share_root, '--json', capture_output=True, text=True).stdout)
    if 'free' not in capacity:
        raise RuntimeError('NAS share capacity unavailable; local backup preserved')
    if capacity['free'] < report['bytes'] + 100 * GIB:
        raise RuntimeError('NAS reserve below 100 GiB; local backup preserved')
    report['object'] = nas.publish(path, 'objects/' + report['sha256'] + '.sql.zst')
    report.update(status='verified', finished_at=dt.datetime.now(dt.timezone.utc).isoformat())
    atomic_json(report_path, report)
    nas.publish(report_path, 'manifests/' + report['backup_id'] + '.json')
    # NAS retains every generation. Local expiry requires a verified remote receipt.
    for previous in path.parent.glob('tag_observe-*.sql.zst'):
        if previous == path or time.time() - previous.stat().st_mtime < 14 * 86400:
            continue
        receipt = previous.with_suffix('.manifest.json')
        if not receipt.exists():
            continue
        old = json.loads(receipt.read_text())
        if old.get('status') != 'verified' or not old.get('object', '').startswith(nas.remote + '/objects/'):
            continue
        nas.verify(old['object'], old['sha256'])
        previous.unlink()
    print(json.dumps(report), flush=True)
    return report


def resume_backup(dest, report_path, nas):
    dest, report_path = dest.resolve(), report_path.resolve()
    if report_path.parent != dest:
        raise ValueError('Resume receipt must be in the configured backup directory')
    with (dest / '.backup.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        report = json.loads(report_path.read_text())
        path = (dest / report['file']).resolve()
        if path.parent != dest or report_path != path.with_suffix('.manifest.json') or report.get('database') != 'tag_observe':
            raise ValueError('Unexpected backup identity or path')
        import re
        if not re.fullmatch(r'\d{8}T\d{6}Z-[0-9a-f]{8}', report.get('backup_id', '')):
            raise ValueError('Invalid backup ID')
        try:
            return publish_restored(path, report_path, report, nas)
        except Exception as error:
            report.update(status='failed', error=str(error))
            atomic_json(report_path, report)
            raise


def backup(dest, nas):
    dest.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (dest / '.backup.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        stamp = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:8]
        path = dest / ('tag_observe-' + stamp + '.sql.zst')
        report_path = path.with_suffix('.manifest.json')
        report = {'version': 1, 'backup_id': stamp, 'database': 'tag_observe', 'status': 'running', 'started_at': dt.datetime.now(dt.timezone.utc).isoformat()}
        atomic_json(report_path, report)
        try:
            size = int(source_sql('SELECT COALESCE(SUM(DATA_LENGTH+INDEX_LENGTH),0) FROM information_schema.tables WHERE TABLE_SCHEMA=DATABASE()').strip())
            if shutil.disk_usage(dest).free < size * 1.5 + 25 * GIB:
                raise RuntimeError('Insufficient local space for full export and isolated restore; existing backups preserved')
            engines = source_sql("SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' AND ENGINE<>'InnoDB'").strip()
            if engines:
                raise RuntimeError('Consistent site backup requires InnoDB tables')
            tables, schema_hash = schema_signature()
            export_database(path)
            if schema_signature() != (tables, schema_hash):
                raise RuntimeError('Source schema changed during export; retry without concurrent DDL')
            report.update(file=path.name, bytes=path.stat().st_size, sha256=digest(path), schema_sha256=schema_hash)
            atomic_json(report_path, report)
            report['restore'] = restore_drill(path, tables)
            return publish_restored(path, report_path, report, nas)
        except Exception as error:
            report.update(status='failed', error=str(error))
            atomic_json(report_path, report)
            raise


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--resume', help='Resume publication of an already restored backup receipt')
    parser.add_argument('--dest', default='/home/deck/tag-analysis-private/backups')
    parser.add_argument('--remote', default='nas:Archive/tag.analysis.tw/site-db-v1')
    parser.add_argument('--rclone-config', default='/home/deck/.config/nas-backup/rclone.conf')
    args = parser.parse_args()
    if not Path(DOCKER).is_file() or not Path(RCLONE).is_file() or not shutil.which('zstd'):
        raise RuntimeError('docker, rclone and zstd must be installed before starting a backup')
    dest, nas = Path(args.dest), Nas(args.remote, args.rclone_config)
    if args.resume:
        resume_backup(dest, Path(args.resume), nas)
    else:
        for receipt in sorted(dest.glob('tag_observe-*.manifest.json')):
            old = json.loads(receipt.read_text())
            if old.get('status') in ('failed', 'publishing') and old.get('restore', {}).get('status') == 'passed':
                resume_backup(dest, receipt, nas)
        backup(dest, nas)


if __name__ == '__main__':
    main()
