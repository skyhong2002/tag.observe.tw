#!/usr/bin/env python3
"""Opt-in backup orchestration. Adapter commands are argv, never shell snippets.
No scheduling or retention mutation is performed by this program.
"""
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import shutil
import os
import selectors
import time
import subprocess
import sys
import signal
import re

GIB = 1024 ** 3


def sha256(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def stop_group(process):
    """Terminate only the session created for this invocation, including its children."""
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        pass
    # The leader may have exited while a descendant remains in our group.
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    process.wait(timeout=5)


def run(argv, timeout=3600, stdout=None):
    process = subprocess.Popen(['nice', '-n', '19', 'ionice', '-c', '3', *argv],
                               stdout=stdout, stderr=subprocess.DEVNULL,
                               start_new_session=True)
    try:
        code = process.wait(timeout=timeout)
        if code:
            raise RuntimeError('Adapter failed')
    finally:
        # Even a successful leader may leave descendants in our detached group.
        stop_group(process)


def require_space(directory, required):
    if shutil.disk_usage(directory).free < required:
        raise RuntimeError('Insufficient free space; stopped without deleting existing files')


def adapter(config, name, **values):
    argv = config['commands'][name]
    if not isinstance(argv, list) or not argv or not all(isinstance(x, str) for x in argv):
        raise ValueError('Adapter must be a nonempty argv array: ' + name)
    return [x.format(**values) for x in argv]


def command_names(job):
    return (['export', 'source_metadata', 'upload', 'readback', 'upload_manifest',
             'readback_manifest', 'upload_receipt', 'readback_receipt'] if job == 'daily' else
            ['fetch_manifest', 'fetch_latest', 'restore', 'inspect',
             'upload_receipt', 'readback_receipt'])


def validate_config(config):
    limit = config.get('local_copy_limit', 2)
    if type(limit) is not int or limit not in (1, 2):
        raise ValueError('local_copy_limit must be 1 or 2')


def plan(config, job):
    validate_config(config)
    for name in command_names(job):
        adapter(config, name, archive='ARCHIVE', receipt='RECEIPT',
                inspection='INSPECTION', manifest='MANIFEST')
    return {'job': job, 'execute': False, 'host': 'production' if job == 'daily' else 'mint-mbp',
            'steps': ['space gate', *command_names(job)], 'automatic_delete': False,
            'local_retention': '1–2 copies; stop for manual owner review when full'}


def metadata(data):
    tables = data.get('tables')
    if (not isinstance(tables, list) or not tables or
            any(not isinstance(t, str) or not t for t in tables) or
            len(set(tables)) != len(tables)):
        raise ValueError('Nonempty unique table list required')
    schema = data.get('schema_sha256')
    if not isinstance(schema, str) or not re.fullmatch('[0-9a-f]{64}', schema):
        raise ValueError('Valid schema SHA-256 required')
    counts = data.get('sample_counts')
    if (not isinstance(counts, dict) or not counts or
            any(k not in tables or type(v) is not int or v < 0 for k, v in counts.items())):
        raise ValueError('Nonempty sampled table counts required')
    return dict(tables=sorted(tables), schema_sha256=schema, sample_counts=counts)


def load_json(path):
    if path.stat().st_size > 1024 * 1024:
        raise ValueError('Metadata exceeds size limit')
    data = json.loads(path.read_text())
    if not isinstance(data, dict):
        raise ValueError('Metadata must be an object')
    return data


def remote_sha256(argv):
    process = subprocess.Popen(['nice', '-n', '19', 'ionice', '-c', '3', *argv],
                               stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, start_new_session=True)
    h = hashlib.sha256()
    selector = selectors.DefaultSelector()
    selector.register(process.stdout, selectors.EVENT_READ)
    deadline = time.monotonic() + 3600
    try:
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0 or not selector.select(min(remaining, 30)):
                raise TimeoutError('NAS readback exceeded deadline or stalled')
            chunk = os.read(process.stdout.fileno(), 1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
        if process.wait(timeout=30) != 0:
            raise RuntimeError('NAS readback command failed')
    finally:
        selector.close()
        process.stdout.close()
        # Cleanup our group even if its leader exited before an orphan descendant.
        stop_group(process)
    return h.hexdigest()


def execute(config, job, runner=run, remote_hash=remote_sha256):
    validate_config(config)
    plan(config, job)  # Validate every required adapter before creating files.
    if config.get('reviewed') is not True:
        raise ValueError('Config requires explicit reviewed=true after adapter and permissions review')
    directory = Path(config['directory'])
    require_space(directory, int(config['required_free_bytes'][job]))
    stamp = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S%f')
    archive = directory / ('backup-' + stamp + '.sql.zst')
    receipt = directory / ('receipt-' + stamp + '.json')
    inspection = directory / ('inspection-' + stamp + '.json')
    manifest = directory / ('manifest-' + stamp + '.json')
    values = dict(archive=str(archive), receipt=str(receipt), inspection=str(inspection), manifest=str(manifest))
    def command(name, **kwargs):
        return runner(adapter(config, name, **values), **kwargs)
    def verify(name, path):
        if remote_hash(adapter(config, name, **values)) != sha256(path):
            raise RuntimeError('NAS readback hash mismatch')
    if job == 'daily':
        if len(list(directory.glob('backup-*.sql.zst'))) >= config.get('local_copy_limit', 2):
            raise RuntimeError('Local copy limit reached; manual owner review required; no files deleted')
        with archive.open('xb') as output:
            command('export', stdout=output)
    else:
        if config.get('execution_host') != 'mint-mbp' or config.get('mariadb_series') != '11.4':
            raise ValueError('Weekly restore must run on reviewed mint-mbp MariaDB 11.4')
        # Fetch independently stored NAS manifest first; fetch_latest must select its archive_key.
        with manifest.open('xb') as output:
            command('fetch_manifest', stdout=output)
        baseline = load_json(manifest)
        expected = metadata(baseline)
        if not isinstance(baseline.get('archive_sha256'), str) or not re.fullmatch('[0-9a-f]{64}', baseline['archive_sha256']):
            raise ValueError('Manifest archive SHA-256 required')
        if not isinstance(baseline.get('archive_key'), str) or not re.fullmatch('backup-[0-9A-Za-z]+[.]sql[.]zst', baseline['archive_key']):
            raise ValueError('Manifest archive key required')
        if baseline.get('snapshot_binding') != 'export-snapshot':
            raise ValueError('Source metadata must describe the export snapshot')
        with archive.open('xb') as output:
            command('fetch_latest', stdout=output)
    runner(['zstd', '-t', '-q', str(archive)])
    checksum = sha256(archive)
    result = {'job': job, 'created_utc': stamp, 'archive': archive.name, 'sha256': checksum}
    if job == 'daily':
        # Independently capture source snapshot metadata; adapter must share export snapshot.
        with inspection.open('xb') as output:
            command('source_metadata', stdout=output)
        source = load_json(inspection)
        expected = metadata(source)
        if source.get('snapshot_binding') != 'export-snapshot':
            raise ValueError('Source metadata must describe the export snapshot')
        baseline = dict(expected, archive_key=archive.name, archive_sha256=checksum,
                        snapshot_binding='export-snapshot', created_utc=stamp)
        with manifest.open('x') as output:
            json.dump(baseline, output, indent=2)
        command('upload')
        verify('readback', archive)
        command('upload_manifest')
        verify('readback_manifest', manifest)
        result.update(status='nas-verified', source=expected, manifest_sha256=sha256(manifest))
    else:
        if baseline['archive_sha256'] != checksum:
            raise RuntimeError('Archive differs from independent NAS manifest')
        command('restore', timeout=12 * 3600)
        with inspection.open('xb') as output:
            command('inspect', stdout=output)
        evidence = metadata(load_json(inspection))
        if evidence != expected:
            raise RuntimeError('Restored tables/schema/counts differ from NAS manifest')
        result.update(status='restore-verified', evidence=evidence,
                      source_archive=baseline['archive_key'], manifest_sha256=sha256(manifest))
    with receipt.open('x') as output:
        json.dump(result, output, indent=2)
    command('upload_receipt')
    verify('readback_receipt', receipt)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True)
    parser.add_argument('--job', choices=['daily', 'weekly'], required=True)
    parser.add_argument('--execute', action='store_true')
    args = parser.parse_args()
    config = json.loads(Path(args.config).read_text())
    try:
        result = execute(config, args.job) if args.execute else plan(config, args.job)
        print(json.dumps(result, indent=2))
    except Exception as error:
        # Do not print subprocess argv, credentials, SQL, or user data.
        print('ALERT: backup-v2 failed (' + type(error).__name__ + '); investigate locally', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
