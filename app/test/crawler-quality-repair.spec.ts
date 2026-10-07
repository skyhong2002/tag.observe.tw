import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  query: vi.fn(),
  beginTransaction: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  release: vi.fn(),
  close: vi.fn(),
}));
vi.mock('../src/db/client.ts', () => ({ createDb: () => ({ pool: { getConnection: async () => mock }, close: mock.close }) }));

import { repairPlan, validatePlan } from '../../tools/crawler-quality-repair.mjs';

const before = {
  id: 1,
  media: 'test',
  source: 'own',
  url: 'https://example.org/story',
  published_at: '2026-10-07T10:00:00.000Z',
  title: 'Story',
  body: 'Original report. '.repeat(30),
  body_status: 'ok',
  body_source: 'article',
  content_fetched_at: '2026-10-07T10:01:00.000Z',
  tags: ['for', 'France'],
  attributions: [],
};
const plan = () => ({
  rows: [{ before: structuredClone(before), update: { tags: ['France'] }, evidence: 'original page confirms meaningless function word' }],
});
let folder: string;
beforeEach(() => {
  vi.clearAllMocks();
  folder = mkdtempSync(join(tmpdir(), 'quality-repair-'));
  mock.query.mockImplementation(async (sql: string) => {
    if (sql.includes('GET_LOCK')) return [[{ ok: 1 }]];
    if (sql.startsWith('SELECT * FROM articles ')) return [[{ ...before, similarity_at: new Date('2026-10-07T10:02:00Z') }]];
    return [[]];
  });
});
afterEach(() => rmSync(folder, { recursive: true, force: true }));
describe('reviewed crawler quality repair safeguards', () => {
  it('rejects unbounded, duplicate, unsupported or expired updates', () => {
    const p = plan();
    expect(() => validatePlan({ rows: Array(101).fill(p.rows[0]) })).toThrow();
    expect(() => validatePlan({ rows: [p.rows[0], p.rows[0]] })).toThrow();
    expect(() => validatePlan({ rows: [{ ...p.rows[0], update: { published_at: before.published_at } }] })).toThrow();
    expect(() => validatePlan({ rows: [{ ...p.rows[0], before: { ...before, body_status: 'expired' } }] })).toThrow();
    expect(() => validatePlan({ rows: [{ ...p.rows[0], update: { tags: ['guessed topic'] } }] })).toThrow();
  });
  it('does not write or acquire the index lock during dry-run', async () => {
    const result = await repairPlan(plan());
    expect(result[0].applied).toBe(false);
    expect(mock.query.mock.calls.every(([sql]) => String(sql).startsWith('SELECT') && !String(sql).includes('GET_LOCK'))).toBe(true);
    expect(mock.commit).not.toHaveBeenCalled();
  });
  it('stops on concurrent article changes before any mutation', async () => {
    mock.query.mockImplementation(async () => [[{ ...before, title: 'Concurrent edit' }]]);
    await expect(repairPlan(plan())).rejects.toThrow('changed since review');
    expect(mock.rollback).toHaveBeenCalled();
    expect(mock.query).toHaveBeenCalledTimes(1);
  });
  it('requires a backup and index lock, saves the full original, and removes only rejected index tags', async () => {
    await expect(repairPlan(plan(), { apply: true })).rejects.toThrow('backup');
    const backup = join(folder, 'before.jsonl');
    await repairPlan(plan(), { apply: true, backup });
    const saved = JSON.parse(readFileSync(backup, 'utf8'));
    expect(saved.before.similarity_at).toBe('2026-10-07T10:02:00.000Z');
    expect(mock.query).toHaveBeenCalledWith('DELETE FROM article_tags WHERE article_id=? AND tag=?', [1, 'for']);
    expect(mock.query.mock.calls.some(([sql]) => String(sql).includes('similarity_at=NULL'))).toBe(false);
    expect(mock.commit).toHaveBeenCalledOnce();
    expect(mock.query).toHaveBeenLastCalledWith("SELECT RELEASE_LOCK('similarity-index')");
  });
  it('refuses body repair if similarity pairs appeared since review', async () => {
    const p = {
      rows: [{ ...plan().rows[0], update: { body: 'Repaired article. '.repeat(30), body_status: 'ok', body_source: 'article' } }],
    };
    const original = mock.query.getMockImplementation()!;
    mock.query.mockImplementation(async (...args: unknown[]) =>
      String(args[0]).includes('FROM similarity_pairs') ? [[{ a_id: 1, b_id: 2 }]] : original(...args),
    );
    await expect(repairPlan(p, { apply: true, backup: join(folder, 'before.jsonl') })).rejects.toThrow('similarity pairs');
    expect(mock.commit).not.toHaveBeenCalled();
    expect(mock.query.mock.calls.some(([sql]) => /^(UPDATE|DELETE|INSERT)/.test(String(sql)))).toBe(false);
  });
  it('clears a body sketch and schedules reindexing without changing acquisition or publication times', async () => {
    const p = {
      rows: [{ ...plan().rows[0], update: { body: 'Repaired article. '.repeat(30), body_status: 'ok', body_source: 'article' } }],
    };
    await repairPlan(p, { apply: true, backup: join(folder, 'body.jsonl') });
    const update = mock.query.mock.calls.find(([sql]) => String(sql).startsWith('UPDATE articles'));
    expect(String(update?.[0])).toContain('similarity_at=NULL');
    expect(String(update?.[0])).not.toMatch(/published_at|content_fetched_at|authors|creator/);
    expect(mock.query).toHaveBeenCalledWith('DELETE FROM article_sketches WHERE article_id=?', [1]);
    expect(mock.query).toHaveBeenCalledWith('DELETE FROM article_citations WHERE article_id=?', [1]);
    expect(mock.commit).toHaveBeenCalledOnce();
  });
  it('does not interrupt a running similarity job to obtain the lock', async () => {
    mock.query.mockResolvedValue([[{ ok: 0 }]]);
    await expect(repairPlan(plan(), { apply: true, backup: join(folder, 'busy.jsonl') })).rejects.toThrow('busy');
    expect(mock.beginTransaction).not.toHaveBeenCalled();
    expect(mock.query).toHaveBeenCalledTimes(1);
  });
});
