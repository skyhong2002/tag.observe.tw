// Private Ubuntu tool extraction only; no package installation or system change.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { parseDynamic, parseReadelf } from './native-elf-proof.js';
export const patchelfPin = Object.freeze({
  version: '0.18.0-1.1build1',
  architecture: 'amd64',
  filename: 'pool/universe/p/patchelf/patchelf_0.18.0-1.1build1_amd64.deb',
  bytes: 106300,
  sha256: '962a43e33cd56061522554898557a038ccbb8aa4e1e0f421b2d6f6adf1f80c60',
});
const keyring = '/usr/share/keyrings/ubuntu-archive-keyring.gpg';
const keyringSha = '80a36b0a6de2f69f49d2df75ef473ccde121e9e190b9ea01d20a4f63778d5c31';
const signer = 'F6ECB3762474EDA9D21B7022871920D1991BC93C';
const releasePath = '/var/lib/apt/lists/archive.ubuntu.com_ubuntu_dists_noble_InRelease';
const packagesPath = '/var/lib/apt/lists/archive.ubuntu.com_ubuntu_dists_noble_universe_binary-amd64_Packages';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const defaultIo = { readFileSync, lstatSync, mkdirSync, writeFileSync, realpathSync };
function runCommand(bin, args, options = {}) {
  const result = spawnSync(bin, args, {
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 4 * 1024 ** 2,
    env: { PATH: '/usr/bin:/bin', HOME: '/nonexistent', LANG: 'C' },
    ...options,
  });
  if (result.error || result.status !== 0) throw Error('Private portable tool command failed');
  return result.stdout;
}
function rootBytes(path, limit, io) {
  const stat = io.lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== 0 || stat.mode & 0o022 || stat.size > limit)
    throw Error('Root-owned bounded public Ubuntu metadata required');
  const bytes = io.readFileSync(path);
  if (bytes.length !== stat.size) throw Error('Ubuntu metadata changed while reading');
  return bytes;
}
export function verifyUbuntuPatchelfMetadata({ io = defaultIo, run = runCommand } = {}) {
  const keys = rootBytes(keyring, 1024 ** 2, io);
  if (sha(keys) !== keyringSha) throw Error('Pinned Ubuntu archive keyring mismatch');
  const release = rootBytes(releasePath, 1024 ** 2, io);
  const payload = signedReleasePayload(release);
  // Verify the exact bytes parsed below, rather than rereading a mutable path.
  const status = run('/usr/bin/gpgv', ['--status-fd', '1', '--keyring', keyring, '-'], { input: release });
  validateUbuntuSignatureStatus(status);
  const packages = rootBytes(packagesPath, 128 * 1024 ** 2, io);
  const parsed = parsePatchelfIndex(payload, packages);
  return {
    schema: 'ubuntu-patchelf-source-v1',
    signatureVerified: true,
    signer,
    keyringSha256: sha(keys),
    releaseSha256: sha(release),
    ...parsed,
  };
}
export function signedReleasePayload(bytes) {
  const text = bytes.toString('utf8');
  const match =
    /^-----BEGIN PGP SIGNED MESSAGE-----\r?\n(?:Hash: [A-Za-z0-9,-]+\r?\n)+\r?\n([\s\S]*?)\r?\n-----BEGIN PGP SIGNATURE-----\r?\n[\s\S]*?\r?\n-----END PGP SIGNATURE-----\r?\n?$/.exec(
      text,
    );
  if (!match || text.split('-----BEGIN PGP SIGNED MESSAGE-----').length !== 2 || text.split('-----BEGIN PGP SIGNATURE-----').length !== 2)
    throw Error('One bounded clearsigned Ubuntu release required');
  return Buffer.from(match[1].replace(/^- /gm, '') + '\n');
}
// Only consumes gpgv status after a successful invocation, never release text.
export function validateUbuntuSignatureStatus(status) {
  const valid = status.split('\n').filter((line) => line.startsWith('[GNUPG:] VALIDSIG '));
  if (
    !valid.length ||
    valid.some((line) => line.split(/\s+/)[2] !== signer) ||
    /\[GNUPG:\] (?:BADSIG|ERRSIG|EXPSIG|EXPKEYSIG|REVKEYSIG|NO_PUBKEY|FAILURE)\b/.test(status)
  )
    throw Error('Expected Ubuntu archive signature required');
}
// Parse only. Calling this helper does not verify a signature or trust a tool.
export function parsePatchelfIndex(release, packages) {
  const text = release.toString('utf8');
  if (!/^Origin: Ubuntu$/m.test(text) || !/^Codename: noble$/m.test(text)) throw Error('Pinned Ubuntu noble release required');
  const section = text.split('\nSHA256:\n')[1]?.split('\n-----BEGIN PGP SIGNATURE-----')[0];
  const entry = section
    ?.split('\n')
    .map((line) => /^ ([a-f0-9]{64})\s+(\d+)\s+(\S+)$/.exec(line))
    .filter((row) => row?.[3] === 'universe/binary-amd64/Packages');
  if (entry?.length !== 1) throw Error('Signed exact package index required');
  if (packages.length !== Number(entry[0][2]) || sha(packages) !== entry[0][1]) throw Error('Signed Ubuntu package index digest mismatch');
  const blocks = packages
    .toString('utf8')
    .split('\n\n')
    .filter((block) => /^Package: patchelf$/m.test(block));
  if (blocks.length !== 1) throw Error('Unique pinned patchelf package required');
  const fields = Object.fromEntries(
    blocks[0]
      .split('\n')
      .filter((line) => /^[A-Za-z][A-Za-z0-9-]*: /.test(line))
      .map((line) => {
        const split = line.indexOf(': ');
        return [line.slice(0, split), line.slice(split + 2)];
      }),
  );
  if (
    fields.Version !== patchelfPin.version ||
    fields.Architecture !== patchelfPin.architecture ||
    fields.Filename !== patchelfPin.filename ||
    fields.SHA256 !== patchelfPin.sha256 ||
    Number(fields.Size) !== patchelfPin.bytes
  )
    throw Error('Signed package does not match reviewed pin');
  return { packagesSha256: sha(packages), packagesBytes: packages.length, signedIndexPath: entry[0][3], package: { ...patchelfPin } };
}
export async function preparePortablePatchelf(
  destination,
  { assertGuard, io = defaultIo, run = runCommand, metadata = verifyUbuntuPatchelfMetadata, runtime = process, digest = sha } = {},
) {
  if (typeof assertGuard !== 'function' || !isAbsolute(destination || '') || runtime.platform !== 'linux' || runtime.arch !== 'x64')
    throw Error('Guarded private Linux x64 tool destination required');
  await assertGuard();
  const provenance = await metadata({ io, run });
  await assertGuard(); // Metadata hashing can take time; recheck before writes.
  destination = resolve(destination);
  io.mkdirSync(destination, { mode: 0o700 }); // Exclusive, no global install.
  const archive = join(destination, 'patchelf.deb');
  io.writeFileSync(archive, Buffer.alloc(0), { flag: 'wx', mode: 0o600 });
  await assertGuard();
  run('/usr/bin/curl', [
    '--proto',
    '=https',
    '--fail',
    '--silent',
    '--show-error',
    '--max-time',
    '60',
    '--max-filesize',
    String(patchelfPin.bytes),
    '--output',
    archive,
    'https://archive.ubuntu.com/ubuntu/' + patchelfPin.filename,
  ]); // No redirects.
  const archiveStat = io.lstatSync(archive);
  if (!archiveStat.isFile() || archiveStat.isSymbolicLink() || archiveStat.size !== patchelfPin.bytes)
    throw Error('Bounded regular portable package required');
  const bytes = io.readFileSync(archive);
  if (bytes.length !== patchelfPin.bytes || digest(bytes) !== patchelfPin.sha256)
    throw Error('Downloaded portable package digest mismatch');
  await assertGuard();
  const extracted = join(destination, 'root');
  io.mkdirSync(extracted, { mode: 0o700 });
  run('/usr/bin/dpkg-deb', ['--extract', archive, extracted]); // Does not execute maintainer scripts.
  const path = join(extracted, 'usr/bin/patchelf');
  const st = io.lstatSync(path);
  const rel = relative(io.realpathSync(extracted), io.realpathSync(path));
  if (!st.isFile() || st.isSymbolicLink() || rel.startsWith('..') || isAbsolute(rel)) throw Error('Portable tool escapes private root');
  const toolSha = digest(io.readFileSync(path));
  const header = run('/usr/bin/readelf', ['--file-header', '--', path]);
  const versions = run('/usr/bin/readelf', ['--version-info', '--', path]);
  const dynamic = run('/usr/bin/readelf', ['--dynamic', '--', path]);
  const requirements = parseReadelf(header, versions, 'x64');
  parseDynamic(dynamic, extracted, 'usr/bin/patchelf');
  await assertGuard();
  if (run(path, ['--version']).trim() !== 'patchelf 0.18.0' || digest(io.readFileSync(path)) !== toolSha)
    throw Error('Actual portable tool identity mismatch');
  const receipt = {
    path,
    sha256: toolSha,
    version: '0.18.0',
    provenance,
    requirements,
    preparedAt: new Date().toISOString(),
    rawReadelfSha256: sha(header + versions + dynamic),
    scope: 'private extraction; no package installation or system service',
  };
  await assertGuard();
  io.writeFileSync(join(destination, 'provenance.json'), JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  return receipt;
}
