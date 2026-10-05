export const SITE_ORIGIN = 'https://tag.observe.tw';
export const SITE_NAME = '新文易數';
export const SITE_DESCRIPTION = '同一件事，各家怎麼說。台灣新聞總覽、媒體標題對照與關鍵字排行，追蹤熱門事件與議題趨勢。';

// Page params in this Next version can retain percent encoding. Decode once,
// while allowing a literal '%' in tags without throwing during metadata render.
export function decodeRouteParam(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function pageMetadata(path: string, title: string, description: string, generatedImage = false) {
  const url = SITE_ORIGIN + path;
  const fullTitle = title === SITE_NAME ? '新文易數：同一件事，各家怎麼說' : `${title} · ${SITE_NAME}`;
  const images = [{ url: SITE_ORIGIN + '/opengraph-image.png', width: 1200, height: 630, alt: fullTitle }];
  return {
    title: { absolute: fullTitle },
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website' as const,
      locale: 'zh_TW',
      siteName: SITE_NAME,
      title: fullTitle,
      description,
      url,
      ...(!generatedImage ? { images } : {}),
    },
    twitter: { card: 'summary_large_image' as const, title: fullTitle, description, ...(!generatedImage ? { images } : {}) },
  };
}

// Only substantive archive/category parameters belong in canonical URLs.
// Sorting, presentation, UTM tags and fragments never create another canonical.
export function canonicalQuery(path: string, values: Record<string, string | undefined>) {
  const query = new URLSearchParams(Object.entries(values).filter((entry): entry is [string, string] => Boolean(entry[1])));
  return path + (query.size ? `?${query}` : '');
}

export function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function pageSchema(
  path: string,
  name: string,
  parents: Array<[string, string]> = [],
  items?: Array<{ name: string; path: string }>,
) {
  const url = SITE_ORIGIN + path;
  const breadcrumb = {
    '@type': 'BreadcrumbList',
    '@id': `${url}#breadcrumb`,
    itemListElement: [['/', SITE_NAME], ...parents, [path, name]].map(([href, label], index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: label,
      item: SITE_ORIGIN + href,
    })),
  };
  return {
    '@context': 'https://schema.org',
    '@graph': [
      breadcrumb,
      {
        '@type': items ? 'CollectionPage' : 'WebPage',
        '@id': url,
        url,
        name,
        inLanguage: 'zh-Hant',
        isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
        breadcrumb: { '@id': breadcrumb['@id'] },
        ...(items
          ? {
              mainEntity: {
                '@type': 'ItemList',
                itemListElement: items.map((item, index) => ({
                  '@type': 'ListItem',
                  position: index + 1,
                  name: item.name,
                  url: SITE_ORIGIN + item.path,
                })),
              },
            }
          : {}),
      },
    ],
  };
}

/** Use the same calendar validation for metadata and the rendered archive. */
export function archiveDay(value: unknown): string | undefined {
  return typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
    ? value
    : undefined;
}

/** A source title/description alone is not a useful standalone search result. */
export function articleIndexable(
  content: { status: string; body: string | null },
  related: { events: unknown[]; otherMedia: unknown[] } | null,
  similar: { indexedAt: string | null; chars: number | null; matches: unknown[] } | null,
) {
  return Boolean(
    (content.status !== 'expired' && content.body?.trim()) ||
      related?.events.length ||
      related?.otherMedia.length ||
      (similar?.indexedAt && similar.chars !== null && similar.matches.length),
  );
}
