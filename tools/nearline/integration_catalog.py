#!/usr/bin/env python3
"""Build a per-table evidence catalog without treating quarantines as imports."""
import argparse
from collections import Counter
import json
import os
from pathlib import Path
import uuid

from integrate import archive_directory, needs_processing
from pipeline import Pipeline, now, write_json


def catalog(plan, manifest, state, reconciliation, allow_recent):
    generation = plan['generation']
    if any(item.get('generation') != generation for item in [manifest, state, reconciliation]):
        raise ValueError('Catalog inputs belong to different generations')
    planned = {item['table']: item for item in plan['tables']}
    if len(planned) != len(plan['tables']) or set(planned) != set(manifest['tables']):
        raise ValueError('Plan does not account for exactly every source table')
    tables = []
    expected_keys = set()
    for name, item in planned.items():
        source = manifest['tables'][name]
        chunks = source.get('chunks', [])
        article = item['action'] == 'import_articles'
        counts, reasons = Counter(), Counter()
        processed = verified = pending_replays = rows = 0
        evidence = []
        for index, chunk in enumerate(chunks):
            if not article:
                continue
            key = name + '/' + chunk['sha256']
            expected_keys.add(key)
            receipt = state.get('completed', {}).get(key)
            if receipt is None:
                continue
            if (receipt.get('table'), receipt.get('chunk'), receipt.get('object')) != (name, index, chunk['sha256']):
                raise ValueError('Receipt references a different source chunk: ' + key)
            if sum(receipt['counts'].values()) != receipt['rows']:
                raise ValueError('Receipt row accounting mismatch: ' + key)
            replay = needs_processing(receipt, allow_recent, plan.get('mappingSha256'))
            check = reconciliation.get('chunks', {}).get(key, {})
            checked = check.get('audit') == receipt['audit']
            if checked and any(check.get(field) != value for field, value in [
                ('rows', receipt['rows']), ('counts', receipt['counts']),
                ('raw_object', chunk['sha256']), ('prepared', receipt['prepared']),
                ('verifiedOrigins', receipt['rows'] - receipt['counts'].get('quarantine', 0)),
            ]):
                raise ValueError('Matching reconciliation has inconsistent evidence: ' + key)
            processed += 1
            verified += int(checked)
            pending_replays += int(replay)
            rows += receipt['rows']
            counts.update(receipt['counts'])
            recorded = receipt.get('quarantine_reasons') or (check.get('quarantine_reasons', {}) if checked else {})
            reasons.update(recorded)
            missing = receipt['counts'].get('quarantine', 0) - sum(recorded.values())
            if missing < 0:
                raise ValueError('Quarantine reasons exceed rows: ' + key)
            if missing:
                reasons['reason_breakdown_not_yet_verified'] += missing
            evidence.append({'chunk': index, 'raw_sha256': chunk['sha256'], 'rows': receipt['rows'],
                             'audit': receipt['audit'], 'prepared': receipt['prepared'],
                             'independently_verified': checked, 'policy_replay_pending': replay})
        raw_complete = source['status'] == 'complete' and bool(source.get('schema'))
        processing_complete = article and raw_complete and processed == len(chunks) and pending_replays == 0
        tables.append({
            'table': name, 'action': item['action'], 'classification_reason': item['reason'],
            'source_status': source['status'], 'source_error': source.get('error'),
            'raw_backup_complete': raw_complete, 'source_estimated_rows': source.get('estimated_rows'),
            'raw_chunks': len(chunks), 'compressed_bytes': sum(c['bytes'] for c in chunks),
            'raw_sql_bytes': sum(c['raw_bytes'] for c in chunks),
            'processed_chunks': processed, 'independently_verified_chunks': verified,
            'pending_policy_replays': pending_replays, 'rows_accounted_for': rows,
            'counts': dict(counts), 'quarantine_reasons': dict(reasons),
            'successful_origins': sum(counts.get(k, 0) for k in ['inserted', 'linked_existing', 'already_imported']),
            'article_processing_complete': processing_complete,
            'article_integration_verified': processing_complete and verified == len(chunks),
            'evidence': evidence,
        })
    unexpected = set(state.get('completed', {})) - expected_keys
    if unexpected:
        raise ValueError('Completion receipts outside the planned article objects: ' + ', '.join(sorted(unexpected)))
    articles = [t for t in tables if t['action'] == 'import_articles']
    gaps = [t['table'] for t in tables if t['action'] == 'source_gap']
    return {
        'version': 1, 'observed_at': now(), 'generation': generation,
        'mapping_sha256': plan.get('mappingSha256'), 'source_consistency': manifest.get('consistency'),
        'source_manifest_updated_at': manifest.get('updated_at'), 'import_updated_at': state.get('updated_at'),
        'reconciliation_updated_at': reconciliation.get('updated_at'),
        'scope': 'Point-in-time catalog of NAS source manifest and per-chunk import/reconciliation receipts. '
                 'Successful origins include existing articles; quarantines are preserved but not imported. '
                 'A post-integration site database backup remains a separate required verification.',
        'summary': {
            'tables': len(tables), 'actions': dict(Counter(t['action'] for t in tables)),
            'raw_complete_tables': sum(t['raw_backup_complete'] for t in tables),
            'raw_pending_tables': [t['table'] for t in tables if not t['raw_backup_complete'] and t['action'] != 'source_gap'],
            'declared_source_gaps': gaps,
            'article_tables': len(articles),
            'article_tables_verified': sum(t['article_integration_verified'] for t in articles),
            'all_article_tables_verified': bool(articles) and all(t['article_integration_verified'] for t in articles),
            'rows_accounted_for': sum(t['rows_accounted_for'] for t in articles),
            'successful_origins': sum(t['successful_origins'] for t in articles),
            'quarantined_rows': sum(t['counts'].get('quarantine', 0) for t in articles),
        },
        'tables': tables,
    }


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--archive', action='store_true')
    args = parser.parse_args()
    config = json.loads(Path(args.config).read_text())
    root = Path(config['state_dir'])
    plan = json.loads(Path(config['plan']).read_text())
    pipeline = Pipeline(json.loads(Path(config['backup_config']).read_text()))
    manifest = pipeline.load_manifest(plan['generation'])
    state = json.loads((root / 'state.json').read_text())
    reconciliation = json.loads((root / 'reconciliation.json').read_text())
    result = catalog(plan, manifest, state, reconciliation, config.get('allow_recent', False))
    output = Path(args.out)
    output.mkdir(parents=True, exist_ok=False)
    write_json(output / 'catalog.json', result)
    if args.archive:
        remote = pipeline.cfg['remote'].rstrip('/') + '/integration-v1/' + plan['generation'] + '/catalogs/' + uuid.uuid4().hex
        result['publication'] = archive_directory(pipeline, output, remote)
    print(json.dumps({'summary': result['summary'], 'output': str(output), 'publication': result.get('publication')}, ensure_ascii=False))


if __name__ == '__main__':
    main()
