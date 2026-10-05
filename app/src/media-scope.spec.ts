import { describe, expect, it } from 'vitest';
import countries from '../data/media-countries.json' with { type: 'json' };
import registry from '../data/media-scope.json' with { type: 'json' };
import { allSources } from './crawl/registry.ts';
import { mediaScope } from './media-scope.ts';
import { listedMediaSources } from './v1/media-stats.ts';

describe('media scope labels', () => {
  it('labels every listed outlet; only Taiwan outlets may rely on the default', () => {
    for (const { media } of listedMediaSources(allSources())) {
      expect(mediaScope(media), media).not.toBeNull();
    }
    for (const [media, entry] of Object.entries(countries.media as Record<string, { countryCode: string }>)) {
      if (entry.countryCode !== 'TW') expect(Object.keys(registry.media), media).toContain(media);
    }
    expect(mediaScope('unknown-outlet')).toBeNull();
  });

  it('uses only the declared scopes, languages and roles', () => {
    for (const [media, entry] of Object.entries(registry.media as Record<string, { scope: string; language: string; roles?: string[] }>)) {
      expect(Object.keys(registry.scopes), media).toContain(entry.scope);
      expect(Object.keys(registry.languages), media).toContain(entry.language);
      for (const role of entry.roles ?? []) expect(Object.keys(registry.roles), media).toContain(role);
    }
  });

  it('keeps wire agencies as wires and says which edition is collected', () => {
    expect(mediaScope('reuters')).toMatchObject({ scope: 'intl-zh', language: 'zh-Hant', roles: [{ role: 'wire', label: '通訊社' }] });
    expect(mediaScope('reuters')?.coverage).toContain('LINE TODAY');
    expect(mediaScope('afp')).toMatchObject({ language: 'en', roles: [{ role: 'wire' }] });
    expect(mediaScope('afp')?.coverage).toContain('Fact Check');
    expect(mediaScope('xinhua')?.roles.map((r) => r.role)).toEqual(['wire']);
    expect(mediaScope('ltn')).toEqual({
      scope: 'tw',
      scopeLabel: '台灣媒體',
      language: 'zh-Hant',
      languageLabel: '繁體中文',
      roles: [],
      coverage: null,
    });
    expect(mediaScope('taipeitimes')).toMatchObject({ scope: 'tw-foreign', language: 'en' });
  });
});
