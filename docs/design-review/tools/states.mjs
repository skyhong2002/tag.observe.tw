// Screenshot inventory for the design review. docs/design-review/states.md
// documents the same IDs; change both together and only between rounds that
// re-shoot the baseline.
//
// data:    normal | empty | error | loading   (fixture-api.mjs modes; a server restart per mode)
// session: out | in                           theme: light | dark
// review:  true = in the blind review set; the rest are shot every round for
//          the maintainer's own regression check
// click:   selectors clicked in order after load   viewportOnly: one screen only
export const SIZES = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, maxHeight: 2400 },
  mobile: { width: 390, height: 844, deviceScaleFactor: 2, maxHeight: 1688, isMobile: true, hasTouch: true },
};

const EVE = '/eve/4128/';
const TAG = `/tag/${encodeURIComponent('黃仁勳')}/`;
const TOPIC = '/topic/setn/3656074/';
const OUTLET = '/media/udn/';
const JOURNALIST = `/journalist/${encodeURIComponent('廖賢龍')}/`;
export const ARTICLE = '/article/103767383/';
const q = (s) => encodeURIComponent(s);

export const STATES = [
  // Home
  { id: 'home', path: '/', review: true },
  { id: 'home-dark', path: '/', theme: 'dark', review: true },
  { id: 'home-signed-in', path: '/', session: 'in', viewportOnly: true, review: true },
  { id: 'home-empty', path: '/', data: 'empty', warm: true },
  // Events: table and one event
  { id: 'event', path: '/event/', review: true },
  { id: 'event-dark', path: '/event/', theme: 'dark' },
  { id: 'event-hour', path: '/event/?view=hour', review: true },
  { id: 'event-empty', path: '/event/', data: 'empty', review: true },
  { id: 'event-loading', path: '/event/', data: 'loading', viewportOnly: true, review: true },
  { id: 'event-error', path: '/event/', data: 'error', viewportOnly: true },
  { id: 'eve', path: EVE, review: true },
  { id: 'eve-dark', path: EVE, theme: 'dark', review: true },
  { id: 'eve-error', path: EVE, data: 'error', viewportOnly: true, review: true },
  // Topics
  { id: 'topic', path: '/topic/', review: true },
  { id: 'topic-story', path: TOPIC, review: true },
  { id: 'topic-empty', path: '/topic/', data: 'empty' },
  { id: 'topic-loading', path: '/topic/', data: 'loading', viewportOnly: true },
  // Tag
  { id: 'tag', path: TAG, review: true },
  { id: 'tag-dark', path: TAG, theme: 'dark' },
  { id: 'tag-camp', path: `${TAG}?camp=green`, review: true },
  { id: 'tag-empty', path: TAG, data: 'empty' },
  { id: 'tag-error', path: TAG, data: 'error', viewportOnly: true },
  // Media: directory and one outlet
  { id: 'media', path: '/media/', review: true },
  { id: 'media-camp', path: '/media/?camp=green' },
  { id: 'media-outlet', path: OUTLET, review: true },
  { id: 'media-outlet-dark', path: OUTLET, theme: 'dark', review: true },
  { id: 'media-error', path: '/media/', data: 'error', viewportOnly: true },
  // Ranking
  { id: 'ranking', path: '/ranking/', review: true },
  { id: 'ranking-dark', path: '/ranking/', theme: 'dark', review: true },
  { id: 'ranking-blue', path: '/ranking/?category=blue', review: true },
  { id: 'ranking-empty', path: '/ranking/', data: 'empty' },
  { id: 'ranking-loading', path: '/ranking/', data: 'loading', viewportOnly: true },
  { id: 'ranking-error', path: '/ranking/', data: 'error', viewportOnly: true, review: true },
  // Similarity: daily and reposts
  { id: 'similarity-daily', path: '/similarity/daily/', review: true },
  { id: 'similarity-daily-empty', path: '/similarity/daily/', data: 'empty' },
  { id: 'similarity-reposts', path: '/similarity/reposts/', review: true },
  { id: 'similarity-reposts-dark', path: '/similarity/reposts/', theme: 'dark' },
  // Journalists
  { id: 'journalist', path: '/journalist/', review: true },
  { id: 'journalist-person', path: JOURNALIST, review: true },
  { id: 'journalist-empty', path: '/journalist/', data: 'empty' },
  // Article
  { id: 'article', path: ARTICLE, review: true },
  { id: 'article-dark', path: ARTICLE, theme: 'dark' },
  { id: 'article-signed-in', path: ARTICLE, session: 'in', viewportOnly: true },
  // Search
  { id: 'search', path: '/search/', review: true },
  { id: 'search-results', path: `/search/?q=${q('黃仁勳')}`, review: true },
  { id: 'search-none', path: '/search/?q=zzqxv', review: true },
  { id: 'search-loading', path: `/search/?q=${q('黃仁勳')}`, data: 'loading', viewportOnly: true },
  { id: 'search-error', path: `/search/?q=${q('黃仁勳')}`, data: 'error', viewportOnly: true },
  // My: saved and following
  { id: 'my-saved-out', path: '/my/saved/', review: true },
  { id: 'my-saved', path: '/my/saved/', session: 'in', review: true },
  { id: 'my-saved-empty', path: '/my/saved/', session: 'in', data: 'empty', review: true },
  { id: 'my-following', path: '/my/following/', session: 'in', review: true },
  { id: 'my-following-dark', path: '/my/following/', session: 'in', theme: 'dark' },
  { id: 'my-following-empty', path: '/my/following/', session: 'in', data: 'empty' },
];

// Reference sites: photographed once and reused in every round (same sizes).
// dismiss: accessible names of buttons that close a first-visit promo or dialog.
const GROUND_DISMISS = ['Ground News homepage', 'Close this dialog', 'Close promotional banner'];
export const REFERENCES = [
  { id: 'ground-news-home', url: 'https://ground.news/', dismiss: GROUND_DISMISS },
  { id: 'ground-news-story', url: 'https://ground.news/interest/nvidia', dismiss: GROUND_DISMISS },
  // allsides.com answers a Cloudflare human check to any automated browser; Verity is the same kind of bias-comparison site.
  { id: 'verity-home', url: 'https://www.improvethenews.org/', dismiss: ['Close'] },
  { id: 'google-news-tw', url: 'https://news.google.com/home?hl=zh-TW&gl=TW&ceid=TW:zh-Hant', locale: 'zh-TW' },
];

export const DATA_ORDER = ['normal', 'empty', 'error', 'loading'];
