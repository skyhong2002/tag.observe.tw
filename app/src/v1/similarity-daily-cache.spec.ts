import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/client.ts';

describe('settled daily relation counts', () => {
  it('hydrates a settled day once and keeps recent days live', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'similarity-daily-')), 'daily.json');
    vi.stubEnv('TAG_SIMILARITY_DAILY_FILE', file);
    vi.resetModules();
    const { loadDailyRelations } = await import('./similarity.ts');
    const chain = { where: async () => [], leftJoin: () => chain };
    const select = vi.fn(() => ({ from: () => chain }));
    const db = { select } as unknown as Db;
    const now = new Date('2026-10-15T04:00:00Z');
    expect(await loadDailyRelations(db, '2026-10-01', '2026-10-02', 0.65, now)).toEqual([]);
    expect(select).toHaveBeenCalledTimes(1);
    expect(Object.keys(JSON.parse(readFileSync(file, 'utf8')))).toEqual(['0.65|2026-10-01', '0.65|2026-10-02']);
    await loadDailyRelations(db, '2026-10-01', '2026-10-02', 0.65, now);
    expect(select).toHaveBeenCalledTimes(1);
    // The last three days are not settled yet and are always hydrated.
    await loadDailyRelations(db, '2026-10-14', '2026-10-15', 0.65, now);
    await loadDailyRelations(db, '2026-10-14', '2026-10-15', 0.65, now);
    expect(select).toHaveBeenCalledTimes(3);
    vi.unstubAllEnvs();
  });
});

describe('citation sources in the daily table', () => {
  it('skips parsing leftovers but keeps outlets', async () => {
    const { CITATION_RESIDUE } = await import('./similarity.ts');
    for (const junk of [
      '•以上言論由東森健康授權轉載，不代表東森新聞立場。',
      '作者：財訊雙週刊',
      '撰文‧今周刊編輯團隊',
      '民視新聞 徐婉寧',
      '《新聞直擊》製作組',
    ])
      expect(CITATION_RESIDUE.test(junk), junk).toBe(true);
    for (const outlet of ['焦點時報', '中天電視台', 'people_daily', 'EBC 東森新聞', '敏迪選讀Mindi World News'])
      expect(CITATION_RESIDUE.test(outlet), outlet).toBe(false);
  });
});
