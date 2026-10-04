import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, stat, statfs, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
export const digest = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');
export interface ArchiveStore {
  remote: string;
  localFreeBytes?(): Promise<number>;
  putVerified(data: Buffer): Promise<{ key: string; hash: string }>;
  getVerified(key: string, hash: string): Promise<Buffer>;
}

export class RcloneArchiveStore implements ArchiveStore {
  readonly remote: string;
  readonly config: string;
  readonly spool: string;
  constructor(remote: string, config: string, spool: string) {
    this.remote = remote;
    this.config = config;
    this.spool = spool;
    if (!remote.includes(':') || remote.length > 512) throw new Error('Invalid archive remote');
  }
  private async run(args: string[]) {
    return exec(
      'rclone',
      [
        '--config',
        this.config,
        '--bwlimit',
        '8M',
        '--retries',
        '2',
        '--low-level-retries',
        '2',
        '--contimeout',
        '15s',
        '--timeout',
        '60s',
        ...args,
      ],
      { timeout: 900_000, maxBuffer: 1024 * 1024 },
    );
  }
  private path(key: string) {
    if (!/^objects\/[a-f0-9]{2}\/[a-f0-9]{64}\.json\.gz$/.test(key)) throw new Error('Invalid archive object key');
    return `${this.remote.replace(/\/$/, '')}/${key}`;
  }
  async localFreeBytes() {
    await mkdir(this.spool, { recursive: true, mode: 0o700 });
    const disk = await statfs(this.spool);
    return disk.bavail * disk.bsize;
  }
  private async temporary() {
    if ((await this.localFreeBytes()) < 10 * 2 ** 30) throw new Error('Archive spool below 10 GiB reserve');
    return mkdtemp(join(this.spool, 'content-'));
  }
  async getVerified(key: string, hash: string): Promise<Buffer> {
    const remote = this.path(key);
    if (!/^[a-f0-9]{64}$/.test(hash) || !key.endsWith(`/${hash}.json.gz`)) throw new Error('Invalid archive hash');
    const dir = await this.temporary();
    try {
      const path = join(dir, 'readback.gz');
      await this.run(['copyto', remote, path, '--ignore-times']);
      if ((await stat(path)).size > 64 * 2 ** 20) throw new Error('Archive object exceeds size budget');
      const data = await readFile(path);
      if (digest(data) !== hash) throw new Error('NAS content checksum mismatch');
      return data;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
  async putVerified(data: Buffer) {
    if (data.length > 64 * 2 ** 20) throw new Error('Archive object exceeds size budget');
    const [name, rest] = this.remote.split(':');
    const about = JSON.parse((await this.run(['about', `${name}:${rest.split('/')[0]}`, '--json'])).stdout);
    if (!Number.isFinite(about.free) || about.free < 100 * 2 ** 30) throw new Error('NAS below 100 GiB reserve');
    const hash = digest(data);
    const key = `objects/${hash.slice(0, 2)}/${hash}.json.gz`;
    const dir = await this.temporary();
    const remote = this.path(key);
    try {
      const file = join(dir, 'object.gz');
      await writeFile(file, data, { mode: 0o600 });
      await this.run(['copyto', file, `${remote}.partial`, '--ignore-times']);
      await this.run(['moveto', `${remote}.partial`, remote, '--ignore-times']);
      // No receipt is issued until the final published object is read back.
      await this.getVerified(key, hash);
      return { key, hash };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}

export function archiveStoreFromEnv(): ArchiveStore | undefined {
  const remote = process.env.TAG_CONTENT_ARCHIVE_REMOTE;
  if (!remote) return undefined;
  const config = process.env.TAG_CONTENT_ARCHIVE_RCLONE_CONFIG;
  const spool = process.env.TAG_CONTENT_ARCHIVE_SPOOL;
  if (!config || !spool) throw new Error('Archive requires RCLONE_CONFIG and SPOOL settings');
  return new RcloneArchiveStore(remote, config, spool);
}
