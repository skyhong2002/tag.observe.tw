#!/usr/bin/env python3
"""Resumable one-time integration of verified nearline article chunks."""
import argparse
import fcntl
import gzip
import json
import os
from pathlib import Path
import shutil
import subprocess
import time
import uuid

from pipeline import Pipeline, now, sha256, write_json


def run_checked(command, *, timeout, cwd):
    process = subprocess.Popen(command, cwd=cwd)
    try:
        code = process.wait(timeout=timeout)
        if code:
            raise subprocess.CalledProcessError(code, command)
    except BaseException:
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=30)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
        raise


def archive_directory(pipeline, directory, remote):
    """Publish files and read them back before exposing the completion manifest."""
    files = []
    for path in sorted(directory.iterdir()):
        if not path.is_file() or path.name == 'archive-manifest.json' or path.name.endswith('.verify'):
            continue
        if path.suffix == '.jsonl':
            packed = path.with_suffix('.jsonl.gz')
            with path.open('rb') as src, gzip.GzipFile(filename=str(packed), mode='wb', mtime=0) as dest:
                shutil.copyfileobj(src, dest)
            path = packed
        if any(f['file'] == path.name for f in files):
            continue
        digest = sha256(path)
        pipeline.rclone('copyto', str(path), remote + '/' + path.name)
        with path.with_suffix(path.suffix + '.verify').open('wb') as verify:
            pipeline.rclone('cat', remote + '/' + path.name, stdout=verify)
        verified = path.with_suffix(path.suffix + '.verify')
        try:
            if sha256(verified) != digest:
                raise RuntimeError('NAS readback mismatch: ' + path.name)
        finally:
            verified.unlink(missing_ok=True)
        files.append({'file': path.name, 'sha256': digest, 'bytes': path.stat().st_size})
    result = {'status': 'verified', 'verified_at': now(), 'files': files, 'remote': remote}
    manifest = directory / 'archive-manifest.json'
    write_json(manifest, result)
    pipeline.rclone('copyto', str(manifest), remote + '/archive-manifest.json')
    data = pipeline.rclone('cat', remote + '/archive-manifest.json', capture_output=True).stdout
    if data != manifest.read_bytes():
        raise RuntimeError('Archive manifest readback mismatch')
    return result


def publish_checkpoint(pipeline, path, generation):
    remote = pipeline.cfg['remote'].rstrip('/') + '/integration-v1/' + generation + '/checkpoint.json'
    pipeline.rclone('copyto', str(path), remote)
    if pipeline.rclone('cat', remote, capture_output=True).stdout != path.read_bytes():
        raise RuntimeError('Checkpoint readback mismatch')


def summarize(state):
    counts = {}
    for result in state['completed'].values():
        for action, n in result['counts'].items():
            counts[action] = counts.get(action, 0) + n
    return {'completed_chunks': len(state['completed']), 'rows': sum(counts.values()), 'counts': counts}


def needs_processing(previous, allow_recent, mapping_sha=None):
    if previous is None:
        return True
    reasons = previous.get('quarantine_reasons', {})
    return bool((allow_recent and not previous.get('allow_recent', False)
                 and reasons.get('recent_requires_separate_review', 0))
                or (mapping_sha and previous.get('mapping_sha256') != mapping_sha
                    and any('unreviewed_url_host' in reason and count for reason, count in reasons.items())))


def integrate(config):
    root = Path(config['state_dir'])
    root.mkdir(parents=True, exist_ok=True)
    with (root / 'lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        backup_config = json.loads(Path(config['backup_config']).read_text())
        pipeline = Pipeline(backup_config)
        plan = json.loads(Path(config['plan']).read_text())
        checkpoint = root / 'state.json'
        state = json.loads(checkpoint.read_text()) if checkpoint.exists() else {'generation': plan['generation'], 'completed': {}, 'started_at': now()}
        if state['generation'] != plan['generation']:
            raise ValueError('Checkpoint generation mismatch')
        allow_recent = bool(config.get('allow_recent', False))
        plan_hash = sha256(Path(config['plan']))
        if state.get('status') == 'plan_complete' and state.get('plan_sha256') == plan_hash and state.get('allow_recent', False) == allow_recent:
            print('This fixed integration plan is already complete', flush=True)
            return
        manifest = pipeline.load_manifest(plan['generation'])
        state.update(status='running', updated_at=now(), last_error=None, plan_sha256=plan_hash, allow_recent=allow_recent, code_version=Path(config['code_root']).name)
        write_json(checkpoint, state)
        repo = Path(config['code_root'])
        if plan.get('mappingSha256') and sha256(repo / 'app/data/legacy-media-mapping.json') != plan['mappingSha256']:
            raise RuntimeError('Plan/media mapping version mismatch')
        work = root / 'work'
        work.mkdir(exist_ok=True)
        started = time.monotonic()
        try:
            for item in plan['tables']:
                if item['action'] != 'import_articles':
                    continue
                table_name, media = item['table'], item['media']
                table = manifest['tables'][table_name]
                if table['status'] != 'complete':
                    continue
                for index, chunk in enumerate(table['chunks']):
                    key = table_name + '/' + chunk['sha256']
                    previous_result = state['completed'].get(key)
                    if not needs_processing(previous_result, allow_recent, plan.get('mappingSha256')):
                        continue
                    if time.monotonic() - started > config.get('max_run_seconds', 1800):
                        state.update(status='batch_complete', updated_at=now(), summary=summarize(state))
                        write_json(checkpoint, state)
                        return
                    if shutil.disk_usage(root).free < 25 * 2**30:
                        raise RuntimeError('Less than 25 GiB local free space; preserving pending data')
                    pipeline.capacity()
                    # A changed mapping must not reuse normalized output or apply receipts.
                    revision = plan.get('mappingSha256', 'unversioned')
                    package = work / revision / table_name / chunk['sha256']
                    package.mkdir(parents=True, exist_ok=True)
                    fetched = package / 'fetched'
                    prepared = package / 'prepared'
                    namespace = 'integration-v3/' + revision + ('/recent' if allow_recent else '/historical')
                    remote = backup_config['remote'].rstrip('/') + '/' + namespace + '/' + plan['generation'] + '/' + key
                    state.update(current={'table': table_name, 'chunk': index, 'object': chunk['sha256'], 'stage': 'fetch'}, updated_at=now())
                    write_json(checkpoint, state)
                    print(json.dumps(state['current']), flush=True)
                    if not (fetched / 'manifest.json').exists():
                        fetched.mkdir(exist_ok=True)
                        pipeline.fetch_object(table['schema'], fetched / 'schema.sql.gz')
                        pipeline.fetch_object(chunk, fetched / ('data-%06d.sql.gz' % index))
                        write_json(fetched / 'manifest.json', {'generation': plan['generation'], 'source': manifest['source'], 'table': table_name,
                            'consistency': manifest['consistency'], 'schema': table['schema'], 'chunks': [chunk]})
                    ready = prepared / 'source-manifest.json'
                    if not ready.exists():
                        if prepared.exists():
                            # Only this job's incomplete generated staging output.
                            shutil.rmtree(prepared)
                        run_checked(['python3', str(repo / 'tools/nearline/prepare.py'), '--package', str(fetched), '--media', media, '--out', str(prepared)], timeout=1200, cwd=repo)
                    state['current']['stage'] = 'archive_prepared'
                    write_json(checkpoint, state)
                    archive_directory(pipeline, prepared, remote + '/prepared')
                    attempt = None
                    prepared_report = json.loads((prepared / 'report.json').read_text())
                    for previous in sorted(package.glob('apply-*/report.json')):
                        try:
                            prior = json.loads(previous.read_text())
                            if prior['status'] == 'complete' and prior['processed'] == prior['rows'] and prior['packageSha256'] == prepared_report['compressedSha256'] and prior.get('allowRecent', False) == allow_recent:
                                attempt = previous.parent
                                break
                        except (ValueError, KeyError):
                            pass
                    state['current']['stage'] = 'apply'
                    write_json(checkpoint, state)
                    if attempt is None:
                        attempt = package / ('apply-' + uuid.uuid4().hex[:12])
                        run_checked(['node', '--env-file=' + config['env_file'], str(repo / 'tools/nearline/import-articles.ts'), '--package', str(prepared), '--out', str(attempt), '--apply'] + (['--allow-recent'] if allow_recent else []), timeout=1800, cwd=repo)
                    report = json.loads((attempt / 'report.json').read_text())
                    if report['status'] != 'complete' or report['processed'] != report['rows']:
                        raise RuntimeError('Incomplete apply report')
                    reasons = {}
                    with (attempt / 'outcomes.jsonl').open() as audit:
                        for line in audit:
                            outcome = json.loads(line)
                            if outcome.get('reason'):
                                reasons[outcome['reason']] = reasons.get(outcome['reason'], 0) + 1
                    state['current']['stage'] = 'archive_result'
                    write_json(checkpoint, state)
                    archive = archive_directory(pipeline, attempt, remote + '/' + attempt.name)
                    if previous_result:
                        state.setdefault('previous_results', {}).setdefault(key, []).append(previous_result)
                    state['completed'][key] = {'mapping_sha256': plan.get('mappingSha256'), 'allow_recent': allow_recent, 'table': table_name, 'chunk': index, 'object': chunk['sha256'], 'rows': report['rows'], 'counts': report['counts'], 'quarantine_reasons': reasons, 'verified_origins': report.get('verifiedOrigins'), 'prepared': remote + '/prepared', 'audit': archive['remote'], 'finished_at': now()}
                    state.update(updated_at=now(), summary=summarize(state))
                    write_json(checkpoint, state)
                    publish_checkpoint(pipeline, checkpoint, plan['generation'])
                    # Every input is already archived; generated data and ID
                    # mappings have additionally passed NAS readback verification.
                    shutil.rmtree(package)
                    time.sleep(config.get('pause_seconds', 2))
            pending_tables = [i['table'] for i in plan['tables'] if i['action'] == 'import_articles' and manifest['tables'][i['table']]['status'] != 'complete']
            state.update(status='waiting_for_backup' if pending_tables else 'plan_complete', waiting_tables=pending_tables, current=None, updated_at=now(), summary=summarize(state))
            write_json(checkpoint, state)
            publish_checkpoint(pipeline, checkpoint, plan['generation'])
        except Exception as error:
            state.update(status='failed', last_error=str(error), updated_at=now(), summary=summarize(state))
            write_json(checkpoint, state)
            raise


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True)
    args = parser.parse_args()
    integrate(json.loads(Path(args.config).read_text()))


if __name__ == '__main__':
    main()
