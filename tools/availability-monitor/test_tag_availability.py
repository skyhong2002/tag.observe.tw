import errno
import importlib.util
import json
import os
from pathlib import Path
import pwd
import shutil
import stat
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('tag_availability', Path(__file__).with_name('tag_availability.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

HOME = Path(pwd.getpwuid(os.getuid()).pw_dir)


def ok_probe(name, _url):
    row = module.empty_row(name)
    row.update(http_status=200, elapsed_seconds=0.01, bytes=10, result='ok', response_complete=True)
    return row


class StatePathTests(unittest.TestCase):
    def test_state_lives_under_the_accounts_real_home(self):
        self.assertEqual(module.STATE, HOME / '.local' / 'state' / 'tag-availability-monitor')
        self.assertNotIn('deck', module.STATE.parts)


class StoreTraversalTests(unittest.TestCase):
    """Store only accepts /home paths, so fixtures live in a private directory under the real home."""

    def setUp(self):
        if not HOME.is_relative_to('/home') or HOME.is_symlink():
            self.skipTest('requires a real home directory under /home')
        self.base = Path(tempfile.mkdtemp(prefix='.tag-availability-test-', dir=HOME))
        self.real = self.base / 'real'
        self.real.mkdir()
        self.alias = self.base / 'alias'
        self.alias.symlink_to(self.real)

    def tearDown(self):
        shutil.rmtree(self.base)

    def test_intermediate_symlink_is_still_refused(self):
        # The original failure: a legacy alias in the middle of the configured path.
        with self.assertRaises(OSError) as raised:
            module.Store(self.alias / 'state')
        self.assertIn(raised.exception.errno, (errno.ENOTDIR, errno.ELOOP))
        self.assertFalse((self.real / 'state').exists())

    def test_real_directory_path_writes_fresh_bounded_state(self):
        store = module.Store(self.real / 'state')
        try:
            store.write(module.collect(run_probe=ok_probe))
        finally:
            store.close()
        state = self.real / 'state'
        self.assertEqual(stat.S_IMODE(state.stat().st_mode), 0o700)
        latest = state / 'latest.json'
        self.assertEqual(stat.S_IMODE(latest.stat().st_mode), 0o600)
        self.assertLessEqual(latest.stat().st_size, module.MAX_STATE)
        self.assertEqual(json.loads(latest.read_text())['schema'], 'tag-availability-v1')
        self.assertEqual(len(list(state.glob('history-*.json'))), 1)

    def test_relative_and_non_home_paths_are_rejected(self):
        for path in ('relative/state', '/tmp/tag-availability-state', str(self.real / '..' / 'state')):
            with self.assertRaises(ValueError):
                module.Store(path)


if __name__ == '__main__':
    unittest.main()
