import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readlink, realpath } from 'node:fs/promises';

const expected = await realpath(process.argv[2]);
for (let attempt = 0; attempt < 40; attempt++) {
  try {
    const response = await fetch('http://127.0.0.1:18130/_migration/health', { signal: AbortSignal.timeout(500) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, 'ok');
    const pid = execFileSync('systemctl', ['--user', 'show', 'tag-analysis.service', '--property=MainPID', '--value'], {
      encoding: 'utf8',
    }).trim();
    assert.match(pid, /^[1-9]\d*$/);
    assert.equal(await readlink('/proc/' + pid + '/cwd'), expected);
    console.log('HTTP health and systemd process release directory verified.');
    process.exit(0);
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 200));
}
throw Error('Preview did not become ready from the expected release');
