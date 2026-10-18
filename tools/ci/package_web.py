#!/usr/bin/env python3
"""Package the normal Next build; no install, build, credentials, or host actions."""
import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import subprocess
import tarfile
import tempfile


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(path):
    with open(path, 'rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def command(root, *args):
    return subprocess.check_output(args, cwd=root, text=True).strip()


def safe_name(name):
    p = PurePosixPath(name)
    require(name and not p.is_absolute() and str(p) == name and
            all(part not in ('', '.', '..') for part in p.parts) and
            '\\' not in name and not any(ord(c) < 32 for c in name), f'unsafe path: {name!r}')
    require(not any(part in ('.git', '.npmrc', '.netrc', '.ssh', '.cache', '__pycache__', '.npm', 'private', 'secrets') or
                    part.startswith('.env') for part in p.parts), f'private path: {name}')
    require('/.next/cache' not in '/' + name and
            not name.endswith(('.pem', '.key', '.p12', '.sqlite', '.db', '.log')), f'non-release path: {name}')
    return p


def inventory(root):
    """Never follow directory links; reject special files and unsafe/dangling links."""
    entries = []
    def walk(directory):
        for path in sorted(directory.iterdir()):
            name = path.relative_to(root).as_posix()
            safe_name(name)
            mode = path.lstat().st_mode
            require(not mode & 0o7000, f'special permissions: {name}')
            entry = {'path': name, 'mode': stat.S_IMODE(mode)}
            if stat.S_ISLNK(mode):
                target = os.readlink(path)
                require(target and not os.path.isabs(target) and '\\' not in target,
                        f'unsafe link: {name}')
                resolved = path.resolve(strict=True)
                require(resolved.is_relative_to(root.resolve()), f'escaping link: {name}')
                # Validate the resolved name too (a safe alias must not hide a private path).
                safe_name(resolved.relative_to(root.resolve()).as_posix())
                entry.update(type='symlink', target=target, size=len(os.fsencode(target)))
            elif stat.S_ISDIR(mode):
                entry.update(type='directory', size=0)
            else:
                require(stat.S_ISREG(mode), f'special file: {name}')
                entry.update(type='file', size=path.stat().st_size, sha256=digest(path))
            entries.append(entry)
            if entry['type'] == 'directory':
                walk(path)
    walk(root)
    return sorted(entries, key=lambda e: e['path'])


def validate_source(root, source, prefixes=None, names=()):
    resolved = source.resolve(strict=True)
    require(source.is_relative_to(root) and resolved.is_relative_to(root), f'input resolves outside checkout: {source}')
    for identity in (source.relative_to(root).as_posix(), resolved.relative_to(root).as_posix()):
        safe_name(identity)
        if prefixes is not None:
            require(identity.startswith(prefixes) or identity in names, f'unapproved input source: {identity}')
    return resolved


def copy_entry(source, target, source_root):
    """Validate every source before reading; merge by identity without overwriting."""
    validate_source(source_root, source)
    require(not any(p.is_symlink() for p in target.parents), f'link parent: {target}')
    target.parent.mkdir(parents=True, exist_ok=True)
    if source.is_symlink():
        link = os.readlink(source)
        require(not os.path.isabs(link), f'absolute source link: {source}')
        if target.is_symlink():
            require(os.readlink(target) == link, f'conflicting link: {target}')
        else:
            require(not target.exists(), f'conflicting path: {target}')
            target.symlink_to(link)
    elif source.is_dir():
        require(not target.is_symlink(), f'link directory: {target}')
        target.mkdir(exist_ok=True)
        for child in sorted(source.iterdir()):
            copy_entry(child, target / child.name, source_root)
        shutil.copymode(source, target)
    else:
        require(source.is_file(), f'missing/special input: {source}')
        if target.exists() or target.is_symlink():
            require(not target.is_symlink() and target.is_file() and digest(source) == digest(target),
                    f'conflicting file: {target}')
        else:
            shutil.copy2(source, target)


def external_inputs(root, tracked):
    """Conservative import closure, including type imports; NFT handles physical runtime reads.

    This is source evidence plus a small fallback closure, not a TypeScript bundler.
    Only tracked app/data and app/src relative imports are admitted.
    """
    pattern = re.compile(r'''(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s*)['"](\.[^'"\n]+)['"]''')
    pending = [root / name for name in sorted(tracked) if name.startswith('web/src/')]
    seen, external = set(), set()
    while pending:
        file = pending.pop()
        if file in seen or not file.is_file() or file.suffix not in ('.ts', '.tsx', '.mts', '.js', '.mjs'):
            continue
        validate_source(root, file)
        seen.add(file)
        for spec in pattern.findall(file.read_text()):
            base = Path(os.path.abspath(file.parent / spec))
            # Web-to-web imports are already covered by scanning every web source.
            if base.is_relative_to(root / 'web'):
                continue
            choices = [base] + [Path(str(base) + ext) for ext in ('.ts', '.tsx', '.mts', '.js', '.json')]
            if base.suffix in ('.js', '.mjs'):
                choices += [base.with_suffix('.ts'), base.with_suffix('.mts')]
            choices += [base / ('index' + ext) for ext in ('.ts', '.tsx', '.js')]
            resolved = next((p for p in choices if p.is_file()), None)
            require(resolved is not None and resolved.is_relative_to(root), f'unresolved external import: {file}: {spec}')
            name = resolved.relative_to(root).as_posix()
            actual = validate_source(root, resolved, prefixes=('app/data/', 'app/src/'))
            require(actual.relative_to(root).as_posix() in tracked, f'untracked resolved external input: {name}')
            require(name in tracked and name.startswith(('app/data/', 'app/src/')),
                    f'unapproved external input: {name}')
            external.add(name)
            pending.append(resolved)
    return sorted(external)


def assemble(root, stage, tracked):
    build = root / 'web/.next'
    runtime = stage / 'runtime'
    standalone = build / 'standalone'
    validate_source(root, standalone)
    inventory(standalone)
    copy_entry(standalone, runtime, root)
    # Deliberately assert this repository's monorepo layout; never silently flatten it.
    require((runtime / 'web/server.js').is_file(), 'expected standalone/web/server.js')
    copy_entry(build / 'static', runtime / 'web/.next/static', root)
    copy_entry(root / 'web/public', runtime / 'web/public', root)
    external = external_inputs(root, tracked)
    for name in external + ['web/assets/NotoSansTC-Share.woff']:
        require(name in tracked, f'untracked input: {name}')
        copy_entry(root / name, runtime / name, root)
    evidence = stage / 'evidence'
    evidence.mkdir()
    traces = sorted(p for p in build.rglob('*.nft.json') if not p.is_relative_to(standalone))
    require(traces and build / 'next-server.js.nft.json' in traces, 'missing server NFT evidence')
    mappings = []
    for trace in traces:
        validate_source(root, trace, prefixes=('web/.next/',))
        data = json.loads(trace.read_text())
        require(data.get('version') == 1 and isinstance(data.get('files'), list), f'invalid NFT: {trace}')
        for name in data['files']:
            require(isinstance(name, str) and not os.path.isabs(name) and '\\' not in name, 'unsafe NFT reference')
            source = Path(os.path.abspath(trace.parent / name))
            require(source.is_relative_to(root), f'NFT outside checkout: {name}')
            rel = source.relative_to(root).as_posix()
            # Next may already have dereferenced directory links while copying standalone.
            # Validate both source identities, not merely the archived alias.
            resolved = validate_source(root, source,
                            prefixes=('web/node_modules/', 'node_modules/', 'web/.next/', 'web/assets/'),
                            names=external + ['package.json', 'web/package.json'])
            require('/standalone/' not in rel and '/standalone/' not in resolved.relative_to(root).as_posix(),
                    'recursive standalone trace')
            copy_entry(source, runtime / rel, root)
            require(digest(source.resolve()) == digest((runtime / rel).resolve()), f'NFT bytes differ: {rel}')
            mappings.append({'trace': trace.relative_to(root).as_posix(), 'input': name, 'runtime': rel,
                             'sha256': digest(source.resolve())})
    validate_source(root, build / 'required-server-files.json', prefixes=('web/.next/',))
    required = json.loads((build / 'required-server-files.json').read_text())
    require(required.get('version') == 1, 'unsupported required-server-files')
    for name in required['files']:
        safe_name(name)
        require(name.startswith('.next/'), f'unapproved required file: {name}')
        validate_source(root, root / 'web' / name, prefixes=('web/.next/',))
        copy_entry(root / 'web' / name, runtime / 'web' / name, root)
    # Keep every build manifest/NFT, but no cache, prerender data, or dependencies in evidence.
    for source in sorted(build.rglob('*')):
        rel = source.relative_to(build)
        if rel.parts[0] in ('standalone', 'cache', 'static'):
            continue
        if source.is_file() and (source.name.endswith('.nft.json') or 'manifest' in source.name or source.name == 'required-server-files.json'):
            copy_entry(source, evidence / 'build' / rel, root)
    source_names = ['package.json', 'package-lock.json', 'web/package.json', 'web/package-lock.json',
                    'web/next.config.ts', '.github/workflows/ci.yml', 'tools/ci/package_web.py']
    for name in source_names:
        copy_entry(root / name, evidence / 'source' / name, root)
    (evidence / 'nft-mappings.json').write_text(json.dumps(mappings, indent=2) + '\n')
    inputs = [{'path': name, 'sha256': digest(root / name),
               'delivery': 'conservative source closure; may also be compiled into chunks'} for name in external]
    (evidence / 'external-inputs.json').write_text(json.dumps(inputs, indent=2) + '\n')
    # Allow only generated server files/dependencies and explicitly identified public source inputs.
    for entry in inventory(runtime):
        if entry['type'] == 'directory':
            continue
        name = entry['path']
        require(name.startswith(('node_modules/', 'web/node_modules/', 'web/.next/', 'web/public/')) or
                name in external or name in ('package.json', 'web/package.json', 'web/server.js',
                                            'web/assets/NotoSansTC-Share.woff'), f'unexpected runtime source: {name}')
    validate_source(root, build / 'BUILD_ID', prefixes=('web/.next/',))
    return {'nftFiles': len(traces), 'nftReferences': len(mappings), 'externalInputs': inputs,
            'buildId': (build / 'BUILD_ID').read_text().strip(), 'server': 'runtime/web/server.js',
            'cwd': 'runtime/web'}


def write_archive(stage, archive, entries):
    with open(archive, 'xb') as raw, gzip.GzipFile(filename='', mode='wb', fileobj=raw, mtime=0) as zipped:
        with tarfile.open(fileobj=zipped, mode='w', format=tarfile.PAX_FORMAT) as tar:
            for entry in entries:
                info = tarfile.TarInfo(entry['path'])
                info.mode = entry['mode']
                if entry['type'] == 'directory':
                    info.type = tarfile.DIRTYPE
                elif entry['type'] == 'symlink':
                    info.type, info.linkname = tarfile.SYMTYPE, entry['target']
                else:
                    info.size = entry['size']
                if entry['type'] == 'file':
                    with open(stage / entry['path'], 'rb') as stream:
                        tar.addfile(info, stream)
                else:
                    tar.addfile(info)


def verify_archive(archive, entries, destination):
    """Validate every tar member before any extraction, then rehash the extracted tree."""
    expected = {e['path']: e for e in entries}
    require(len(expected) == len(entries), 'duplicate inventory path')
    seen = set()
    with tarfile.open(archive, 'r:gz') as tar:
        members = tar.getmembers()
        links = {e['path'] for e in entries if e['type'] == 'symlink'}
        for member in members:
            name = member.name
            safe_name(name)
            require(name not in seen and name in expected, f'duplicate/undeclared member: {name}')
            seen.add(name)
            require(not any(str(p) in links for p in PurePosixPath(name).parents), f'link parent: {name}')
            entry = expected[name]
            kind = 'directory' if member.isdir() else 'symlink' if member.issym() else 'file' if member.isfile() else 'special'
            require(kind == entry['type'] and member.mode == entry['mode'], f'type/mode mismatch: {name}')
            if kind == 'file':
                require(member.size == entry['size'] and hashlib.file_digest(tar.extractfile(member), 'sha256').hexdigest() == entry['sha256'],
                        f'file mismatch: {name}')
            elif kind == 'symlink':
                require(member.linkname == entry['target'] and not os.path.isabs(member.linkname), f'link mismatch: {name}')
        require(seen == expected.keys(), 'missing archive members')
        # Validated paths/types/parents; data filter would rewrite permissions we need to verify.
        tar.extractall(destination, members=members, filter='fully_trusted')
    require(inventory(destination) == entries, 'extracted inventory differs')


def provenance(root):
    require(not command(root, 'git', 'status', '--porcelain', '--untracked-files=no'), 'tracked source must be clean')
    commit = command(root, 'git', 'rev-parse', 'HEAD')
    require(commit == os.environ.get('GITHUB_SHA'), 'checkout differs from event SHA')
    node = json.loads(command(root, 'node', '-e', '''console.log(JSON.stringify({version:process.version,execPath:process.execPath,
        platform:process.platform,arch:process.arch,versions:process.versions,glibc:process.report.getReport().header.glibcVersionRuntime}))'''))
    require(node['version'] == 'v24.15.0' and node['platform'] == 'linux' and node['arch'] == 'x64', 'unsupported build profile')
    node['binarySha256'] = digest(node.pop('execPath'))
    event = json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
    pr = event.get('pull_request')
    return {'repository': os.environ['GITHUB_REPOSITORY'], 'commit': commit,
            'tree': command(root, 'git', 'rev-parse', 'HEAD^{tree}'),
            'event': os.environ['GITHUB_EVENT_NAME'], 'ref': os.environ['GITHUB_REF'],
            'workflowRef': os.environ['GITHUB_WORKFLOW_REF'], 'workflowSha': os.environ['GITHUB_WORKFLOW_SHA'],
            'runId': os.environ['GITHUB_RUN_ID'], 'runAttempt': os.environ['GITHUB_RUN_ATTEMPT'],
            'pullRequest': {'head': pr['head']['sha'], 'base': pr['base']['sha']} if pr else None,
            'node': node, 'runner': {key: os.environ.get(key) for key in ('RUNNER_OS', 'RUNNER_ARCH', 'ImageOS', 'ImageVersion')},
            'osRelease': Path('/etc/os-release').read_text(), 'libc': command(root, 'ldd', '--version'),
            'profile': 'ubuntu-24.04-linux-x64-node24.15.0',
            'buildEnv': {'TAG_API_ORIGIN': 'http://127.0.0.1:1', 'NEXT_TELEMETRY_DISABLED': '1'},
            'packages': {name: json.loads((root / 'web/node_modules' / name / 'package.json').read_text())['version']
                         for name in ('next', 'react', 'react-dom')}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--output', type=Path, default=Path('artifacts/web-candidate'))
    args = parser.parse_args()
    root = args.root.resolve()
    output = args.output.resolve()
    require(not output.exists(), 'output must not exist')
    source = provenance(root)
    output.mkdir(parents=True)
    tracked = set(command(root, 'git', 'ls-files').splitlines())
    with tempfile.TemporaryDirectory() as directory:
        stage = Path(directory) / 'stage'
        stage.mkdir()
        layout = assemble(root, stage, tracked)
        entries = inventory(stage)
        archive = output / 'web-standalone.tar.gz'
        write_archive(stage, archive, entries)
        verify_archive(archive, entries, Path(directory) / 'extracted')
    candidate = source['event'] == 'push' and source['ref'] == 'refs/heads/main'
    manifest = {'schema': 'tag-web-ci-candidate/v1', 'source': source, 'layout': layout,
                'mainPushCandidate': candidate, 'validation': 'packaged and extraction rehashed; full CI and host acceptance required',
                'nativeFiles': [e['path'] for e in entries if e['path'].endswith(('.node', '.so')) or '.so.' in e['path']],
                'files': entries, 'archive': {'name': archive.name, 'sha256': digest(archive), 'bytes': archive.stat().st_size}}
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({'commit': source['commit'], 'mainPushCandidate': candidate, 'files': len(entries),
                      'archive': manifest['archive'], 'nftFiles': layout['nftFiles']}))


if __name__ == '__main__':
    main()
