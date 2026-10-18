"""Exercise release boundaries with a small synthetic monorepo, without Next or npm."""
import io
import json
import os
import shutil
from pathlib import Path
import tarfile
import tempfile
import unittest

import package_web as pack


class PackageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.root = self.base / 'source'
        self.root.mkdir()
        self.stage = self.base / 'stage'
        self.stage.mkdir()
        self.tracked = set()
        for name in ('package.json', 'package-lock.json', 'web/package.json', 'web/package-lock.json',
                     'web/next.config.ts', '.github/workflows/ci.yml', 'tools/ci/package_web.py'):
            self.put(name, '{}', tracked=True)
        self.put('web/src/page.ts', "export { label } from '../../app/src/label';", tracked=True)
        self.put('app/src/label.ts', "import data from '../data/label.json'; export const label = data;", tracked=True)
        self.put('app/data/label.json', '{"label":"public"}', tracked=True)
        self.put('web/assets/NotoSansTC-Share.woff', 'font', tracked=True)
        self.put('web/.next/standalone/web/server.js', '// server')
        self.put('web/.next/standalone/node_modules/shared/index.js', '// root dependency')
        self.put('web/.next/standalone/web/node_modules/dep/index.js', '// dep')
        self.put('web/node_modules/dep/index.js', '// dep')
        self.put('web/.next/standalone/web/.next/BUILD_ID', 'build-id')
        self.put('web/.next/BUILD_ID', 'build-id')
        self.put('web/.next/routes-manifest.json', '{}')
        self.put('web/.next/server/middleware-build-manifest.js', '// manifest')
        self.put('web/.next/required-server-files.json', json.dumps({'version': 1, 'files': ['.next/routes-manifest.json']}))
        self.put('web/.next/next-server.js.nft.json', json.dumps({'version': 1, 'files': ['../node_modules/dep/index.js']}))
        self.put('web/.next/static/chunk.js', '// chunk')
        self.put('web/public/favicons/icon.png', 'png', tracked=True)
        self.put('web/.next/standalone/web/public/favicons/icon.png', 'png')
        self.put('web/.next/cache/not-for-release', 'cache')

    def put(self, name, data, tracked=False):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(data)
        if tracked:
            self.tracked.add(name)
        return path

    def assemble(self):
        return pack.assemble(self.root, self.stage, self.tracked)

    def test_complete_layout_and_roundtrip(self):
        target = self.root / 'web/.next/standalone/web/node_modules/dep/alias.js'
        target.symlink_to('index.js')
        os.chmod(target.parent / 'index.js', 0o755)
        result = self.assemble()
        self.assertEqual(result['buildId'], 'build-id')
        for name in ('runtime/node_modules/shared/index.js', 'runtime/app/src/label.ts',
                     'runtime/app/data/label.json', 'runtime/web/assets/NotoSansTC-Share.woff',
                     'runtime/web/public/favicons/icon.png', 'runtime/web/.next/static/chunk.js',
                     'evidence/build/required-server-files.json', 'evidence/build/next-server.js.nft.json',
                     'evidence/build/server/middleware-build-manifest.js'):
            self.assertTrue((self.stage / name).is_file(), name)
        self.assertFalse((self.stage / 'runtime/web/public/public').exists())
        self.assertFalse((self.stage / 'runtime/web/.next/cache').exists())
        entries = pack.inventory(self.stage)
        archive = self.base / 'candidate.tar.gz'
        pack.write_archive(self.stage, archive, entries)
        destination = self.base / 'extracted'
        pack.verify_archive(archive, entries, destination)
        self.assertEqual(os.readlink(destination / 'runtime/web/node_modules/dep/alias.js'), 'index.js')
        self.assertEqual((destination / 'runtime/web/node_modules/dep/index.js').stat().st_mode & 0o777, 0o755)

    def test_nft_escape_missing_conflict_and_private(self):
        for reference in ('/etc/passwd', '../../../../outside', '../node_modules/missing.js',
                          '../node_modules/dep/.env', '../node_modules/dep/different.js'):
            with self.subTest(reference=reference):
                shutil.rmtree(self.stage)
                self.stage.mkdir()
                self.put('web/.next/next-server.js.nft.json', json.dumps({'version': 1, 'files': [reference]}))
                self.put('web/node_modules/dep/.env', 'secret')
                self.put('web/node_modules/dep/different.js', 'new')
                self.put('web/.next/standalone/web/node_modules/dep/different.js', 'old')
                with self.assertRaises((ValueError, FileNotFoundError)):
                    self.assemble()

    def test_unsafe_standalone_entries(self):
        for kind in ('env', 'cache', 'absolute', 'escape', 'dangling', 'fifo', 'private-source'):
            with self.subTest(kind=kind):
                path = self.root / 'web/.next/standalone/web/bad'
                if kind == 'env':
                    path = self.put('web/.next/standalone/web/.env.production', 'secret')
                elif kind == 'cache':
                    path = self.put('web/.next/standalone/web/.next/cache/data', 'cache')
                elif kind == 'private-source':
                    path = self.put('web/.next/standalone/web/src/private.ts', 'private source')
                elif kind == 'fifo':
                    os.mkfifo(path)
                else:
                    path.symlink_to({'absolute': '/etc/passwd', 'escape': '../../../../package.json',
                                     'dangling': 'missing'}[kind])
                with self.assertRaises((ValueError, FileNotFoundError)):
                    self.assemble()
                path.unlink()
                # A rejected cache directory itself must also be removed.
                cache = self.root / 'web/.next/standalone/web/.next/cache'
                if cache.exists():
                    cache.rmdir()

    def test_nft_directory_links_cannot_hide_private_or_outside_bytes(self):
        dependency = self.root / 'web/node_modules/dep'
        shutil.rmtree(dependency)
        for location in (self.root / '.env.credentials', self.base / 'outside'):
            with self.subTest(location=location):
                shutil.rmtree(self.stage)
                self.stage.mkdir()
                location.mkdir()
                (location / 'index.js').write_text('// dep')
                dependency.symlink_to(os.path.relpath(location, dependency.parent))
                # The standalone alias already contains identical bytes: only source
                # identity validation can detect what Next dereferenced during build.
                with self.assertRaisesRegex(ValueError, 'private path|resolves outside'):
                    self.assemble()
                dependency.unlink()

    def test_untracked_external_input(self):
        self.tracked.remove('app/data/label.json')
        with self.assertRaisesRegex(ValueError, 'unapproved external'):
            self.assemble()

    def test_reject_malicious_tar_before_extraction(self):
        self.assemble()
        entries = pack.inventory(self.stage)
        regular = next(e for e in entries if e['type'] == 'file')
        for mutation in ('traversal', 'absolute', 'duplicate', 'special', 'hardlink', 'mode', 'bytes', 'undeclared'):
            with self.subTest(mutation=mutation):
                archive = self.base / (mutation + '.tar.gz')
                with tarfile.open(archive, 'w:gz') as tar:
                    info = tarfile.TarInfo(regular['path'])
                    info.mode = regular['mode']
                    if mutation == 'traversal':
                        info.name = '../escape'
                    elif mutation == 'absolute':
                        info.name = '/escape'
                    elif mutation == 'undeclared':
                        info.name = 'runtime/extra'
                    elif mutation == 'special':
                        info.type = tarfile.FIFOTYPE
                    elif mutation == 'hardlink':
                        info.type, info.linkname = tarfile.LNKTYPE, regular['path']
                    elif mutation == 'mode':
                        info.mode = 0o7777
                    payload = b'x' if mutation == 'bytes' else (self.stage / regular['path']).read_bytes()
                    info.size = len(payload) if info.isfile() else 0
                    tar.addfile(info, io.BytesIO(payload) if info.isfile() else None)
                    if mutation == 'duplicate':
                        tar.addfile(info, io.BytesIO(payload))
                destination = self.base / ('extract-' + mutation)
                with self.assertRaises(ValueError):
                    pack.verify_archive(archive, entries, destination)
                self.assertFalse(destination.exists())


if __name__ == '__main__':
    unittest.main()
