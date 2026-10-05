#!/usr/bin/env python3
"""Read-only progress for the fixed-generation one-time integration."""
import argparse
import json
from pathlib import Path

from integrate import needs_processing


def status(config):
    root = Path(config['state_dir'])
    state = json.loads((root / 'state.json').read_text())
    plan = json.loads(Path(config['plan']).read_text())
    backup_config = json.loads(Path(config['backup_config']).read_text())
    backup = json.loads((Path(backup_config['state_dir']) / 'state.json').read_text())
    same_generation = backup['generation'] == plan['generation']
    completed = state.get('completed', {})
    pending_replays = {key for key, result in completed.items()
                       if needs_processing(result, config.get('allow_recent', False), plan.get('mappingSha256'))}
    reconciliation_path = root / 'reconciliation.json'
    reconciliation = json.loads(reconciliation_path.read_text()) if reconciliation_path.exists() else {}
    reconciled = reconciliation.get('chunks', {}) if reconciliation.get('generation') == state['generation'] else {}
    current_verified = {key: result for key, result in completed.items()
                        if reconciled.get(key, {}).get('audit') == result['audit']}
    counts = {}
    reasons = {}
    for result in completed.values():
        for action, n in result['counts'].items():
            counts[action] = counts.get(action, 0) + n
        recorded = result.get('quarantine_reasons', {})
        for reason, n in recorded.items():
            reasons[reason] = reasons.get(reason, 0) + n
        missing = result['counts'].get('quarantine', 0) - sum(recorded.values())
        if missing:
            reasons['see_original_audit'] = reasons.get('see_original_audit', 0) + missing
    targets = [t for t in plan['tables'] if t['action'] == 'import_articles']
    completed_tables = []
    available_chunks = None
    waiting_tables = None
    if same_generation:
        available_chunks = sum(len(backup['tables'][t['table']]['chunks']) for t in targets)
        waiting_tables = [t['table'] for t in targets if backup['tables'][t['table']]['status'] != 'complete']
        for t in targets:
            table = backup['tables'][t['table']]
            if table['status'] == 'complete' and all(t['table'] + '/' + chunk['sha256'] in completed and t['table'] + '/' + chunk['sha256'] not in pending_replays for chunk in table['chunks']):
                completed_tables.append(t['table'])
    return {'generation': state['generation'], 'status': state['status'], 'verified_chunks': len(completed),
            'independently_verified_current_chunks': len(current_verified),
            'independently_verified_current_rows': sum(result['rows'] for result in current_verified.values()),
            'reprocessing_pending_chunks': len(pending_replays),
            'available_article_chunks': available_chunks, 'article_tables': len(targets), 'completed_tables': completed_tables,
            'rows_accounted_for': sum(result['rows'] for result in completed.values()), 'counts': counts,
            'recent_rows_pending': reasons.get('recent_requires_separate_review', 0),
            'successful_origins': sum(counts.get(k, 0) for k in ['inserted', 'linked_existing', 'already_imported']),
            'quarantine_reasons': reasons, 'current': state.get('current'), 'waiting_for_backup': waiting_tables,
            'last_error': state.get('last_error'), 'updated_at': state.get('updated_at'),
            'note': 'Only NAS-verified completed chunks counted. Current in-flight transactions may be ahead. Quarantined rows remain archived, not imported.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True)
    args = parser.parse_args()
    print(json.dumps(status(json.loads(Path(args.config).read_text())), ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
