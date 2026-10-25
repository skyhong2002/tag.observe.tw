// Explicit invocation only. No imports start a service or connect a database.
import { readFile, realpath } from 'node:fs/promises';
import { candidateAdapter } from './candidate-adapter.mjs';

if (process.argv.length !== 4 || process.argv[2] !== '--approved-read-only-config') throw Error('Explicit reviewed config required');
const config = JSON.parse(await readFile(process.argv[3], 'utf8'));
const adapter = candidateAdapter(config, { readFile: (path) => readFile(path, 'utf8'), realpath, fetch });
try {
  process.stdout.write(JSON.stringify(await adapter.runReadOnly(), null, 2) + '\n');
} catch {
  process.stderr.write(
    'Candidate privacy check failed; no deployment gate passed. Inspect with reviewer without printing environment/secrets.\n',
  );
  process.exitCode = 1;
}
