import { describe, expect, it } from 'vitest';
import { publisherDomains } from '../src/jobs/media-traffic-job.ts';

describe('publisherDomains', () => {
  const domains = publisherDomains();

  it('measures TVBS, 東森 and 自由時報 on the whole domain, not on their news.* subdomain', () => {
    for (const parent of ['tvbs.com.tw', 'ebc.net.tw', 'ltn.com.tw']) expect(domains).toContain(parent);
    for (const sub of ['news.tvbs.com.tw', 'news.ebc.net.tw', 'news.ltn.com.tw']) expect(domains).not.toContain(sub);
  });

  it('keeps 公視 and 華視 on news.*, since their parent domains run separate programme sites', () => {
    expect(domains).toContain('news.pts.org.tw');
    expect(domains).toContain('news.cts.com.tw');
  });

  it('lists each domain once', () => {
    expect(new Set(domains).size).toBe(domains.length);
  });
});
