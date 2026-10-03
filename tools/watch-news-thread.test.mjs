import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { decision, main, marker, rpc } from './watch-news-thread.mjs';

test('never starts another turn while running or waiting for input', () => {
  assert.equal(decision({}, { status: 'running' }, {}, null), 'running');
  assert.equal(decision({}, { status: 'starting' }, {}, null), 'running');
  assert.equal(decision({ pending_approval_count: 1 }, { status: 'idle' }, {}, null), 'waiting-for-user');
  assert.equal(decision({ pending_user_input_count: 1 }, { status: 'idle' }, {}, null), 'waiting-for-user');
});

test('resumes idle/error sessions with cooldown, respecting stop and archive', () => {
  for (const status of ['idle', 'ready', 'error', 'stopped', 'interrupted']) {
    assert.equal(decision({}, { status }, {}, null), 'kick');
  }
  assert.equal(decision({}, null, { lastKickAt: new Date().toISOString() }, null), 'cooldown');
  assert.equal(decision({}, null, { stopped: true }, null), 'stopped');
  assert.equal(decision({ archived_at: 'today' }, null, {}, null), 'inactive');
  assert.equal(decision({}, null, {}, { text: '停止自動續跑' }), 'stop-requested');
  assert.equal(decision({}, null, {}, { text: `${marker}\n停止時重新 kick` }), 'kick');
});

test('credentials cannot be sent to a nonlocal endpoint', async () => {
  await assert.rejects(rpc('https://example.com', 'secret', 'unused', {}), /Only local/);
});

test('accepted command is recovered after a lost response without another dispatch', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'news-watch-test-'));
  const previous = process.env.NEWS_WATCH_CONFIG;
  try {
    const databasePath = join(dir, 'state.sqlite');
    const db = new DatabaseSync(databasePath);
    db.exec(`
      CREATE TABLE projection_threads (thread_id TEXT, model_selection_json TEXT, runtime_mode TEXT, interaction_mode TEXT);
      CREATE TABLE projection_thread_sessions (thread_id TEXT, status TEXT);
      CREATE TABLE projection_thread_messages (thread_id TEXT, role TEXT, text TEXT, created_at TEXT);
      CREATE TABLE orchestration_command_receipts (command_id TEXT, status TEXT, error TEXT);
      INSERT INTO projection_threads VALUES ('target', '{}', 'full-access', 'default');
      INSERT INTO projection_thread_sessions VALUES ('target', 'idle');
      INSERT INTO orchestration_command_receipts VALUES ('already-accepted', 'accepted', NULL);
    `);
    db.close();
    const statePath = join(dir, 'watch.json');
    writeFileSync(statePath, JSON.stringify({ pending: { commandId: 'already-accepted' } }));
    const configPath = join(dir, 'config.json');
    writeFileSync(configPath, JSON.stringify({ databasePath, statePath, threadId: 'target' }));
    process.env.NEWS_WATCH_CONFIG = configPath;
    await main(); // No origin/token: an accidental second dispatch fails this test.
    const state = JSON.parse(readFileSync(statePath, 'utf8'));
    assert.equal(state.kicks, 1);
    assert.equal(state.pending, undefined);
    assert.equal(state.lastCommandId, 'already-accepted');
  } finally {
    if (previous === undefined) delete process.env.NEWS_WATCH_CONFIG;
    else process.env.NEWS_WATCH_CONFIG = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});
