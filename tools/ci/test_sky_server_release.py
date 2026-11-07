from pathlib import Path
import re
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[2]
NODE = '/home/sky/.local/node-24.15.0/bin/node'


class SkyServerReleaseTests(unittest.TestCase):
    def test_release_script_parses_and_targets_sky_server(self):
        script = ROOT / 'scripts' / 'install-service.sh'
        subprocess.run(['bash', '-n', str(script)], check=True)
        text = script.read_text()
        self.assertIn('node_dir=/home/sky/.local/node-24.15.0/bin', text)
        self.assertIn('release_root=/home/sky/.local/share/tag-analysis', text)
        self.assertNotIn('skyhong-SM', text)
        # npm ci must not run through the /home/deck alias (lock-file mismatch).
        self.assertNotRegex(text, r'npm ci --prefix')

    def test_installed_units_pin_the_sky_server_node(self):
        for unit in ('tag-analysis', 'tag-web', 'tag-worker', 'tag-vocabulary-fast', 'tag-vocabulary-reconcile', 'tag-vocabulary-export'):
            text = (ROOT / 'runtime' / f'{unit}.service').read_text()
            self.assertRegex(text, re.compile('^ExecStart=' + re.escape(NODE) + ' ', re.M), unit)
        for path in (ROOT / 'runtime').glob('*.service'):
            self.assertNotIn('/home/deck/.local/bin/node', path.read_text(), path.name)


if __name__ == '__main__':
    unittest.main()
