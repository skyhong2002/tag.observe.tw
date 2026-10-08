import type { CheerioAPI } from 'cheerio';
import { urlKey } from './text.ts';

const same = (value: string) =>
  value
    .replaceAll('&nbsp;', ' ')
    .normalize('NFKC')
    .replace(/[\s\u200b-\u200d\ufeff]/g, '');

/** Remove only own marked captions and a complete own related-link tail after full prose corroboration. */
export function babyouVerifiedProse($: CheerioAPI, value: string, node: Record<string, unknown>): string | null {
  const url = new URL(value);
  if (!['babyou.me', 'www.babyou.me'].includes(url.hostname) || !/^\/[^/]+\/?$/.test(url.pathname)) return null;
  const canonical = $('link[rel="canonical"]').attr('href');
  const heading = $('h1');
  const container = $('.elementor-widget-theme-post-content > .elementor-widget-container');
  if (
    !canonical ||
    urlKey(canonical) !== urlKey(value) ||
    heading.length !== 1 ||
    container.length !== 1 ||
    typeof node.url !== 'string' ||
    urlKey(node.url) !== urlKey(value) ||
    typeof node.headline !== 'string' ||
    same(node.headline) !== same(heading.text()) ||
    typeof node.articleBody !== 'string'
  )
    return null;
  const children = container.children().toArray();
  const marker = children.findIndex((n) => {
    if (!$(n).is('p')) return false;
    const copy = $(n).clone();
    copy.find('a,br').remove();
    return /^(?:【延伸閱讀】|延伸閱讀)[：:]?$/.test(copy.text().trim());
  });
  if (marker < 0) return null;
  const tail = children.slice(marker);
  const links = tail.flatMap((n) => $(n).find('a').toArray());
  if (
    !links.length ||
    tail.some(
      (n, i) =>
        !$(n).is('p') ||
        (i > 0 &&
          same($(n).text()) !==
            same(
              $(n)
                .find('a')
                .map((_, a) => $(a).text())
                .get()
                .join(''),
            )),
    )
  )
    return null;
  for (const link of links) {
    try {
      const target = new URL($(link).attr('href') ?? '', value);
      if (target.hostname !== url.hostname || urlKey(target.href) === urlKey(value)) return null;
    } catch {
      return null;
    }
  }
  const prose = children
    .slice(0, marker)
    .filter((n) => {
      if ($(n).is('figure.wp-caption')) return false;
      if (!$(n).is('div#ez-toc-container')) return true;
      const anchors = $(n)
        .find('a')
        .toArray()
        .filter((anchor) => !($(anchor).is('.ez-toc-toggle') && $(anchor).attr('href') === '#'));
      // This marked navigation can be omitted only when every link targets an own heading.
      return (
        !anchors.length ||
        anchors.some((anchor) => {
          const href = $(anchor).attr('href');
          if (!href?.startsWith('#')) return true;
          let id: string;
          try {
            id = decodeURIComponent(href.slice(1));
          } catch {
            return true;
          }
          return !container
            .find('h2,h3,h4')
            .toArray()
            .some(
              (heading) =>
                [id, href.slice(1)].includes($(heading).attr('id') ?? '') ||
                $(heading)
                  .find('[id]')
                  .toArray()
                  .some((child) => [id, href.slice(1)].includes($(child).attr('id') ?? '')),
            );
        })
      );
    })
    .map((n) => {
      const copy = $(n).clone();
      copy.find('br').replaceWith('\n');
      copy.find('li').append('\n\n');
      return copy
        .text()
        .replace(/[\u200b-\u200d\ufeff]/g, '')
        .replace(/[^\S\n]+/g, ' ')
        .trim();
    })
    .filter(Boolean)
    .join('\n\n');
  if (same(prose).length < 200) return null;
  let failed = false;
  const stripped = node.articleBody.replace(
    /\[caption\b([^\]]*)\]([\s\S]*?)\[\/caption\]/g,
    (whole, attributes: string, caption: string) => {
      const id = /\bid="(attachment_\d+)"/.exec(attributes)?.[1];
      if (!id) {
        failed = true;
        return whole;
      }
      const own = container.find(`figure.wp-caption[id="${id}"] > figcaption.wp-caption-text`);
      if (own.length !== 1 || same(own.text()) !== same(caption)) {
        failed = true;
        return whole;
      }
      return '';
    },
  );
  if (failed || /\[\/?caption\b/.test(stripped)) return null;
  const related = tail.map((n) => $(n).text()).join('');
  const withoutMarker = related.replace(/^\s*(?:【延伸閱讀】|延伸閱讀)[：:]?\s*/, '');
  if (![prose + related, prose + withoutMarker].some((candidate) => same(candidate) === same(stripped))) return null;
  return prose;
}
