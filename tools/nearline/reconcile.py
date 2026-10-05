#!/usr/bin/env python3
"""Independently reconcile NAS prepared rows, audit receipts and live origins."""
import argparse
import collections
import fcntl
import gzip
import hashlib
import itertools
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile

from pipeline import Pipeline, now, sha256, write_json


def reconcile_rows(prepared, outcomes, expected, table, source, generation, object_hash):
    counts = collections.Counter()
    reasons = collections.Counter()
    seen = set()
    raw_hash = hashlib.sha256()
    with gzip.open(prepared, 'rb') as inputs, gzip.open(outcomes, 'rb') as outputs:
        for left, right in itertools.zip_longest(inputs, outputs):
            if left is None or right is None:
                raise ValueError('Prepared/audit row count mismatch')
            raw_hash.update(left)
            candidate, result = json.loads(left), json.loads(right)
            lineage = candidate['lineage']
            identity = (lineage['sourceKey'], lineage['rawSha256'])
            if identity in seen:
                raise ValueError('Duplicate source identity in package')
            seen.add(identity)
            if not re.fullmatch('[0-9a-f]{64}', identity[1]) or not re.fullmatch(re.escape(source + '/' + table + '/') + r'\d+', identity[0]):
                raise ValueError('Unexpected source identity')
            if lineage['generation'] != generation or lineage['objects'] != [object_hash]:
                raise ValueError('Prepared row belongs to another source object')
            if (result['sourceKey'], result['rawHash']) != identity:
                raise ValueError('Outcome does not account for corresponding prepared row')
            action = result['action']
            if action not in {'inserted', 'linked_existing', 'already_imported', 'quarantine'}:
                raise ValueError('Unknown outcome')
            if action == 'quarantine':
                if not result.get('reason') or result.get('articleId'):
                    raise ValueError('Invalid quarantine outcome')
                reasons[result['reason']] += 1
            elif not re.fullmatch(r'[1-9]\d*', str(result.get('articleId', ''))):
                raise ValueError('Successful outcome lacks article ID')
            counts[action] += 1
    if len(seen) != expected:
        raise ValueError('Package row total differs from report')
    return {'rows': len(seen), 'counts': dict(counts), 'quarantine_reasons': dict(reasons), 'normalized_sha256': raw_hash.hexdigest()}


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True)
    parser.add_argument('--max-chunks', type=int, default=4)
    args = parser.parse_args()
    if args.max_chunks < 1:
        raise ValueError('max-chunks must be positive')
    cfg = json.loads(Path(args.config).read_text())
    root = Path(cfg['state_dir'])
    lock = (root / 'reconciliation.lock').open('a')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    state = json.loads((root / 'state.json').read_text())
    pipeline = Pipeline(json.loads(Path(cfg['backup_config']).read_text()))
    source_manifest = pipeline.load_manifest(state['generation'])
    destination = root / 'reconciliation.json'
    checks = json.loads(destination.read_text()) if destination.exists() else {'generation': state['generation'], 'chunks': {}}
    if checks['generation'] != state['generation']:
        raise ValueError('Reconciliation generation mismatch')
    current_repo = Path(__file__).resolve().parents[2]
    processed = 0
    for key, item in state['completed'].items():
        if key in checks['chunks'] and checks['chunks'][key]['audit'] == item['audit']:
            continue
        if processed >= args.max_chunks:
            break
        table, digest = key.split('/')
        source_chunk = source_manifest['tables'][table]['chunks'][item['chunk']]
        if source_chunk['sha256'] != digest or item['object'] != digest:
            raise ValueError('Completion receipt references wrong raw object')
        with tempfile.TemporaryDirectory(prefix='reconcile-', dir=root) as directory:
            tmp = Path(directory)
            def get(remote, name):
                if not remote.startswith(pipeline.cfg['remote'].rstrip('/') + '/'):
                    raise ValueError('Receipt points outside configured archive')
                target = tmp / name
                pipeline.rclone('copyto', remote, str(target))
                return target
            prepared_report = json.loads(get(item['prepared'] + '/report.json', 'prepared-report.json').read_text())
            apply_report = json.loads(get(item['audit'] + '/report.json', 'apply-report.json').read_text())
            package_manifest = json.loads(get(item['prepared'] + '/source-manifest.json', 'source-manifest.json').read_text())
            if package_manifest['generation'] != state['generation'] or package_manifest['table'] != table or package_manifest['chunks'] != [source_chunk]:
                raise ValueError('Prepared manifest disagrees with source archive')
            if prepared_report.get('restored_rows') != item['rows'] or prepared_report.get('restore_row_count_verified') is not True:
                raise ValueError('Source restore count is not verified')
            if apply_report['status'] != 'complete' or apply_report['processed'] != item['rows'] or apply_report['rows'] != item['rows']:
                raise ValueError('Apply receipt is incomplete')
            if apply_report['generation'] != state['generation'] or apply_report['sourceObject'] != source_chunk['object']:
                raise ValueError('Apply report references wrong generation/object')
            prepared = get(item['prepared'] + '/articles.jsonl.gz', 'articles.jsonl.gz')
            outcomes = get(item['audit'] + '/outcomes.jsonl.gz', 'outcomes.jsonl.gz')
            if sha256(prepared) != prepared_report['compressedSha256'] or sha256(prepared) != apply_report['packageSha256']:
                raise ValueError('Prepared content hash mismatch')
            if '/imports/20261005-cna-first/apply' in item['audit']:
                audit_manifest = json.loads(get(item['audit'].rsplit('/', 1)[0] + '/manifest.json', 'audit-manifest.json').read_text())
                prefix = 'apply/'
            else:
                audit_manifest = json.loads(get(item['audit'] + '/archive-manifest.json', 'audit-manifest.json').read_text())
                prefix = ''
            sealed = {entry['file']: entry for entry in audit_manifest['files']}
            for path, name in [(outcomes, 'outcomes.jsonl.gz'), (tmp / 'apply-report.json', 'report.json')]:
                entry = sealed[prefix + name]
                if sha256(path) != entry['sha256'] or path.stat().st_size != entry['bytes']:
                    raise ValueError('Apply artifact differs from sealed NAS manifest')
            result = reconcile_rows(prepared, outcomes, item['rows'], table, source_manifest['source'], state['generation'], digest)
            if result['counts'] != item['counts'] or result['counts'] != apply_report['counts'] or result['normalized_sha256'] != prepared_report['normalizedSha256']:
                raise ValueError('Archived rows/counts/hash disagree with completion receipts')
            expected_origins = result['rows'] - result['counts'].get('quarantine', 0)
            process = subprocess.run(['node', '--env-file=' + cfg['env_file'], str(current_repo / 'tools/nearline/verify-import-origins.ts'), '--audit', str(outcomes), '--expected', str(expected_origins)], check=True, capture_output=True, text=True, timeout=600, cwd=current_repo)
            verification = json.loads(process.stdout)
            result.update(audit=item['audit'], prepared=item['prepared'], raw_object=digest, audit_sha256=sha256(outcomes), prepared_sha256=sha256(prepared), **verification)
            checks['chunks'][key] = result
            checks['updated_at'] = now()
            checks['verified_chunks'] = len(checks['chunks'])
            checks['verified_rows'] = sum(row['rows'] for row in checks['chunks'].values())
            write_json(destination, checks)
            processed += 1
            print(json.dumps({'chunk': key, 'rows': result['rows'], 'verifiedOrigins': verification['verifiedOrigins']}), flush=True)
    remote = pipeline.cfg['remote'].rstrip('/') + '/integration-v1/' + state['generation'] + '/reconciliation.json'
    pipeline.rclone('copyto', str(destination), remote)
    if pipeline.rclone('cat', remote, capture_output=True).stdout != destination.read_bytes():
        raise ValueError('Reconciliation report readback mismatch')
    print(json.dumps({'verified_chunks': len(checks['chunks']), 'verified_rows': checks.get('verified_rows', 0)}))


if __name__ == '__main__':
    main()
