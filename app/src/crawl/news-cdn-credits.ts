import type { CheerioAPI } from 'cheerio';

/** Match the own desktop and mobile article headers before using a named correspondent credit. */
export function cdnCorrespondent($: CheerioAPI, value: string): string | null {
  const url = new URL(value);
  if (
    !['cdn-news.org', 'www.cdn-news.org'].includes(url.hostname) ||
    url.pathname !== '/News.aspx' ||
    url.searchParams.get('EntityID') !== 'News' ||
    !/^[a-f0-9]{40,64}$/i.test(url.searchParams.get('PK') ?? '')
  )
    return null;
  const main = $('.news-details-layout2 > .container > .row.mb-20');
  const desktop = main.find('.mask-content-lg');
  const mobile = main.find('.mask-content-xs');
  const heading = desktop.children('h2.size-c34');
  const compact = (text: string) => text.replace(/\s/g, '');
  const title = compact(heading.text());
  if (
    main.length !== 1 ||
    desktop.length !== 1 ||
    mobile.length !== 1 ||
    heading.length !== 1 ||
    !title ||
    title !== compact($('title').text()) ||
    title !== compact($('meta[property="og:title"]').attr('content') ?? '')
  )
    return null;
  const deskSlots = desktop.children('ul.post-info-light').children('li');
  const mobileSlots = mobile.children('ul.post-info-light').children('li');
  const credit = deskSlots.eq(0).text().trim().replace(/\s+/g, ' ');
  const own = /^特約記者 ([\p{Script=Han}]{2,5})$/u.exec(credit);
  const date = deskSlots.eq(2).text().trim();
  if (
    !own ||
    deskSlots.eq(1).text().trim() !== '綜合報導' ||
    compact(mobileSlots.eq(0).text()) !== compact(`${credit}綜合報導`) ||
    !/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/.test(date) ||
    mobileSlots.eq(1).text().trim() !== date
  )
    return null;
  return own[1];
}
