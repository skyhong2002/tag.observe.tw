import * as cheerio from 'cheerio';
import { renderWsjNewsletter } from './news-wsj-newsletter.ts';

const hostKey = (url: URL) => url.hostname.toLowerCase().replace(/^www\./, '');

/** Read commented publisher JSON without evaluating JavaScript or changing URLs. */
export function parsePublicJson(raw: string): unknown {
  const input = raw.trim().replace(/^<!--/, '').replace(/-->$/, '');
  let text = '';
  let quoted = false;
  let escaped = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      text += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') {
      quoted = true;
      text += char;
    } else if (char === '/' && input[i + 1] === '/') {
      while (i < input.length && input[i] !== '\n') i++;
      text += '\n';
    } else if (char === '/' && input[i + 1] === '*') {
      const end = input.indexOf('*/', i + 2);
      if (end < 0) throw Error('Unclosed JSON comment');
      i = end + 1;
      text += ' ';
    } else text += char;
  }
  return JSON.parse(text);
}

function assignedObject(source: string, marker: RegExp): Record<string, unknown> | null {
  const match = marker.exec(source);
  if (!match) return null;
  const start = match.index + match[0].length;
  if (source[start] !== '{') return null;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let i = start; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) {
      try {
        return parsePublicJson(source.slice(start, i + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function publicArticleHtml(html: string, url: string): string {
  const host = hostKey(new URL(url));
  if (['china.createsend1.com', 'china.cmail19.com'].includes(host)) {
    if (cheerio.load(html)('script[data-news-public="wsj-newsletter"]').length) return html;
    return renderWsjNewsletter(html, url) ?? '';
  }
  if (!['taiwannews.com.tw', 'readr.tw', 'news.qq.com'].includes(host)) return html;
  const $ = cheerio.load(html);
  if ($('script[data-news-public]').length) return html;
  if (host === 'news.qq.com' && /^\/rain\/a\/[A-Z0-9]+$/.test(new URL(url).pathname)) {
    const record = assignedObject(html, /window\.DATA\s*=\s*/);
    const payment = record?.payment_column_info_v1 as Record<string, unknown> | undefined;
    const content = (record?.originContent as Record<string, unknown> | undefined)?.text;
    if (
      record?.article_id === new URL(url).pathname.split('/').at(-1) &&
      record?.article_is_pay === false &&
      payment?.is_column_pay === false &&
      payment?.is_column_article_pay === false &&
      typeof content === 'string' &&
      typeof record.pubtime === 'string'
    ) {
      const ld = JSON.stringify({
        '@type': 'NewsArticle',
        url,
        headline: record.title,
        datePublished: record.pubtime,
        articleBody: content,
      }).replace(/</g, '\\u003c');
      return `${html}<script data-news-public="qq" type="application/ld+json">${ld}</script>`;
    }
  }
  if (host === 'taiwannews.com.tw') {
    // React's server-stream transport initially hides chunks, then moves them
    // into explicit placeholders. Apply only those published move instructions;
    // unrelated hidden/paywall content remains hidden and is never harvested.
    for (const script of $('script').toArray()) {
      for (const move of $(script)
        .text()
        .matchAll(/\$(RC|RS)\("([BPS]:[\w]+)","([BPS]:[\w]+)"\)/g)) {
        const sourceId = move[1] === 'RC' ? move[3] : move[2];
        const targetId = move[1] === 'RC' ? move[2] : move[3];
        if (!sourceId.startsWith('S:')) continue;
        const source = $(`[id="${sourceId}"][hidden]`);
        const target = $(`template[id="${targetId}"]`);
        if (source.length === 1 && target.length === 1) {
          target.replaceWith(source.contents());
          source.remove();
        }
      }
    }
    return $.html();
  }
  if (host === 'readr.tw' && /^\/post\/\d+\/?$/.test(new URL(url).pathname)) {
    try {
      const record = JSON.parse($('#__NEXT_DATA__').text()).props.pageProps.postData;
      if (
        String(record.id) !== new URL(url).pathname.split('/')[2] ||
        record.state !== 'published' ||
        !Array.isArray(record.content?.blocks)
      )
        return html;
      const text = record.content.blocks
        .filter((block: { text?: unknown }) => typeof block.text === 'string')
        .map((block: { text: string }) => block.text)
        .join('\n\n');
      const ld = JSON.stringify({
        '@type': 'NewsArticle',
        url,
        headline: record.title,
        datePublished: record.publishTime,
        articleBody: text,
        author: Array.isArray(record.writers)
          ? record.writers.map((writer: { name: string }) => ({ '@type': 'Person', name: writer.name }))
          : [],
      }).replace(/</g, '\\u003c');
      return `${html}<script data-news-public="readr" type="application/ld+json">${ld}</script>`;
    } catch {
      return html;
    }
  }
  return html;
}
