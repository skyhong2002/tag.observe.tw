import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { hash } from './capture-policy.mjs';
export function verifyControl(repo, sha, sourceHashes) {
  const git = (args) => {
    const r = spawnSync('git', args, {
      cwd: repo,
      encoding: 'utf8',
      timeout: 5000,
      maxBuffer: 1048576,
      env: { PATH: '/usr/bin:/bin', LANG: 'C' },
    });
    if (r.status !== 0) throw Error('Git control provenance');
    return r.stdout;
  };
  if (git(['rev-parse', 'HEAD']).trim() !== sha || git(['status', '--porcelain', '--untracked-files=all']).trim())
    throw Error('Committed clean exact control checkout required');
  if (!/^[a-f0-9]{40}$/.test(sha)) throw Error('Control OPS exact SHA');
  for (const [path, digest] of Object.entries(sourceHashes)) {
    if (!/^tools\/(mint-capture|mint-sm-candidate)\/[a-z0-9.-]+$/.test(path)) throw Error('Restricted control source path');
    const r = spawnSync('git', ['show', sha + ':' + path], {
      cwd: repo,
      encoding: null,
      timeout: 5000,
      maxBuffer: 1048576,
      env: { PATH: '/usr/bin:/bin', LANG: 'C' },
    });
    if (r.status !== 0 || hash(r.stdout) !== digest || hash(fs.readFileSync(join(repo, path))) !== digest)
      throw Error('Actual Git control source mismatch');
  }
  for (const directory of ['mint-capture', 'mint-sm-candidate'])
    for (const name of fs.readdirSync(join(repo, 'tools', directory)))
      if (/\.(mjs|cjs)$/.test(name) && !name.endsWith('.test.mjs') && !sourceHashes['tools/' + directory + '/' + name])
        throw Error('Every executable control module requires Git byte pin');
}
