#!/usr/bin/env python3
"""Verified new-site logical backup, isolated restore, and NAS publication."""
import argparse
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import time
import uuid

DOCKER = '/home/deck/.local/bin/docker'
RCLONE = '/home/deck/.local/bin/rclone'
RESTIC = '/usr/bin/restic'
HEX64 = re.compile(r'[0-9a-f]{64}')
# One row per INSERT keeps unchanged rows byte-identical between nights, so the
# deduplicating NAS store only adds what changed (#33). With extended inserts a
# single row changing length shifts every later statement boundary.
DUMP_OPTIONS = ['--single-transaction', '--quick', '--routines', '--events', '--hex-blob',
                '--skip-extended-insert', '--no-autocommit']
GIB = 1024 ** 3
RESERVE = 25 * GIB


def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def restore_root(dest):
    """Directory whose filesystem holds the isolated restore: Docker's data root.

    The restore drill runs in a throwaway MariaDB container, so its data is
    written under Docker's root, not the backup directory. On hosts where both
    share one filesystem this is the same check as before. If Docker cannot be
    asked, fall back to the backup directory (the previous behaviour).
    """
    try:
        root = run([DOCKER, 'info', '--format', '{{.DockerRootDir}}'],
                   capture_output=True, text=True, timeout=30).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return dest
    return Path(root) if root and Path(root).is_dir() else dest


def same_filesystem(a, b):
    return os.stat(a).st_dev == os.stat(b).st_dev


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


def source_storage_bytes(metadata_bytes):
    # InnoDB statistics may underestimate allocated tablespaces. Measure the
    # source too; neither number is treated as an exact restore size.
    output = run([DOCKER, 'exec', 'tag-db', 'du', '-s', '-B1', '/var/lib/mysql/tag_observe'],
                 capture_output=True, text=True, timeout=60).stdout
    allocated = int(output.split()[0])
    if allocated <= 0:
        raise RuntimeError('Source storage measurement unavailable')
    return max(metadata_bytes, allocated)


def restore_required(storage_bytes):
    return (storage_bytes * 115 + 99) // 100 + RESERVE


def stop_process(process):
    if process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=30)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=30)


def wait_pipeline(processes, directory, *, timeout=12 * 3600):
    """Keep production SSD headroom while long export/restore processes run."""
    started = time.monotonic()
    try:
        while True:
            codes = [process.poll() for process in processes]
            if any(code not in (None, 0) for code in codes):
                raise RuntimeError('Backup stream process failed')
            if shutil.disk_usage(directory).free < RESERVE:
                raise RuntimeError('Backup stopped below 25 GiB SSD reserve; existing backups preserved')
            if all(code == 0 for code in codes):
                return
            if time.monotonic() - started > timeout:
                raise RuntimeError('Backup stream exceeded time budget')
            time.sleep(5)
    finally:
        for process in processes:
            stop_process(process)


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
                                 *DUMP_OPTIONS, 'tag_observe'],
                                env=env, stdout=subprocess.PIPE)
        try:
            compressed = subprocess.Popen(['zstd', '-T2', '-q'], stdin=dump.stdout, stdout=output)
            dump.stdout.close()
            wait_pipeline([compressed, dump], path.parent)
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
             'mariadb:11.4', '--skip-networking', '--event-scheduler=OFF', '--local-infile=0',
             '--innodb-buffer-pool-size=1G', '--innodb-log-file-size=1G',
             '--innodb-flush-log-at-trx-commit=2', '--innodb-doublewrite=OFF'], capture_output=True)
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
            restore = subprocess.Popen([DOCKER, 'exec', '-i', name, 'mariadb', '-uroot', '--binary-mode', 'restore_check'], stdin=decompress.stdout)
            decompress.stdout.close()
            wait_pipeline([restore, decompress], path.parent)
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


class Restic:
    """Deduplicating NAS store: each verified dump is one snapshot of its SQL text."""

    def __init__(self, repository, password_file, rclone_config):
        self.repository = repository
        self.env = dict(os.environ, RESTIC_REPOSITORY=repository, RESTIC_PASSWORD_FILE=str(password_file))
        self.base = [RESTIC, '-o', 'rclone.program=' + RCLONE,
                     '-o', 'rclone.args=serve restic --stdio --config ' + str(rclone_config) + ' --bwlimit 8M']

    def object_name(self, snapshot):
        return 'restic:' + self.repository + '#' + snapshot

    def backup(self, path, backup_id):
        decompress = subprocess.Popen(['zstd', '-dc', str(path)], stdout=subprocess.PIPE)
        store = subprocess.Popen([*self.base, 'backup', '--stdin', '--stdin-filename', 'tag_observe.sql',
                                  '--host', 'tag-observe-site', '--tag', backup_id, '--json', '--quiet'],
                                 stdin=subprocess.PIPE, stdout=subprocess.PIPE, env=self.env)
        h = hashlib.sha256()
        try:
            for chunk in iter(lambda: decompress.stdout.read(1024 * 1024), b''):
                h.update(chunk)
                store.stdin.write(chunk)
            store.stdin.close()
            output = store.stdout.read()
        finally:
            stop_process(decompress)
            if store.poll() is None:
                store.wait(timeout=12 * 3600)
        if decompress.returncode != 0 or store.returncode != 0:
            raise RuntimeError('Restic backup failed; local backup preserved')
        summary = next((json.loads(line) for line in output.splitlines()
                        if line.strip().startswith(b'{') and json.loads(line).get('message_type') == 'summary'), {})
        snapshot = summary.get('snapshot_id', '')
        if not HEX64.fullmatch(snapshot):
            raise RuntimeError('Restic did not report a snapshot; local backup preserved')
        return {'snapshot': snapshot, 'sql_sha256': h.hexdigest(),
                'data_added_packed': summary.get('data_added_packed')}

    def verify(self, snapshot, sql_sha256):
        if not HEX64.fullmatch(snapshot):
            raise ValueError('Invalid restic snapshot ID')
        process = subprocess.Popen([*self.base, 'dump', snapshot, '/tag_observe.sql'], stdout=subprocess.PIPE, env=self.env)
        h = hashlib.sha256()
        for chunk in iter(lambda: process.stdout.read(1024 * 1024), b''):
            h.update(chunk)
        process.stdout.close()
        if process.wait() != 0 or h.hexdigest() != sql_sha256:
            raise RuntimeError('NAS restic readback checksum mismatch')


def remote_copy_check(old, nas, restic=None):
    """Return a callable proving the NAS copy behind a receipt, or None if unprovable."""
    sha, obj = old.get('sha256', ''), old.get('object', '')
    if isinstance(sha, str) and HEX64.fullmatch(sha) and obj == nas.remote + '/objects/' + sha + '.sql.zst':
        return lambda: nas.verify(obj, sha)
    proof = old.get('restic') if isinstance(old.get('restic'), dict) else {}
    snapshot, sql_sha = proof.get('snapshot', ''), proof.get('sql_sha256', '')
    if (restic is not None and isinstance(snapshot, str) and HEX64.fullmatch(snapshot)
            and isinstance(sql_sha, str) and HEX64.fullmatch(sql_sha) and obj == restic.object_name(snapshot)):
        return lambda: restic.verify(snapshot, sql_sha)
    return None


def publish_restored(path, report_path, report, nas, restic=None):
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
    if restic is None:
        report['object'] = nas.publish(path, 'objects/' + report['sha256'] + '.sql.zst')
    else:
        proof = restic.backup(path, report['backup_id'])
        restic.verify(proof['snapshot'], proof['sql_sha256'])
        report.update(restic=proof, object=restic.object_name(proof['snapshot']))
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
        check = remote_copy_check(old, nas, restic) if old.get('status') == 'verified' else None
        if check is None:
            continue
        check()
        previous.unlink()
    print(json.dumps(report), flush=True)
    return report


def resume_backup(dest, report_path, nas, *, trim_docker=False, reclaim_verified=False, restic=None):
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
            # Capacity maintenance may intentionally remove an unverified
            # export after recording why it cannot be resumed.  A stale
            # receipt must not prevent the next scheduled full backup.
            if not path.is_file():
                if report.get('local_dump_removed') or report.get('removal_reason'):
                    return {'status': 'skipped_missing_local_dump', 'backup_id': report['backup_id']}
                raise FileNotFoundError(path)
            if report.get('restore', {}).get('status') != 'passed':
                if (report.get('export_status') != 'passed' or not isinstance(report.get('tables'), list)
                        or not report['tables'] or path.stat().st_size != report.get('bytes')
                        or digest(path) != report.get('sha256')):
                    raise RuntimeError('A verified export receipt is required before resuming restore')
                required = restore_required(report['source_storage_bytes'])
                if shutil.disk_usage(restore_root(dest)).free < required:
                    raise RuntimeError('Insufficient local space for isolated restore; exported backup preserved')
                report.update(status='restoring', restore_started_at=dt.datetime.now(dt.timezone.utc).isoformat())
                atomic_json(report_path, report)
                report['restore'] = restore_drill(path, report['tables'])
                atomic_json(report_path, report)
            result = publish_restored(path, report_path, report, nas, restic)
            finish_capacity(dest, nas, result, trim_docker=trim_docker, reclaim_verified=reclaim_verified, restic=restic)
            return result
        except Exception as error:
            report.update(status='failed', error=str(error))
            atomic_json(report_path, report)
            raise


def trim_docker_storage():
    """Trim only this host's mounted Docker filesystem, using existing Docker access.

    The target is whatever Docker reports as its data root (/home/.docker-data on
    the old host, /var/lib/docker on sky-server). It must be a dedicated mount so
    the trim never touches the root filesystem by accident.
    """
    target = run([DOCKER, 'info', '--format', '{{.DockerRootDir}}'], capture_output=True, text=True).stdout.strip()
    if not os.path.isabs(target) or target == '/' or not os.path.ismount(target):
        raise RuntimeError('Docker trim requires a mounted Docker data directory, got ' + repr(target))
    result = run([DOCKER, 'run', '--rm', '--network', 'none', '--cap-drop', 'ALL',
                  '--cap-add', 'SYS_ADMIN', '--mount', 'type=bind,src=' + target + ',dst=/trim',
                  '--entrypoint', '/usr/sbin/fstrim', 'mariadb:11.4', '-v', '/trim'],
                 capture_output=True, text=True, timeout=300)
    return {'target': target, 'output': result.stdout.strip()}


def reclaim_for_capacity(dest, nas, required, report_path, report, restic=None):
    """Under the backup lock, expire verified duplicates only; retain the newest verified dump."""
    dumps = sorted(p for p in dest.glob('tag_observe-*.sql.zst') if p.is_file() and not p.is_symlink())
    verified = []
    for path in dumps:
        receipt = path.with_suffix('.manifest.json')
        if not receipt.is_file() or receipt.is_symlink():
            continue
        raw = receipt.read_bytes()
        try:
            old = json.loads(raw)
        except (ValueError, UnicodeError):
            continue
        if not isinstance(old, dict):
            continue
        backup_id = old.get('backup_id', '')
        sha = old.get('sha256', '')
        if (old.get('status') != 'verified' or not isinstance(old.get('restore'), dict)
                or old['restore'].get('status') != 'passed'
                or not isinstance(backup_id, str) or not re.fullmatch(r'\d{8}T\d{6}Z-[0-9a-f]{8}', backup_id)
                or not isinstance(sha, str) or not re.fullmatch(r'[0-9a-f]{64}', sha)
                or path.name != 'tag_observe-' + backup_id + '.sql.zst'
                or old.get('file') != path.name):
            continue
        check = remote_copy_check(old, nas, restic)
        if check is None:
            continue
        verified.append((path, receipt, raw, old, check))
    # Also protect the newest dump even if its receipt is incomplete or failed.
    protected = {dumps[-1]} if dumps else set()
    if verified:
        protected.add(verified[-1][0])
    if any(path not in protected for path, *_ in verified):
        latest, _, _, proof, _ = verified[-1]
        if latest.stat().st_size != proof.get('bytes') or digest(latest) != proof['sha256']:
            raise RuntimeError('Newest verified local backup is damaged; preserve older copies')
    for path, receipt, raw, old, check in verified:
        if shutil.disk_usage(dest).free >= required:
            break
        if path in protected:
            continue
        before = path.lstat()
        if before.st_size != old.get('bytes') or digest(path) != old['sha256']:
            raise RuntimeError('Local reclaim candidate differs from its verified receipt')
        remote_receipt = nas.remote + '/manifests/' + old['backup_id'] + '.json'
        remote = nas.command('cat', remote_receipt, capture_output=True).stdout
        if remote != raw:
            raise RuntimeError('NAS reclaim receipt differs from the local receipt')
        check()
        after = path.lstat()
        identity = lambda s: (s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns, s.st_ctime_ns)
        if path.is_symlink() or identity(after) != identity(before) or receipt.read_bytes() != raw:
            raise RuntimeError('Local reclaim candidate changed during NAS verification')
        item = {'file': path.name, 'bytes': before.st_size, 'sha256': old['sha256'],
                'object': old['object'], 'status': 'verified_before_local_removal'}
        report.setdefault('capacity_reclaims', []).append(item)
        atomic_json(report_path, report)
        path.unlink()
        item['status'] = 'local_removed_nas_retained'
        atomic_json(report_path, report)


def finish_capacity(dest, nas, report, *, trim_docker=False, reclaim_verified=False, restic=None):
    # Keep the published backup receipt immutable. A separate maintenance
    # receipt records local expiry, so future remote receipt equality holds.
    path = dest / ('capacity-after-' + report['backup_id'] + '.json')
    maintenance = {'backup_id': report['backup_id'], 'status': 'running'}
    try:
        if trim_docker:
            maintenance['docker_trim'] = trim_docker_storage()
        restore = restore_required(report.get('source_storage_bytes', 0))
        required = (restore if same_filesystem(restore_root(dest), dest) else RESERVE) + (report['bytes'] * 5 + 3) // 4
        maintenance['required_for_next_backup'] = required
        if reclaim_verified and report.get('source_storage_bytes'):
            reclaim_for_capacity(dest, nas, required, path, maintenance, restic)
        maintenance.update(status='complete', free_bytes=shutil.disk_usage(dest).free)
    except Exception:
        # The full backup remains valid; expose failed maintenance separately.
        maintenance['status'] = 'failed'
        maintenance['error'] = 'Capacity maintenance failed; local copies preserved where unverified'
    atomic_json(path, maintenance)
    print(json.dumps({'capacity_maintenance': maintenance}), flush=True)


def backup(dest, nas, *, trim_docker=False, reclaim_verified=False, restic=None):
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
            # Export and restore are separate phases. The compressed dump is
            # already charged against free space before the restore check.
            storage = source_storage_bytes(size)
            required = size // 2 + RESERVE
            report.update(capacity_policy='measured-phases-v1', source_storage_bytes=storage,
                          required_free_bytes=required, restore_required_free_bytes=restore_required(storage))
            if trim_docker and shutil.disk_usage(dest).free < required:
                report['docker_trim'] = trim_docker_storage()
                atomic_json(report_path, report)
            if reclaim_verified and shutil.disk_usage(dest).free < required:
                reclaim_for_capacity(dest, nas, required, report_path, report, restic)
            report['free_bytes_before_export'] = shutil.disk_usage(dest).free
            atomic_json(report_path, report)
            if report['free_bytes_before_export'] < required:
                raise RuntimeError('Insufficient local space for full export and isolated restore; existing backups preserved')
            engines = source_sql("SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' AND ENGINE<>'InnoDB'").strip()
            if engines:
                raise RuntimeError('Consistent site backup requires InnoDB tables')
            tables, schema_hash = schema_signature()
            export_database(path)
            if schema_signature() != (tables, schema_hash):
                raise RuntimeError('Source schema changed during export; retry without concurrent DDL')
            report.update(file=path.name, bytes=path.stat().st_size, sha256=digest(path), schema_sha256=schema_hash,
                          tables=tables, export_status='passed', status='exported')
            atomic_json(report_path, report)
            required = restore_required(storage)
            scratch = restore_root(dest)
            if trim_docker and shutil.disk_usage(scratch).free < required:
                report['docker_trim_before_restore'] = trim_docker_storage()
            if reclaim_verified and shutil.disk_usage(scratch).free < required and same_filesystem(scratch, dest):
                reclaim_for_capacity(dest, nas, required, report_path, report, restic)
            report['free_bytes_before_restore'] = shutil.disk_usage(scratch).free
            if report['free_bytes_before_restore'] < required:
                raise RuntimeError('Insufficient local space for isolated restore; exported backup preserved')
            report.update(status='restoring', restore_started_at=dt.datetime.now(dt.timezone.utc).isoformat())
            atomic_json(report_path, report)
            report['restore'] = restore_drill(path, tables)
            atomic_json(report_path, report)
            result = publish_restored(path, report_path, report, nas, restic)
            finish_capacity(dest, nas, result, trim_docker=trim_docker, reclaim_verified=reclaim_verified, restic=restic)
            return result
        except Exception as error:
            report.update(status='failed', error=str(error))
            atomic_json(report_path, report)
            raise


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--resume', help='Resume publication of an already restored backup receipt')
    parser.add_argument('--trim-docker-data', action='store_true', help="On space pressure, trim Docker's data root (must be its own mount)")
    parser.add_argument('--reclaim-verified-on-pressure', action='store_true', help='Reverify and expire older local NAS duplicates under space pressure; retain newest verified dump')
    parser.add_argument('--dest', default='/home/deck/tag-analysis-private/backups')
    parser.add_argument('--remote', default='nas:Archive/tag.analysis.tw/site-db-v1')
    parser.add_argument('--rclone-config', default='/home/deck/.config/nas-backup/rclone.conf')
    parser.add_argument('--restic-repository', default='rclone:nas:Archive/tag.analysis.tw/site-db-restic',
                        help='Deduplicating store for new dumps; receipts and manifests stay under --remote')
    parser.add_argument('--restic-password-file', default='/home/deck/.config/nas-backup/restic-password')
    args = parser.parse_args()
    if not Path(DOCKER).is_file() or not Path(RCLONE).is_file() or not Path(RESTIC).is_file() or not shutil.which('zstd'):
        raise RuntimeError('docker, rclone, restic and zstd must be installed before starting a backup')
    if not Path(args.restic_password_file).is_file():
        raise RuntimeError('Restic password file missing; refusing to back up without the NAS store')
    dest, nas = Path(args.dest), Nas(args.remote, args.rclone_config)
    restic = Restic(args.restic_repository, args.restic_password_file, args.rclone_config)
    if args.resume:
        resume_backup(dest, Path(args.resume), nas, trim_docker=args.trim_docker_data, reclaim_verified=args.reclaim_verified_on_pressure, restic=restic)
    else:
        for receipt in sorted(dest.glob('tag_observe-*.manifest.json')):
            old = json.loads(receipt.read_text())
            if old.get('status') in ('failed', 'publishing', 'exported', 'restoring') and (old.get('restore', {}).get('status') == 'passed' or old.get('export_status') == 'passed'):
                resume_backup(dest, receipt, nas, trim_docker=args.trim_docker_data, reclaim_verified=args.reclaim_verified_on_pressure, restic=restic)
        backup(dest, nas, trim_docker=args.trim_docker_data, reclaim_verified=args.reclaim_verified_on_pressure, restic=restic)


if __name__ == '__main__':
    main()
