import type { CheerioAPI } from 'cheerio';

interface DeclaredItem {
  '@id'?: string;
  '@type'?: string;
  name?: string;
  url?: string;
  headline?: string;
  mainEntityOfPage?: string | { '@id'?: string };
  author?: { '@id'?: string; '@type'?: string; name?: string; url?: string };
}

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();

/** The publisher's shared book-excerpt account is a content category, not a named journalist. */
export function voicettankAuthors($: CheerioAPI, value: string): string[] | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.origin !== 'https://voicettank.org' || !/^\/\d{8}-\d+\/$/.test(url.pathname) || url.search || url.hash) return null;
  for (const [selector, attribute] of [
    ['link[rel="canonical"]', 'href'],
    ['meta[property="og:url"]', 'content'],
  ] as const) {
    const nodes = $(selector);
    if (nodes.length !== 1 || nodes.attr(attribute) !== value) return null;
  }
  const meta = $('meta[name="author"]');
  if (meta.length !== 1 || meta.attr('content') !== '【書摘】') return null;
  const classes = ($('body').attr('class') ?? '').split(/\s+/);
  const ids = classes.filter((name) => /^postid-\d+$/.test(name));
  if (!classes.includes('single-post') || ids.length !== 1) return null;
  const own = $(`article#post-${ids[0].slice(7)}.post.type-post`);
  const heading = own.find('.header-standard.single-header > h1.entry-title');
  if (own.length !== 1 || heading.length !== 1 || $('h1').length !== 1 || !own.children('.post-entry').length) return null;
  const title = clean(heading.text());
  if (!/^【書摘】《.+》$/.test(title)) return null;
  const og = $('meta[property="og:title"]');
  if (og.length !== 1 || clean(og.attr('content') ?? '') !== `${title} – 思想坦克｜Voicettank`) return null;
  const account = 'https://voicettank.org/author/1234567890/';
  const authors = own.find('.author.vcard > a.author-url');
  if (authors.length !== 2 || !authors.toArray().every((node) => clean($(node).text()) === '【書摘】' && $(node).attr('href') === account))
    return null;
  const items: DeclaredItem[] = [];
  $('script[type="application/ld+json"]').each((_, node) => {
    try {
      const data = JSON.parse($(node).text());
      items.push(...(Array.isArray(data?.['@graph']) ? data['@graph'] : Array.isArray(data) ? data : [data]));
    } catch {
      // Invalid structured declarations cannot corroborate the account's role.
    }
  });
  const articles = items.filter((item) => item && item['@type'] === 'Article');
  const blogs = items.filter((item) => item && item['@type'] === 'BlogPosting');
  const persons = items.filter((item) => item && item['@id'] === `${account}#author`);
  if (articles.length !== 1 || blogs.length !== 1 || persons.length !== 1) return null;
  const [article] = articles,
    [blog] = blogs,
    [person] = persons;
  if (
    article['@id'] !== `${value}#article` ||
    (typeof article.mainEntityOfPage === 'object' ? article.mainEntityOfPage?.['@id'] : null) !== `${value}#webpage` ||
    article.author?.['@id'] !== `${account}#author` ||
    typeof article.headline !== 'string' ||
    clean(article.headline) !== title ||
    blog.mainEntityOfPage !== value ||
    typeof blog.headline !== 'string' ||
    clean(blog.headline) !== title ||
    blog.author?.['@type'] !== 'Person' ||
    blog.author.name !== '【書摘】' ||
    blog.author.url !== account ||
    person['@type'] !== 'Person' ||
    person.name !== '【書摘】' ||
    person.url !== account
  )
    return null;
  // Do not promote a book's author or a recommended article's writer into this article's newsroom byline.
  return [];
}

/** RSS account credits must not reintroduce the known category after an empty named byline. */
export function voicettankFeedCreator(media: string, value: string | null | undefined): string | null | undefined {
  return media === 'voicettank' && value?.trim() === '【書摘】' ? null : value;
}

/** Empty extraction preserves real stored names while removing this one verified non-person account. */
export function voicettankCategoryRepair(
  media: string,
  current: { authors?: string[] | null; creator?: string | null },
  extracted: string[],
): { authors: string[]; creator: string | null } | null {
  if (media !== 'voicettank' || extracted.length) return null;
  const stored = current.authors?.length ? current.authors : current.creator ? [current.creator] : [];
  if (!stored.some((name) => name.trim() === '【書摘】')) return null;
  const authors = stored.filter((name) => name.trim() !== '【書摘】');
  return { authors, creator: authors.length ? authors.join('、').slice(0, 256) : null };
}
