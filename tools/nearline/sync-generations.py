#!/usr/bin/env python3
"""Bounded continuous generation import and explicit quarantine policy replay."""
import argparse
import copy
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
from integrate import integrate, needs_processing
from integration_catalog import catalog
from pipeline import Pipeline, now, write_json


def pending_chunks(plan, state, manifest, policy):
    return [(item['table'], index) for item in plan['tables'] if item['action'] == 'import_articles'
            and manifest['tables'][item['table']]['status'] == 'complete'
            for index, chunk in enumerate(manifest['tables'][item['table']]['chunks'])
            if needs_processing(state.get('completed', {}).get(item['table'] + '/' + chunk['sha256']), True, plan['mappingSha256'], policy)]


def synchronize(config, mode='sync'):
    root = Path(config['sync_state_dir'])
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (root / 'lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        status = {'status': 'running', 'mode': mode, 'started_at': now()}
        status_path = root / ('status-' + mode + '.json')
        write_json(status_path, status)
        active = subprocess.run(['systemctl', '--user', 'is-active', 'tag-backup.service'], capture_output=True, text=True).stdout.strip()
        if active in {'active', 'activating', 'reloading'} or shutil.disk_usage(root).free < 40 * 2**30:
            status.update(status='waiting_for_verified_backup' if active in {'active','activating','reloading'} else 'waiting_for_capacity', updated_at=now())
            write_json(status_path, status)
            return status
        baseline = json.loads(Path(config['baseline_plan']).read_text())
        pipeline = Pipeline(json.loads(Path(config['backup_config']).read_text()))
        listed = pipeline.rclone('lsf', pipeline.remote_path('generations'), '--dirs-only', capture_output=True).stdout.decode()
        generations = sorted(line.rstrip('/') for line in listed.splitlines())
        if any(not __import__('re').fullmatch(r'\d{8}T\d{6}Z-[a-f0-9]{8}', value) for value in generations):
            raise ValueError('Invalid generation inventory')
        generations = [baseline['generation']] if mode == 'replay' else [value for value in generations if value > baseline['generation']]
        policy = 'binary-equivalent-v1'
        try:
            repo = Path(__file__).resolve().parents[2]
            mapping_sha = hashlib.sha256((repo / 'app/data/legacy-media-mapping.json').read_bytes()).hexdigest()
            if mapping_sha != baseline['mappingSha256']:
                raise ValueError('Baseline mapping differs from installed code; explicit mapping review required')
            for generation in generations:
                manifest = pipeline.load_manifest(generation)
                plan = copy.deepcopy(baseline)
                if mode == 'replay':
                    directory = Path(config['baseline_state_dir'])
                    plan_path = root / 'replay-plan.json'
                else:
                    directory = root / 'generations' / generation
                    plan_path = directory / 'plan.json'
                    known = {row['table']: row for row in baseline['tables']}
                    plan.update(generation=generation, policy='Continuous reviewed generation import; conflicts remain quarantined')
                    plan['tables'] = [copy.deepcopy(known[table]) if table in known else {'table': table, 'media': None, 'action': 'nearline_only', 'reason': 'new_table_requires_explicit_mapping_review'} for table in manifest['tables']]
                    for item in plan['tables']:
                        if manifest['tables'][item['table']]['status'] in {'excluded','blocked'}:
                            item['action'] = 'source_gap'
                directory.mkdir(parents=True, exist_ok=True, mode=0o700)
                state_path = directory / 'state.json'
                state = json.loads(state_path.read_text()) if state_path.exists() else {'completed': {}}
                pending = pending_chunks(plan, state, manifest, policy)
                if not pending:
                    continue
                if mode == 'replay':
                    plan['tables'].sort(key=lambda item: (item['table'] != 'tag_news_2024', -sum(v.get('quarantine_reasons',{}).get('input_identity_collision',0) for v in state['completed'].values() if v['table']==item['table'])))
                write_json(plan_path, plan)
                cfg = {'code_root': str(repo), 'state_dir': str(directory), 'backup_config': config['backup_config'],
                       'plan': str(plan_path), 'env_file': config['env_file'], 'allow_recent': True,
                       'allow_source_versions': mode == 'sync', 'identity_policy': policy,
                       'max_run_seconds': config.get('max_run_seconds', 1200), 'max_chunks': config.get('max_chunks', 1), 'pause_seconds': 2}
                cfg_path = directory / ('continuous-' + mode + '.json')
                write_json(cfg_path, cfg)
                before = sum(v['counts'].get('quarantine',0) for v in state['completed'].values())
                integrate(cfg)
                subprocess.run(['python3', str(repo / 'tools/nearline/reconcile.py'), '--config', str(cfg_path), '--max-chunks', str(config.get('max_chunks',1))], check=True, timeout=1800, cwd=repo)
                after_state = json.loads(state_path.read_text())
                reconciliation = json.loads((directory / 'reconciliation.json').read_text())
                result = catalog(plan, manifest, after_state, reconciliation, True, identity_policy=policy)
                catalog_path = directory / 'continuous-catalog.json'
                write_json(catalog_path, result)
                after = sum(v['counts'].get('quarantine',0) for v in after_state['completed'].values())
                status.update(status='batch_complete', generation=generation, updated_at=now(),
                              remaining_chunks=len(pending_chunks(plan,after_state,manifest,policy)),
                              quarantine_before=before, quarantine_after=after,
                              catalog=str(catalog_path), current_summary=result['summary'])
                write_json(status_path,status)
                print(json.dumps(status),flush=True)
                return status
            status.update(status='caught_up' if mode=='sync' else 'replay_complete',updated_at=now(),generations=generations)
            write_json(status_path,status)
            return status
        except Exception:
            status.update(status='failed',updated_at=now(),error='Continuous integration failed; original packages and prior receipts preserved')
            write_json(status_path,status)
            raise


def main():
    os.umask(0o077)
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config',required=True)
    parser.add_argument('--mode',choices=['sync','replay'],default='sync')
    args=parser.parse_args()
    synchronize(json.loads(Path(args.config).read_text()),args.mode)


if __name__=='__main__':
    main()
