#!/usr/bin/env python3
"""Refresh every retained generation plus live content archive metadata."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
from pipeline import Pipeline, now, write_json
from query_index import build_index


def refresh(config):
    root = Path(config['index']).parent
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (root / 'refresh.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        status = {'startedAt': now(), 'status': 'running'}
        destination = root / 'refresh-status.json'
        write_json(destination, status)
        try:
            pipeline = Pipeline(json.loads(Path(config['backup_config']).read_text()))
            listed = pipeline.rclone('lsf', pipeline.remote_path('generations'), '--dirs-only', capture_output=True).stdout.decode()
            generations = sorted(s.rstrip('/') for s in listed.splitlines())
            if not generations or any(not re.fullmatch(r'\d{8}T\d{6}Z-[a-f0-9]{8}', s) for s in generations):
                raise ValueError('Invalid or empty generation inventory')
            manifests, catalogs = [], []
            with tempfile.TemporaryDirectory(prefix='refresh-', dir=root) as tmp:
                work = Path(tmp)
                for generation in generations:
                    target = work / (generation + '.json')
                    write_json(target, pipeline.load_manifest(generation))
                    manifests.append(target)
                selected = {}
                paths = [Path(path) for path in config.get('catalogs', [])]
                for directory in config.get('catalog_roots', []):
                    paths.extend(Path(directory).rglob('continuous-catalog.json'))
                for path in paths:
                    if Path(path).is_file() and json.loads(Path(path).read_text())['generation'] in generations:
                        generation = json.loads(Path(path).read_text())['generation']
                        if generation not in selected or path.stat().st_mtime > selected[generation].stat().st_mtime:
                            selected[generation] = path
                catalogs = list(selected.values())
                snapshot = work / 'site.jsonl'
                subprocess.run(['node', '--env-file=' + config['env_file'], str(Path(__file__).with_name('export-query-index.ts')), '--out', str(snapshot)],
                               check=True, capture_output=True, timeout=600, cwd=Path(__file__).resolve().parents[2])
                # build_index atomically replaces only a completely verified index.
                metadata = build_index(config['index'], manifests, catalogs, snapshot)
                status.update(status='complete', finishedAt=now(), generations=generations,
                              indexRevision=metadata['revision'], counts=metadata['counts'])
                write_json(destination, status)
                print(json.dumps(status), flush=True)
        except Exception:
            status.update(status='failed', finishedAt=now(), error='Index refresh failed; previous index retained')
            write_json(destination, status)
            raise


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True)
    args = parser.parse_args()
    refresh(json.loads(Path(args.config).read_text()))


if __name__ == '__main__':
    main()
