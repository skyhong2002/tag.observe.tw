import * as cheerio from 'cheerio';
import type { Site } from '../news-site-rules.ts';
import type { SourceSpec } from '../sources.ts';

// The model's reply (docs/generated-crawl-rules.md). It is declarative data in
// the shape of the hand-written NewsSiteRules and SourceSpec.list: nothing it
// returns is executed. Strict JSON schema needs every field present, so an
// unused optional field is null.

const PUBLICATION_FORMATS = ['epoch-ms', 'epoch-seconds', 'day-first', 'utc', 'roc'] as const;
const nullable = (type: string, extra: object = {}) => ({ type: [type, 'null'], ...extra });
const hostRuleSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'host',
    'path',
    'bodySelector',
    'bodyExcludeSelector',
    'titleSelector',
    'titlePattern',
    'authorSelector',
    'authorPattern',
    'publishedSelector',
    'publishedAttribute',
    'publicationPattern',
    'publicationFormat',
    'tagSelector',
    'plainTextBody',
  ],
  properties: {
    host: { type: 'string', maxLength: 253 },
    path: { type: 'string', maxLength: 300 },
    bodySelector: { type: 'string', maxLength: 300 },
    bodyExcludeSelector: nullable('string', { maxLength: 500 }),
    titleSelector: nullable('string', { maxLength: 300 }),
    titlePattern: nullable('string', { maxLength: 300 }),
    authorSelector: nullable('string', { maxLength: 300 }),
    authorPattern: nullable('string', { maxLength: 300 }),
    publishedSelector: nullable('string', { maxLength: 300 }),
    publishedAttribute: nullable('string', { maxLength: 40 }),
    publicationPattern: nullable('string', { maxLength: 300 }),
    publicationFormat: { type: ['string', 'null'], enum: [...PUBLICATION_FORMATS, null] },
    tagSelector: nullable('string', { maxLength: 300 }),
    plainTextBody: { type: 'boolean' },
  },
};
export const RULES_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['hostRules', 'listing', 'render', 'noArticles', 'unfixable', 'notes'],
  properties: {
    hostRules: { type: 'array', maxItems: 4, items: hostRuleSchema },
    listing: {
      type: ['object', 'null'],
      additionalProperties: false,
      required: ['urls', 'include', 'discoverPattern', 'discoverTitleSelector'],
      properties: {
        urls: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'string', maxLength: 2048 } },
        include: nullable('string', { maxLength: 300 }),
        discoverPattern: nullable('string', { maxLength: 300 }),
        discoverTitleSelector: nullable('string', { maxLength: 300 }),
      },
    },
    render: { type: 'boolean' },
    noArticles: { type: 'boolean' },
    unfixable: { type: 'boolean' },
    notes: { type: 'string', maxLength: 1000 },
  },
};

export type RawHostRule = {
  host: string;
  path: string;
  bodySelector: string;
  bodyExcludeSelector: string | null;
  titleSelector: string | null;
  titlePattern: string | null;
  authorSelector: string | null;
  authorPattern: string | null;
  publishedSelector: string | null;
  publishedAttribute: string | null;
  publicationPattern: string | null;
  publicationFormat: (typeof PUBLICATION_FORMATS)[number] | null;
  tagSelector: string | null;
  plainTextBody: boolean;
};
export type RawRules = {
  hostRules: RawHostRule[];
  listing: { urls: string[]; include: string | null; discoverPattern: string | null; discoverTitleSelector: string | null } | null;
  render: boolean;
  noArticles: boolean;
  /** The pages plainly lack what was asked (video stories with a caption, no printed tags). */
  unfixable: boolean;
  notes: string;
};
export type CompiledRules = { sites: Site[]; list: Partial<SourceSpec['list']> | null; render: boolean };

// Nested quantifiers such as (a+)+ or (\w*)* backtrack exponentially on the
// page text they are matched against.
const NESTED_QUANTIFIER = /\((?:[^()\\]|\\.)*[+*}](?:[^()\\]|\\.)*\)\s*(?:[+*]|\{\d+,?\d*\})/;
export function safePattern(source: string, flags = 'u'): RegExp {
  if (source.length > 300) throw Error('pattern too long');
  if (NESTED_QUANTIFIER.test(source)) throw Error(`nested quantifier in ${source}`);
  if (/\\\d/.test(source)) throw Error(`backreference in ${source}`);
  return new RegExp(source, flags);
}
function safeSelector(selector: string) {
  if (selector.length > 500 || /[{}]/.test(selector)) throw Error(`unusable selector ${selector}`);
  // cheerio throws on a selector it cannot parse
  cheerio.load('<p></p>')(selector);
  return selector;
}
const hostOf = (value: string) => value.toLowerCase().replace(/^www\./, '');
/** The outlet's own hosts, and their subdomains, are the only ones a rule may name. */
export const hostAllowed = (host: string, owned: string[]) => owned.some((own) => host === own || host.endsWith(`.${own}`));

/** Checks and compiles the model's reply; throws with the first problem found. Host rules may name only
 * `owned` hosts; a listing (which applies to this outlet alone) may also use `listingHosts`, such as a host
 * the outlet shares with a sister outlet. */
export function compileRules(raw: RawRules, owned: string[], listingHosts: string[] = owned): CompiledRules {
  const optional = <T, R>(value: T | null, check: (v: T) => R): R | undefined => (value == null || value === '' ? undefined : check(value));
  const sites = raw.hostRules.map((rule): Site => {
    const host = hostOf(rule.host.trim());
    if (!/^[a-z0-9.-]+$/.test(host) || !hostAllowed(host, owned)) throw Error(`host ${rule.host} is not the outlet's`);
    if (rule.publishedAttribute && !/^[a-z][a-z0-9:_-]*$/i.test(rule.publishedAttribute))
      throw Error(`attribute ${rule.publishedAttribute}`);
    return {
      host,
      path: safePattern(rule.path, ''),
      bodySelector: safeSelector(rule.bodySelector),
      bodyExcludeSelector: optional(rule.bodyExcludeSelector, safeSelector),
      titleSelector: optional(rule.titleSelector, safeSelector),
      titlePattern: optional(rule.titlePattern, (p) => safePattern(p)),
      authorSelector: optional(rule.authorSelector, safeSelector),
      authorPattern: optional(rule.authorPattern, (p) => safePattern(p)),
      publishedSelector: optional(rule.publishedSelector, safeSelector),
      // null in the hand-written rules means "visible text"; leave it unset for datetime-or-text.
      publishedAttribute: rule.publishedAttribute === 'text' ? null : (rule.publishedAttribute ?? undefined),
      publicationPattern: optional(rule.publicationPattern, (p) => safePattern(p)),
      publicationFormat: rule.publicationFormat ?? undefined,
      tagSelector: optional(rule.tagSelector, safeSelector),
      plainTextBody: rule.plainTextBody || undefined,
    };
  });
  let list: CompiledRules['list'] = null;
  if (raw.listing) {
    const urls = raw.listing.urls.map((value) => {
      const url = new URL(value);
      if (!/^https?:$/.test(url.protocol) || !hostAllowed(hostOf(url.hostname), [...owned, ...listingHosts]))
        throw Error(`listing ${value} is not the outlet's`);
      return { cat: '', url: url.href };
    });
    // Checked here, stored as written: SourceSpec.list keeps pattern strings.
    const checked = (p: string) => {
      safePattern(p, '');
      return p;
    };
    const include = optional(raw.listing.include, checked);
    const pattern = optional(raw.listing.discoverPattern, checked);
    list = {
      urls,
      include,
      discover: pattern ? { pattern, titleSelector: optional(raw.listing.discoverTitleSelector, safeSelector) } : undefined,
    };
  }
  if (!sites.length && !list) throw Error('neither host rules nor a listing');
  return { sites, list, render: raw.render };
}

/** The source as crawled with generated rules: a listing replaces the old one
 * (keeping its article identity rule and user agent), rendering skips curl. */
export function applyRules(spec: SourceSpec, rules: Pick<CompiledRules, 'list' | 'render'>): SourceSpec {
  const list = rules.list
    ? {
        urls: rules.list.urls ?? [],
        include: rules.list.include,
        discover: rules.list.discover,
        articleId: spec.list.articleId,
        userAgent: spec.list.userAgent,
      }
    : spec.list;
  return {
    ...spec,
    ...(spec.group === 'off' ? { group: 'hourly' as const } : {}),
    ...(rules.render ? { render: true } : {}),
    list: rules.render ? { ...list, curl: undefined } : list,
  };
}
