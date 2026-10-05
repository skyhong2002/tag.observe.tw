"""Exercise exporter framing and cancellation with real isolated child processes."""
import base64
import gzip
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import unittest


class SourceProcessTests(unittest.TestCase):
    def export(self, mode, limit):
        with tempfile.TemporaryDirectory() as directory:
            fake = Path(directory) / 'mysqldump'
            fake.write_text('#!' + sys.executable + '\n' + '''import os, signal, sys, time
if os.environ['EXPORT_TEST_MODE'] == 'resist':
    signal.signal(signal.SIGTERM, signal.SIG_IGN)
    try:
        while True:
            os.write(1, b'x' * 65536)
    except OSError:
        while True:
            time.sleep(1)
else:
    os.write(1, b'INSERT INTO items VALUES (1);\\n')
''')
            fake.chmod(0o700)
            request = {'database': 'test', 'action': 'data', 'table': 'items', 'max_raw_bytes': limit}
            # Future imports must remain at the beginning of the exported source.
            script = 'REQUEST=' + repr(request) + '\nexec(compile(' + repr(Path(__file__).with_name('source.py').read_text()) + ", '<source>', 'exec'))"
            env = dict(os.environ, PATH=directory + os.pathsep + os.environ['PATH'], EXPORT_TEST_MODE=mode)
            process = subprocess.Popen([sys.executable, '-c', script], stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                       env=env, start_new_session=True)
            try:
                output, errors = process.communicate(timeout=6)
                frames = [json.loads(line[len(b'NEARLINE1:'):]) for line in output.splitlines() if line.startswith(b'NEARLINE1:')]
                return process.returncode, frames, errors
            finally:
                # This test owns the entire isolated process group, including a resisting fake dump.
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                process.communicate()

    def test_raw_limit_reports_error_even_when_dump_ignores_termination(self):
        code, frames, errors = self.export('resist', 64)
        self.assertEqual(code, 1)
        self.assertEqual(frames[-1]['type'], 'error')
        self.assertIn('RAW_LIMIT:', frames[-1]['message'])
        self.assertFalse(any(frame['type'] == 'end' for frame in frames))

    def test_normal_dump_keeps_verifiable_gzip_framing(self):
        code, frames, errors = self.export('normal', 4096)
        self.assertEqual(code, 0, errors)
        packed = b''.join(base64.b64decode(frame['base64']) for frame in frames if frame['type'] == 'data')
        raw = gzip.decompress(packed)
        self.assertEqual(raw, b'INSERT INTO items VALUES (1);\n')
        self.assertEqual(frames[-1]['type'], 'end')
        self.assertEqual(frames[-1]['raw_bytes'], len(raw))
        self.assertEqual(frames[-1]['sha256'], hashlib.sha256(packed).hexdigest())


if __name__ == '__main__':
    unittest.main()
