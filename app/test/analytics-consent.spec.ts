import { describe, expect, it } from 'vitest';
import {
  analyticsBlock,
  readOptOut,
  selectContentTarget,
  shouldReportLiveboardActivity,
  writeOptOut,
} from '../../web/src/lib/analytics-consent.mts';

const reader = {
  production: true,
  hostname: 'tag.observe.tw',
  webdriver: false,
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  optedOut: false,
};

describe('who sends GA data', () => {
  it('tracks an ordinary reader on the production site', () => {
    expect(analyticsBlock(reader)).toBeNull();
    expect(analyticsBlock({ ...reader, webdriver: undefined })).toBeNull();
  });
  it('never tracks automation, opted-out browsers or other hosts', () => {
    expect(analyticsBlock({ ...reader, webdriver: true })).toBe('automation');
    expect(analyticsBlock({ ...reader, userAgent: reader.userAgent.replace('Chrome/', 'HeadlessChrome/') })).toBe('automation');
    expect(analyticsBlock({ ...reader, userAgent: `${reader.userAgent} Chrome-Lighthouse` })).toBe('automation');
    expect(analyticsBlock({ ...reader, optedOut: true })).toBe('opt-out');
    expect(analyticsBlock({ ...reader, hostname: 'localhost' })).toBe('environment');
    expect(analyticsBlock({ ...reader, production: false })).toBe('environment');
    expect(analyticsBlock({ ...reader, pathname: '/liveboards/' })).toBeNull();
  });
  it('counts liveboard readers while respecting their opt-out and excluding automation', () => {
    for (const pathname of ['/liveboard', '/liveboard/']) {
      expect(analyticsBlock({ ...reader, pathname })).toBeNull();
      expect(analyticsBlock({ ...reader, pathname, optedOut: true })).toBe('opt-out');
      expect(analyticsBlock({ ...reader, pathname, webdriver: true })).toBe('automation');
    }
  });
  it('remembers and restores the opt-out, and treats unreadable storage as not opted out', () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    };
    expect(readOptOut(storage)).toBe(false);
    writeOptOut(storage, true);
    expect(readOptOut(storage)).toBe(true);
    writeOptOut(storage, false);
    expect(readOptOut(storage)).toBe(false);
    expect(
      readOptOut({
        getItem: () => {
          throw Error('SecurityError');
        },
      }),
    ).toBe(false);
    expect(readOptOut(null)).toBe(false);
  });
});

describe('liveboard activity', () => {
  it('reports only visible boards, respecting opt-out and navigation away', () => {
    expect(shouldReportLiveboardActivity('/liveboard', 'visible', false)).toBe(true);
    expect(shouldReportLiveboardActivity('/liveboard/', 'visible', false)).toBe(true);
    expect(shouldReportLiveboardActivity('/liveboard/', 'hidden', false)).toBe(false);
    expect(shouldReportLiveboardActivity('/liveboard/', 'visible', true)).toBe(false);
    expect(shouldReportLiveboardActivity('/', 'visible', false)).toBe(false);
    expect(shouldReportLiveboardActivity('/liveboards/', 'visible', false)).toBe(false);
  });
});

describe('select_content target ids', () => {
  it('sends event thread ids and tag text', () => {
    expect(selectContentTarget('/eve/897/')).toEqual({ content_type: 'event', content_id: '897' });
    expect(selectContentTarget('/tag/%E8%94%A1%E8%8B%B1%E6%96%87/')).toEqual({ content_type: 'tag', content_id: '蔡英文' });
    expect(selectContentTarget('/tag/COVID-19')).toEqual({ content_type: 'tag', content_id: 'COVID-19' });
  });
  it('drops ids that are not plain public content', () => {
    expect(selectContentTarget('/eve/abc/')).toEqual({ content_type: 'event' });
    expect(selectContentTarget('/tag/%E0%A4%A/')).toEqual({ content_type: 'tag' });
    expect(selectContentTarget(`/tag/${encodeURIComponent('a'.repeat(101))}/`)).toEqual({ content_type: 'tag' });
    expect(selectContentTarget('/tag/%3Cscript%3E/')).toEqual({ content_type: 'tag' });
    expect(selectContentTarget('/tag/someone%40mail.test/')).toEqual({ content_type: 'tag' });
    expect(selectContentTarget('/tag/a%2Fb/')).toEqual({ content_type: 'tag' });
    expect(selectContentTarget('/ranking/')).toBeNull();
  });
});
