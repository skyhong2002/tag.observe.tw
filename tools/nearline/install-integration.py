#!/usr/bin/env python3
"""Install an immutable one-off integration worker without redeploying the website."""
import argparse
import hashlib
import json
from pathlib import Path
import shlex
import shutil
import subprocess
import tarfile
import urllib.request

from integrate import archive_directory
from pipeline import Pipeline


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for option in ['plan', 'state-dir', 'backup-config', 'env-file']:
        parser.add_argument('--' + option, required=True)
    parser.add_argument('--start', action='store_true')
    parser.add_argument('--allow-recent', action=argparse.BooleanOptionalAction, default=None)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[2]
    root = Path.home() / '.local/share/tag-legacy-import'
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    files = []
    for directory in ['app/src', 'app/data', 'tools/nearline', 'runtime']:
        files.extend(p for p in (repo / directory).rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix != '.pyc')
    files += [repo / 'package.json', repo / 'package-lock.json']
    digests = {str(p.relative_to(repo)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(files) if p.exists()}
    version = hashlib.sha256(json.dumps(digests, sort_keys=True).encode()).hexdigest()[:20]
    code = root / 'releases' / version
    if not code.exists():
        pending = code.with_suffix('.partial')
        pending.mkdir(parents=True, exist_ok=True)
        for name in digests:
            target = pending / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(repo / name, target)
            if hashlib.sha256(target.read_bytes()).hexdigest() != digests[name]:
                raise RuntimeError('Repository changed while copying: ' + name)
        (pending / 'node_modules').symlink_to(repo / 'node_modules', target_is_directory=True)
        (pending / 'snapshot-manifest.json').write_text(json.dumps(digests, indent=2) + '\n')
        pending.rename(code)
    previous_config = json.loads((root / 'config.json').read_text()) if (root / 'config.json').exists() else {}
    allow_recent = previous_config.get('allow_recent', False) if args.allow_recent is None else args.allow_recent
    if allow_recent:
        with urllib.request.urlopen('http://127.0.0.1:18133/health', timeout=3) as response:
            if json.load(response).get('legacyOwnershipPolicy') != 'own-indexed-v2':
                raise RuntimeError('Running worker does not support recent legacy imports')
    config = {'code_root': str(code), 'state_dir': str(Path(args.state_dir).resolve()),
              'backup_config': str(Path(args.backup_config).resolve()), 'plan': str(Path(args.plan).resolve()),
              'env_file': str(Path(args.env_file).resolve()), 'max_run_seconds': 1800, 'pause_seconds': 2, 'allow_recent': allow_recent}
    # Preserve the exact executable code and mapping before activating it.
    # Credentials are referenced by path and are never copied into this bundle.
    control = root / 'controls' / version
    control.mkdir(parents=True, exist_ok=True, mode=0o700)
    shutil.copyfile(args.plan, control / 'table-catalog.json')
    bundle = control / 'code-snapshot.tar.gz'
    if not bundle.exists():
        partial = bundle.with_suffix('.partial')
        with tarfile.open(partial, 'w:gz') as archive:
            for name in digests:
                archive.add(code / name, arcname=name)
            archive.add(code / 'snapshot-manifest.json', arcname='snapshot-manifest.json')
        partial.replace(bundle)
    pipeline = Pipeline(json.loads(Path(args.backup_config).read_text()))
    plan = json.loads(Path(args.plan).read_text())
    remote = pipeline.cfg['remote'].rstrip('/') + '/integration-v1/' + plan['generation'] + '/control/' + version
    archive_directory(pipeline, control, remote)
    temporary = root / 'config.tmp'
    temporary.write_text(json.dumps(config, indent=2) + '\n')
    temporary.chmod(0o600)
    temporary.replace(root / 'config.json')
    run = root / 'run.sh'
    run.write_text('#!/bin/sh\nset -eu\nexec /usr/bin/python3 ' + shlex.quote(str(code / 'tools/nearline/integrate.py')) + ' --config ' + shlex.quote(str(root / 'config.json')) + '\n')
    run.chmod(0o700)
    reconcile = root / 'reconcile.sh'
    reconcile.write_text('#!/bin/sh\nset -eu\nexec /usr/bin/python3 ' + shlex.quote(str(code / 'tools/nearline/reconcile.py')) + ' --config ' + shlex.quote(str(root / 'config.json')) + ' --max-chunks 4\n')
    reconcile.chmod(0o700)
    units = Path.home() / '.config/systemd/user'
    units.mkdir(parents=True, exist_ok=True)
    for name in ['tag-legacy-import.service', 'tag-legacy-import.timer', 'tag-legacy-reconcile.service', 'tag-legacy-reconcile.timer']:
        shutil.copyfile(repo / 'runtime' / name, units / name)
    subprocess.run(['systemctl', '--user', 'daemon-reload'], check=True)
    if args.start:
        subprocess.run(['systemctl', '--user', 'enable', '--now', 'tag-legacy-import.timer', 'tag-legacy-reconcile.timer'], check=True)
        subprocess.run(['systemctl', '--user', 'start', '--no-block', 'tag-legacy-import.service', 'tag-legacy-reconcile.service'], check=True)
    print(json.dumps({'version': version, 'code_root': str(code), 'files': len(digests), 'started': args.start}))


if __name__ == '__main__':
    main()
