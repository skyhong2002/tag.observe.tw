import type { CheerioAPI } from 'cheerio';
import { articleNodes } from './article-content.ts';
import { urlKey } from './text.ts';

/** This template prints publication but puts the later modification in datetime.
 * Corroborate both clocks before using its explicit zone to correct false UTC. */
export function epochPublicationClock($: CheerioAPI, value: string): string | null {
  const url = new URL(value);
  if (!['www.epochtimes.com', 'epochtimes.com'].includes(url.hostname)) return null;
  const time = $('main#main .main_content > .article:has(> #artbody[itemprop="articleBody"]) > .info > time[datetime]').first();
  const modified = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(\+08:00)$/.exec(time.attr('datetime') ?? '');
  const printed = /^更新\s+(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})\s+(AM|PM)$/i.exec(time.text().trim());
  if (!modified || !printed || Number(printed[2]) < 1 || Number(printed[2]) > 12 || Number(printed[3]) > 59) return null;
  const hour = (Number(printed[2]) % 12) + (printed[4].toUpperCase() === 'PM' ? 12 : 0);
  const clock = `${printed[1]}T${String(hour).padStart(2, '0')}:${printed[3]}`;
  const records = articleNodes($, value).filter((node) => {
    const entity = node.mainEntityOfPage;
    const identities = [node.url, node['@id'], typeof entity === 'object' && entity ? (entity as Record<string, unknown>)['@id'] : entity];
    return identities.some((raw) => {
      if (typeof raw !== 'string') return false;
      try {
        return urlKey(new URL(raw, value).href) === urlKey(value);
      } catch {
        return false;
      }
    });
  });
  if (records.length !== 1) return null;
  const published = records[0].datePublished;
  const updated = records[0].dateModified;
  if (typeof published !== 'string' || typeof updated !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(published))
    return null;
  if (updated !== `${modified[1]}Z` || published.slice(0, 16) !== clock) return null;
  const publication = new Date(published);
  const update = new Date(updated);
  if (
    !Number.isFinite(+publication) ||
    !Number.isFinite(+update) ||
    +publication > +update ||
    publication.toISOString() !== published.replace(/Z$/, '.000Z')
  )
    return null;
  return published.slice(0, -1) + modified[2];
}
