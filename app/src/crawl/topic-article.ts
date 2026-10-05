import * as cheerio from 'cheerio';

/** These publisher index cards are individual profile interviews, not collections. */
export function standaloneTopicListing(media: string, url: string, title: string): boolean {
  return media === 'udn' && /^https:\/\/topic\.udn\.com\/event\//.test(url) && /優人物/.test(title);
}

/** UDN dated profile pages use a chaptered article template; other event microsites can be packages. */
export function standaloneTopicPage(html: string, url: string, storyCount: number): boolean {
  if (storyCount || !/^https:\/\/topic\.udn\.com\/event\/\d{4}_\d{4}\/?$/.test(url)) return false;
  const $ = cheerio.load(html);
  return $('#mainbar.article-holder > article.article-item .container p').filter((_i, e) => $(e).text().trim().length > 40).length >= 2;
}
