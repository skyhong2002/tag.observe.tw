import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CANDIDATE } from './barrier.mjs';
import { candidateAdapter, validateConfig } from './candidate-adapter.mjs';

const config = {
  ...CANDIDATE,
  database: 'tag_f1_semantic_test',
  actors: [701, 702, 703],
  releaseRoot: '/immutable/app677',
  apiPid: 123,
  nextPid: 124,
  gatewayOrigin: 'http://127.0.0.1:19001',
  nextOrigin: 'http://127.0.0.1:19002',
  surfaces: [{ kind: 'json', path: '/api/v1/tags/%E7%94%B2/relations', present: ['PUBLIC_CANARY'], absent: ['PRIVATE_CANARY'] }],
};
function io(privateLeak = false) {
  const files = {
    '/immutable/app677/COMMIT': CANDIDATE.app,
    '/immutable/app677/web/.next/BUILD_ID': CANDIDATE.buildId,
    '/immutable/app677/web/.next/standalone/web/.next/BUILD_ID': CANDIDATE.buildId,
    '/proc/123/environ':
      'TAG_DB_URL=mysql://fixture:fixture@127.0.0.1:18306/tag_f1_semantic_test\0PORT=19001\0UI_ORIGIN=http://127.0.0.1:19002\0',
    '/proc/124/environ': 'PORT=19002\0TAG_API_ORIGIN=http://127.0.0.1:19001\0',
  };
  return {
    readFile: async (p) => {
      assert.ok(p in files);
      return files[p];
    },
    realpath: async (p) =>
      p === '/proc/123/cwd' ? config.releaseRoot : p === '/proc/124/cwd' ? config.releaseRoot + '/web/.next/standalone/web' : p,
    fetch: async (_url, options) =>
      new Response(JSON.stringify({ label: privateLeak ? 'PRIVATE_CANARY PUBLIC_CANARY' : 'PUBLIC_CANARY' }), {
        headers: {
          'content-type': 'application/json',
          'cache-control': Object.keys(options.headers).length > 1 ? 'private, no-store' : 'public, max-age=60',
        },
      }),
  };
}
test('rejects production entry and wrong fixture actors before IO', () => {
  assert.throws(() => validateConfig({ ...config, gatewayOrigin: 'http://127.0.0.1:18130' }));
  assert.throws(() => validateConfig({ ...config, actors: [601, 602] }));
  assert.throws(() => validateConfig({ ...config, database: 'tag_observe' }));
});
test('collects real-response-shaped headers without claiming B0 or actual fixtures', async () => {
  const result = await candidateAdapter(config, io()).runReadOnly();
  assert.equal(result.responses.length, 10);
  assert.equal(result.barrierPassed, false);
  assert.equal(result.actorsVerified, false);
  assert.equal(result.deploymentGatePassed, false);
});
test('rejects private response canary and unavailable SQL barrier', async () => {
  await assert.rejects(candidateAdapter(config, io(true)).runReadOnly(), /private fixture leaked/);
  assert.throws(() => candidateAdapter(config, io()).armSqlResultBarrier(), /no SQL-result hook/);
});
