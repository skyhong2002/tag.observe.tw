import type { CheerioAPI } from 'cheerio';
import { reporterNames } from './byline.ts';

/** The embedded article record independently corroborates its visible byline. */
export function thePaperCredits($: CheerioAPI, value: string): { authors: string[]; provider: string | null } | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const id = /^\/newsDetail_forward_(\d+)$/.exec(url.pathname)?.[1];
  if (!['www.thepaper.cn', 'thepaper.cn'].includes(url.hostname) || !id) return null;
  const heading = $('main h1');
  const byline = $('main [class^="headerContent__"] > [class^="left__"] > div:first-child:not(.ant-space-item):not(:has(.ant-space-item))');
  if (heading.length !== 1 || byline.length !== 1 || $('#__NEXT_DATA__').length !== 1) return null;
  const text = (value: string) => value.replace(/\s+/g, ' ').trim();
  const credit = text(byline.text());
  try {
    const props = JSON.parse($('#__NEXT_DATA__').text()).props?.pageProps;
    const detail = props?.detailData?.contentDetail;
    if (
      String(props?.contId) !== id ||
      String(detail?.contId) !== id ||
      typeof detail?.name !== 'string' ||
      text(detail.name) !== text(heading.text()) ||
      typeof detail.author !== 'string' ||
      text(detail.author) !== credit ||
      !['1', '2'].includes(detail.originalFlag)
    )
      return null;
    const reporters =
      /^澎湃新闻记者\s+([\p{Script=Han}]{2,5}(?:\s+[\p{Script=Han}]{2,5}){0,6}?)(?:\s+(?:见习记者|实习生)\s+([\p{Script=Han}]{2,5}(?:\s+[\p{Script=Han}]{2,5}){0,4}))?$/u.exec(
        credit,
      );
    if (reporters) {
      const names = [reporters[1], reporters[2]].filter(Boolean).flatMap((part) => part.split(/\s+/u));
      const authors = reporterNames(`记者：${names.join('、')}`);
      return authors.length ? { authors, provider: null } : null;
    }
    if (detail.originalFlag !== '2') return null;
    if (credit === '新华社') return { authors: [credit], provider: credit };
    if (credit === '新华网客户端') return { authors: [credit], provider: '新华网' };
    const partner = /^([\p{Script=Han}]{2,5})\/新华网客户端$/u.exec(credit);
    if (partner) {
      const authors = reporterNames(`作者：${partner[1]}`);
      return authors.length ? { authors, provider: '新华网' } : null;
    }
  } catch {
    // Malformed or unrelated embedded state never proves an author.
  }
  return null;
}
