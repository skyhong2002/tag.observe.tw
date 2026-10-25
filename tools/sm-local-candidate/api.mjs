// Anonymous SM isolated fixture API: no production relay, real login or queue.
import * as fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { types } from 'node:util';
import {
  dbPath,
  manifestPath,
  pins,
  privateBytes,
  runtime,
  sha,
  ticks,
  validateInput,
  validateRuntimeManifest,
  verifyControl,
} from './core.mjs';
export function validateDatabase(c) {
  if (
    !c ||
    Object.keys(c).some((k) => !['user', 'password', 'host', 'port', 'database'].includes(k)) ||
    !['127.0.0.1', 'localhost'].includes(c.host) ||
    Number(c.port) !== 18306 ||
    c.database !== 'tag_f1_semantic_test' ||
    typeof c.user !== 'string' ||
    !c.user ||
    typeof c.password !== 'string'
  )
    throw Error('Existing isolated fixture SQL configuration required');
  return c;
}
export function validateActors(rows) {
  if (
    rows.length !== 3 ||
    rows
      .map((r) => Number(r.id))
      .sort((a, b) => a - b)
      .join(',') !== '701,702,703'
  )
    throw Error('Existing fixture actors701/702/703 required');
  return true;
}
export function publicPath(path, method) {
  return ['GET', 'HEAD'].includes(method) && (/^\/api\/v1(?:\/|$)/.test(path) || path === '/api/status' || path === '/auth/me');
}
export function assertSelect(sqlOrOptions) {
  const sql = typeof sqlOrOptions === 'string' ? sqlOrOptions : sqlOrOptions?.sql;
  if (
    typeof sql !== 'string' ||
    !/^\s*SELECT\b/i.test(sql) ||
    sqlOrOptions?.multipleStatements === true ||
    /[;\0]|\/\*|\*\/|--|#|:=|\b(?:INTO|OUTFILE|DUMPFILE|FOR|LOCK|PROCEDURE|SLEEP|BENCHMARK|GET_LOCK|RELEASE_LOCK|LOAD_FILE)\b/i.test(sql)
  )
    throw Error('Only single isolated SELECT is admitted');
  return sql;
}
export function driverFailureClass(error) {
  if (error?.message === 'Fixture SELECT scheduler stopped') return 'scheduler-stopped';
  if (error?.message === 'Fixture SELECT scheduler queue limit.') return 'scheduler-limit';
  if (error?.message === 'Fixture PromisePool contract differs') return 'scheduler-contract';
  if (error?.message === 'Queue limit reached.') return 'queue-limit';
  if (error?.message === 'Pool is closed.') return 'pool-closed';
  if (error?.message === 'Callback function is not available with promise clients.') return 'promise-client-callback';
  return 'unknown';
}
export function sqlFailureEvidence({ operation, phase, error } = {}) {
  const chain = [],
    seen = new Set();
  let e = error;
  for (let depth = 0; depth < 4 && e && typeof e === 'object' && !seen.has(e); depth++) {
    seen.add(e);
    chain.push({
      depth,
      name: ['Error', 'TypeError', 'RangeError', 'AggregateError'].includes(e.name) ? e.name : 'unknown',
      clientClass: driverFailureClass(e),
      driverCode: [
        'ER_NO_SUCH_TABLE',
        'ER_BAD_FIELD_ERROR',
        'ER_PARSE_ERROR',
        'ER_ACCESS_DENIED_ERROR',
        'ER_TABLEACCESS_DENIED_ERROR',
        'ECONNREFUSED',
        'ECONNRESET',
        'ETIMEDOUT',
        'PROTOCOL_CONNECTION_LOST',
      ].includes(e.code)
        ? e.code
        : 'unknown',
    });
    e = e.cause;
  }
  return {
    schema: 'sm-fixture-readonly-failure-v1',
    operation: ['query', 'execute', 'prepare', 'unprepare', 'beginTransaction', 'commit', 'rollback', 'changeUser'].includes(operation)
      ? operation
      : 'unknown',
    phase: ['admission', 'driver', 'forbidden-operation'].includes(phase) ? phase : 'unknown',
    driverCode: chain[0]?.driverCode || 'unknown',
    errorChain: chain,
  };
}
export function boundedSqlFailureSink(append, { now = Date.now, maxBytes = 65536 } = {}) {
  let bytes = 0,
    index = 0,
    nextErrorId = 0;
  const ids = new WeakMap();
  return (evidence) => {
    let errorId = 0;
    if (evidence.error && typeof evidence.error === 'object') {
      if (!ids.has(evidence.error)) ids.set(evidence.error, ++nextErrorId);
      errorId = ids.get(evidence.error);
    }
    const raw = JSON.stringify({ ...sqlFailureEvidence(evidence), errorId, index: ++index, observedAtMs: now() }) + '\n';
    if (bytes + Buffer.byteLength(raw) > maxBytes) throw Error('Private SQL failure evidence cap');
    append(raw);
    bytes += Buffer.byteLength(raw);
  };
}
export function apiUnavailableEvidence(cause, path, index) {
  return {
    schema: 'sm-fixture-unavailable-v1',
    cause: ['sql-latched', 'expired', 'handler-error'].includes(cause) ? cause : 'unknown',
    routeClass:
      path === '/auth/me'
        ? 'anonymous-auth'
        : path === '/api/v1/reader-presence'
          ? 'reader-presence'
          : path === '/internal/sm-fixture-readiness'
            ? 'readiness'
            : /^\/api\/v1(?:\/|$)/.test(path || '')
              ? 'public-api'
              : 'other',
    requestIndex: index,
  };
}
export function boundedApiFailureSink(append, { now = Date.now, maxBytes = 65536 } = {}) {
  let bytes = 0;
  return (value) => {
    const row = apiUnavailableEvidence(value.cause, value.path, value.index),
      raw = JSON.stringify({ ...row, observedAtMs: now() }) + '\n';
    if (bytes + Buffer.byteLength(raw) > maxBytes) throw Error('Private API failure evidence cap');
    append(raw);
    bytes += Buffer.byteLength(raw);
  };
}
export function guardReadOnlyPool(pool, { onFailure = () => {} } = {}) {
  const guarded = new WeakSet();
  const wrap = (target) => {
    if (!target || typeof target !== 'object' || guarded.has(target)) return target;
    guarded.add(target);
    for (const name of ['query', 'execute'])
      if (typeof target[name] === 'function') {
        const original = target[name];
        target[name] = function (...args) {
          try {
            assertSelect(args[0]);
          } catch (error) {
            onFailure({ operation: name, phase: 'admission', error });
            throw error;
          }
          const report = (error) => onFailure({ operation: name, phase: 'driver', error });
          const callback = typeof args.at(-1) === 'function' ? args.at(-1) : null;
          if (callback)
            args[args.length - 1] = (error, ...rest) => {
              if (error) report(error);
              return callback(error, ...rest);
            };
          try {
            const value = original.apply(this, args);
            return types.isPromise(value)
              ? value.catch((error) => {
                  report(error);
                  throw error;
                })
              : value;
          } catch (error) {
            report(error);
            throw error;
          }
        };
      }
    if (typeof target.getConnection === 'function') {
      const original = target.getConnection;
      target.getConnection = function (...args) {
        if (typeof args.at(-1) === 'function') {
          const callback = args.pop();
          return original.apply(this, [
            ...args,
            (error, connection) => {
              if (error) return callback(error);
              let guardedConnection;
              try {
                guardedConnection = wrap(connection);
              } catch (failure) {
                return callback(failure);
              }
              return callback(null, guardedConnection);
            },
          ]);
        }
        return Promise.resolve(original.apply(this, args)).then(wrap);
      };
    }
    if (typeof target.promise === 'function') {
      const original = target.promise;
      target.promise = function (...args) {
        return wrap(original.apply(this, args));
      };
    }
    for (const name of ['prepare', 'unprepare', 'beginTransaction', 'commit', 'rollback', 'changeUser'])
      if (typeof target[name] === 'function')
        target[name] = () => {
          const error = Error('Isolated non-SELECT operation forbidden');
          onFailure({ operation: name, phase: 'forbidden-operation', error });
          throw error;
        };
    // mysql2 promise wrappers expose underlying callback clients; guard both surfaces in place.
    if (target.pool) wrap(target.pool);
    if (target.connection) wrap(target.connection);
    return target;
  };
  return wrap(pool);
}
// Wrap ONLY PromisePool entry points. Its callback core and Query commands remain unchanged.
export function scheduleFixtureSelects(
  pool,
  { expiresAtMs, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout, maxQueue = 256, onFailure = () => {} } = {},
) {
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now() || !Number.isInteger(maxQueue) || maxQueue < 1 || maxQueue > 256)
    throw Error('Bounded fixture scheduler admission required');
  const queue = [],
    running = new Set(),
    drainers = [];
  let stopped = false,
    controlError;
  const notify = () => {
    if (!running.size) for (const done of drainers.splice(0)) done();
  };
  const abort = () => {
    if (stopped) return;
    stopped = true;
    const error = Error('Fixture SELECT scheduler stopped');
    try {
      onFailure({ operation: 'query', phase: 'driver', error });
    } catch (failure) {
      controlError = failure;
    }
    try {
      clearTimer(expiryTimer);
    } catch (failure) {
      controlError ??= failure;
    }
    for (const item of queue.splice(0)) item.reject(error);
    for (const item of running) item.reject(error);
    notify();
  };
  const pump = () => {
    if (now() >= expiresAtMs) {
      abort();
      return;
    }
    while (!stopped && running.size < 2 && queue.length) {
      const item = queue.shift();
      running.add(item);
      let result;
      try {
        result = item.original.apply(pool, item.args);
        if (!types.isPromise(result)) {
          const error = Error('Fixture PromisePool contract differs');
          onFailure({ operation: item.name, phase: 'driver', error });
          throw error;
        }
      } catch (error) {
        result = Promise.reject(error);
      }
      result
        .then(item.resolve, item.reject)
        .finally(() => {
          running.delete(item);
          notify();
          pump();
        })
        .catch(() => {});
    }
  };
  const expiryTimer = setTimer(abort, Math.max(1, expiresAtMs - now()));
  expiryTimer?.unref?.();
  for (const name of ['query', 'execute']) {
    const original = pool[name];
    if (typeof original !== 'function') throw Error('PromisePool query/execute required');
    pool[name] = (...args) => {
      try {
        assertSelect(args[0]);
        if (args.some((x) => typeof x === 'function')) throw Error('Callback function is not available with promise clients.');
      } catch (error) {
        try {
          onFailure({ operation: name, phase: 'admission', error });
        } catch (auditError) {
          throw new AggregateError([error, auditError], 'Fixture admission and audit failure', { cause: error });
        }
        throw error;
      }
      if (stopped || now() >= expiresAtMs) {
        abort();
        return Promise.reject(Error('Fixture SELECT scheduler stopped'));
      }
      if (queue.length >= maxQueue) {
        const error = Error('Fixture SELECT scheduler queue limit.');
        onFailure({ operation: name, phase: 'driver', error });
        return Promise.reject(error);
      }
      return new Promise((resolve, reject) => {
        queue.push({ name, original, args, resolve, reject });
        pump();
      });
    };
  }
  return {
    abort,
    stats: () => ({ active: running.size, queued: queue.length, stopped }),
    async close(timeoutMs = 10000) {
      abort();
      if (!running.size) {
        if (controlError) throw controlError;
        return;
      }
      if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000) throw Error('Bounded scheduler close required');
      let timer;
      try {
        await Promise.race([
          new Promise((done) => drainers.push(done)),
          new Promise((_, reject) => {
            timer = setTimer(() => reject(Error('Fixture SELECT scheduler drain unconfirmed')), timeoutMs);
          }),
        ]);
      } finally {
        clearTimer(timer);
      }
      if (controlError) throw controlError;
    },
  };
}
export function deliverReadonly(result, { response, failed, head = false }) {
  if (failed()) {
    response.writeHead(503, { 'content-type': 'application/json', 'cache-control': 'private, no-store' });
    response.end(JSON.stringify({ error: 'readonly-fixture-unavailable' }));
    return;
  }
  const out = { ...result.headers, 'cache-control': 'private, no-store', 'x-f1-data-scope': 'sm-real-isolated-fixture-anonymous' };
  for (const k of ['set-cookie', 'connection', 'transfer-encoding', 'content-length']) delete out[k];
  response.writeHead(result.statusCode, out);
  response.end(head ? undefined : result.rawPayload);
}
export async function rethrowFixtureStartup(error, close) {
  try {
    await close();
  } catch (cleanup) {
    throw new AggregateError([error, cleanup], 'Fixture startup and owned cleanup failed', { cause: error });
  }
  throw error;
}
export async function closeFixtureOwned({ scheduler, server, app, db }, primary) {
  const errors = primary ? [primary] : [],
    phases = [];
  const attempt = async (phase, fn) => {
    try {
      await fn();
    } catch (error) {
      errors.push(error);
      phases.push(phase);
    }
  };
  await attempt('scheduler-abort', () => scheduler?.abort());
  await attempt('server-connections', () => {
    if (server?.listening) server.closeAllConnections?.();
  });
  await attempt('server-close', () => {
    if (server?.listening) return new Promise((done, fail) => server.close((error) => (error ? fail(error) : done())));
  });
  await attempt('app-close', () => app?.close());
  await attempt('scheduler-drain', () => scheduler?.close());
  await attempt('database-close', () => db?.close());
  if (errors.length) {
    const failure = new AggregateError(errors, 'Owned fixture cleanup failed', { cause: primary || errors[0] });
    failure.cleanupPhases = phases;
    throw failure;
  }
}
export async function startFixture(
  q,
  job,
  { importModule = (u) => import(u), requireModule = createRequire(join(runtime, 'package.json')), httpModule = http } = {},
) {
  const raw = privateBytes(dbPath);
  if (sha(raw) !== q.dbConfigSha256) throw Error('Pinned existing private DB configuration differs');
  const c = validateDatabase(JSON.parse(raw));
  const manifestBytes = privateBytes(manifestPath, 16 * 1024 ** 2);
  if (sha(manifestBytes) !== pins.manifest) throw Error('Immutable APP manifest differs');
  validateRuntimeManifest(JSON.parse(manifestBytes));
  // Imports are physical APPaff5 files inside the independently whole-hashed runtime.
  const { buildApp } = await importModule(pathToFileURL(join(runtime, 'app/src/app.js')).href);
  const { createDb } = await importModule(pathToFileURL(join(runtime, 'app/src/db/client.ts')).href);
  // Resolve dependency before listener creation; it must already exist in this runtime.
  requireModule.resolve('mysql2/promise');
  const db = createDb(`mysql://${encodeURIComponent(c.user)}:${encodeURIComponent(c.password)}@127.0.0.1:18306/tag_f1_semantic_test`, {
    poolSize: 2,
  });
  let sqlFailed = false,
    scheduler,
    app,
    server,
    closing;
  const close = () => (closing ??= closeFixtureOwned({ scheduler, server, app, db }));
  try {
    const diagnosticPath = join(job, 'api-readonly-failures.jsonl');
    fs.writeFileSync(diagnosticPath, '', { flag: 'wx', mode: 0o600 });
    const failureSink = boundedSqlFailureSink((raw) => fs.appendFileSync(diagnosticPath, raw));
    guardReadOnlyPool(db.pool, {
      onFailure: (evidence) => {
        sqlFailed = true;
        failureSink(evidence);
      },
    });
    scheduler = scheduleFixtureSelects(db.pool, {
      expiresAtMs: q.expiresAtMs,
      onFailure: (evidence) => {
        sqlFailed = true;
        failureSink(evidence);
      },
    });
    const [[actual]] = await db.pool.query('SELECT DATABASE() AS databaseName, VERSION() AS serverVersion, @@port AS serverPort');
    if (
      actual.databaseName !== 'tag_f1_semantic_test' ||
      !Number.isInteger(Number(actual.serverPort)) ||
      Number(actual.serverPort) < 1 ||
      Number(actual.serverPort) > 65535 ||
      !/^11\.4\..*MariaDB/.test(actual.serverVersion)
    )
      throw Error('Actual isolated MariaDB11.4 identity required');
    // Record the actual server-side port; only the client URL selects admitted localhost18306.
    const [rows] = await db.pool.query('SELECT id FROM users ORDER BY id');
    validateActors(rows);
    const [[categories]] = await db.pool.query('SELECT COUNT(*) AS categoryCount FROM media_category_defs');
    if (!Number.isInteger(Number(categories.categoryCount)) || Number(categories.categoryCount) < 1)
      throw Error('Existing fixture categories required; seed forbidden');
    const forbidden = async () => {
      throw Error('Anonymous fixture mutation disabled');
    };
    const loginStore = {
      upsertUser: forbidden,
      createSession: forbidden,
      deleteSession: forbidden,
      listUsers: forbidden,
      setAdmin: forbidden,
      sessionUser: async () => null,
    };
    const disabledQueue = () => ({
      add: async () => {
        throw Error('Isolated worker disabled; no image workflow pass');
      },
      getJob: async () => null,
      getJobs: async () => [],
    });
    app = await buildApp(
      {
        uiOrigin: 'http://127.0.0.1:18199',
        login: { clientId: 'isolated-fixture', clientSecret: 'isolated-fixture', origin: 'http://127.0.0.1:18199', admins: new Set() },
      },
      { db: db.db, loginStore, jobQueue: disabledQueue },
    );
    await app.ready();
    if (sqlFailed) throw Error('Readonly fixture SQL startup failed; no fallback admitted');
    const unavailablePath = join(job, 'api-unavailable.jsonl');
    fs.writeFileSync(unavailablePath, '', { flag: 'wx', mode: 0o600 });
    const unavailableSink = boundedApiFailureSink((raw) => fs.appendFileSync(unavailablePath, raw));
    let requestIndex = 0;
    server = httpModule.createServer(async (req, res) => {
      const index = ++requestIndex;
      const send = (status, value) => {
        if (status === 503) {
          try {
            unavailableSink({
              index,
              path: typeof req.url === 'string' ? req.url.split('?')[0] : '',
              cause:
                value.error === 'readonly-fixture-unavailable'
                  ? 'sql-latched'
                  : value.error === 'session-expired'
                    ? 'expired'
                    : 'handler-error',
            });
          } catch {
            sqlFailed = true;
            res.destroy();
            return;
          }
        }
        res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'private, no-store' });
        res.end(JSON.stringify(value));
      };
      try {
        if (
          !['127.0.0.1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) ||
          typeof req.url !== 'string' ||
          !req.url.startsWith('/') ||
          req.url.startsWith('//')
        )
          return send(403, { error: 'fixture-only' });
        if (sqlFailed) return send(503, { error: 'readonly-fixture-unavailable' });
        if (Date.now() >= q.expiresAtMs) return send(503, { error: 'session-expired' });
        const url = new URL(req.url, 'http://127.0.0.1:18197');
        if (req.url === '/internal/sm-fixture-readiness' && req.method === 'GET')
          return send(200, {
            scope: 'sm-real-isolated-fixture-anonymous',
            appSha: pins.app,
            buildId: pins.build,
            inventorySha256: pins.inventory,
            actors: [701, 702, 703],
            databaseName: actual.databaseName,
            serverVersion: actual.serverVersion,
            serverPort: Number(actual.serverPort),
            apiOrigin: 'http://127.0.0.1:18197',
            productionFallback: false,
            queueEnabled: false,
          });
        if (!publicPath(url.pathname, req.method)) return send(403, { error: 'anonymous-readonly' });
        if (req.headers['content-length'] && req.headers['content-length'] !== '0') return send(400, { error: 'no-body' });
        for await (const chunk of req) if (chunk.length) return send(400, { error: 'no-body' });
        const headers = {};
        for (const k of ['accept', 'accept-language', 'range', 'if-none-match', 'if-modified-since', 'dnt', 'sec-gpc'])
          if (typeof req.headers[k] === 'string') headers[k] = req.headers[k];
        const result = await app.inject({ method: req.method === 'HEAD' ? 'GET' : req.method, url: req.url, headers });
        if (Date.now() >= q.expiresAtMs) return send(503, { error: 'session-expired' });
        if (sqlFailed) return send(503, { error: 'readonly-fixture-unavailable' });
        deliverReadonly(result, { response: res, failed: () => sqlFailed, head: req.method === 'HEAD' });
      } catch {
        if (!res.headersSent) send(503, { error: 'fixture-unavailable' });
        else res.destroy();
      }
    });
    server.headersTimeout = 10000;
    server.requestTimeout = 10000;
    server.timeout = 10000;
    server.on('connect', (_req, socket) => socket.destroy());
    server.on('upgrade', (_req, socket) => socket.destroy());
    await new Promise((done, fail) => {
      server.once('error', fail);
      server.listen(18197, '127.0.0.1', done);
    });
    fs.writeFileSync(
      join(job, 'api-runtime.json'),
      JSON.stringify({
        appSha: pins.app,
        physicalAppModuleSha256: sha(fs.readFileSync(join(runtime, 'app/src/app.js'))),
        databaseName: actual.databaseName,
        serverVersion: actual.serverVersion,
        serverPort: Number(actual.serverPort),
        actors: [701, 702, 703],
        pid: process.pid,
        startTicks: ticks(process.pid),
        productionFallback: false,
        queueEnabled: false,
      }) + '\n',
      { flag: 'wx', mode: 0o600 },
    );
    return { close };
  } catch (error) {
    return rethrowFixtureStartup(error, close);
  }
}
export async function main(argv = process.argv.slice(2)) {
  if (argv.length !== 3) throw Error('Private admitted input/hash/job required');
  const [p, hash, job] = argv,
    bytes = privateBytes(p);
  if (sha(bytes) !== hash) throw Error('Input differs');
  const q = validateInput(JSON.parse(bytes));
  verifyControl(q);
  const api = await startFixture(q, job);
  let ended = false;
  const stop = async () => {
    if (ended) return;
    ended = true;
    await api.close();
    process.exitCode = 0;
  };
  process.once('SIGTERM', () =>
    stop().catch(() => {
      process.exitCode = 1;
    }),
  );
  process.once('SIGINT', () =>
    stop().catch(() => {
      process.exitCode = 1;
    }),
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch(() => {
    process.stderr.write('Isolated anonymous API failed; private evidence retained.\n');
    process.exitCode = 1;
  });
