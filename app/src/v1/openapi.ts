import type { FastifyInstance } from 'fastify';
import { MAX_LIMIT, MAX_SPAN_DAYS } from './articles.ts';

// OpenAPI 3.1 description of the public /api/v1 endpoints. It is the single
// source for GET /api/v1/openapi.json, the /api/v1 index, the /api/ docs page
// and docs/api.md (tools/gen-api-docs.ts); app/test/api-docs.spec.ts fails
// when a registered route is missing here, and tools/check-openapi.ts checks
// live responses against the schemas.

type Schema = Record<string, unknown>;
const d = (description?: string) => (description ? { description } : {});
const str = (description?: string, extra: Schema = {}): Schema => ({ type: 'string', ...d(description), ...extra });
const time = (description?: string) => str(description, { format: 'date-time' });
const int = (description?: string): Schema => ({ type: 'integer', ...d(description) });
const num = (description?: string): Schema => ({ type: 'number', ...d(description) });
const bool = (description?: string): Schema => ({ type: 'boolean', ...d(description) });
// A nullable $ref is inlined: `type: [<ref's type>, 'null']` has no other 3.1 spelling short of oneOf.
const nullable = (s: Schema): Schema => {
  const base = typeof s.$ref === 'string' ? schemas[s.$ref.split('/').pop() as string] : s;
  return { ...base, type: [base.type, 'null'] };
};
const arr = (items: Schema, description?: string): Schema => ({ type: 'array', items, ...d(description) });
const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` });
const map = (values: Schema, description?: string): Schema => ({ type: 'object', additionalProperties: values, ...d(description) });
/** Object whose listed properties are all required unless named in `optional`. */
const obj = (properties: Record<string, Schema>, description?: string, optional: string[] = []): Schema => ({
  type: 'object',
  ...d(description),
  properties,
  required: Object.keys(properties).filter((k) => !optional.includes(k)),
});

const camp = str('政治傾向分組：blue 藍營傾向、green 綠營傾向、other 其他（依 app/data/media-catalog.json）', {
  enum: ['blue', 'green', 'other'],
});

const schemas: Record<string, Schema> = {
  Error: obj({ error: str('錯誤代碼或說明') }, '錯誤回應', []),
  MediaKey: str('媒體代碼，例如 cna、ltn、udn；完整清單見 /api/v1/media', { pattern: '^[a-z0-9_]+$' }),
  Headline: obj(
    {
      id: nullable(int('文章 id（舊資料可能為 null）')),
      media: ref('MediaKey'),
      title: str('標題'),
      url: str('原文網址'),
      image: nullable(str('代表圖網址')),
    },
    '事件代表新聞',
    ['id'],
  ),
  Article: obj(
    {
      id: int('文章 id'),
      media: ref('MediaKey'),
      title: str('標題'),
      url: str('原文網址'),
      image: nullable(str('代表圖網址')),
      publishedAt: time('發布時間（UTC）'),
      tags: arr(str(), '文章標籤'),
    },
    '文章',
  ),
  RankingEntry: obj({
    rank: int('依原始分數的名次'),
    position: int('在本次回應排序中的位置（從 1 起）'),
    tag: str('標籤'),
    score: num('原始分數：每篇文章 +1，同一媒體的第 2、3… 篇遞減為 0.5、0.25…'),
    count: int('過去 24 小時帶這個標籤的文章數'),
    media: map(int(), '各媒體的文章數'),
    normalized: num('以發文媒體數正規化後的分數'),
    burst: num('爆發力：與 3/6/12/24/48 小時前正規化分數比較的加權差（權重 0.92/0.84/0.7/0.5/0.25）'),
    history: map(nullable(num()), 'N 小時前的正規化分數（鍵為 3、6、12、24、48；當時沒有快照為 null）'),
  }),
  CoverageArticle: obj({
    id: int(),
    title: str(),
    url: str(),
    image: nullable(str()),
    publishedAt: time(),
    hits: int('這篇文章帶了幾個事件主要標籤'),
  }),
  TopicItem: obj({
    id: str('議題 id'),
    time: time('首次看到的時間'),
    backlog: bool('true 表示開始追蹤該媒體時就已上架，time 只是開始追蹤的時間'),
    title: str('議題名稱'),
    url: str('媒體的專題頁網址'),
    image: nullable(str()),
  }),
};

// Body comparison and retained article content are separate from headline search.
schemas.OutletIdentity = obj({ media: str(), name: str(), country: str(), countryCode: str() });
schemas.Attribution = obj({
  media: str(),
  name: str(),
  country: str(),
  countryCode: str(),
  evidence: str(),
  kind: str(undefined, { enum: ['explicit'] }),
});
schemas.SimilarityArticle = obj({
  id: int(),
  media: str(),
  mediaTitle: str(),
  country: str(),
  countryCode: str(),
  title: str(),
  url: str(),
  publishedAt: time(),
  authors: arr(str()),
  bodyLength: int(),
  attributions: arr(ref('Attribution')),
});
schemas.SimilarityPair = obj({
  id: str(),
  a: ref('SimilarityArticle'),
  b: ref('SimilarityArticle'),
  score: num('正規化內文五字片段的 Dice 相似度'),
  containment: num('共同片段占較短文章片段的比例'),
  sharedShingles: int(),
  kind: str(undefined, { enum: ['identical', 'high'] }),
  evidence: str('最多 100 字的連續相同片段'),
});
schemas.SimilarityCoverage = obj({
  media: str(),
  name: str(),
  total: int(),
  fetched: int(),
  usable: int(),
  withAuthors: int(),
  missing: int(),
  pending: int(),
  enabled: bool(),
  excludedFromStatistics: bool(),
});
schemas.Similarity = obj({
  generatedAt: time(),
  hours: int(),
  threshold: num(),
  method: str(),
  coverage: arr(ref('SimilarityCoverage')),
  sample: obj({ available: int(), analyzed: int(), limit: int(), truncated: bool(), pairLimit: int(), pairsTruncated: bool() }),
  pairs: arr(ref('SimilarityPair')),
  citations: arr(obj({ article: ref('SimilarityArticle'), source: ref('Attribution') })),
  nodes: arr(obj({ id: str(), name: str(), country: str(), countryCode: str(), articles: int(), external: bool() })),
  edges: arr(
    obj({ source: str(), target: str(), kind: str(undefined, { enum: ['similarity', 'citation'] }), count: int(), score: nullable(num()) }),
  ),
});
schemas.ContentArticle = obj({
  id: int(),
  media: str(),
  mediaTitle: str(),
  title: str(),
  url: str(),
  image: nullable(str()),
  publishedAt: time(),
  tags: arr(str()),
  description: nullable(str()),
  authors: arr(str()),
  publisher: ref('OutletIdentity'),
});
schemas.CachedContent = obj({
  status: str(undefined, { enum: ['ok', 'short', 'missing', 'blocked', 'error', 'not_fetched', 'expired'] }),
  body: nullable(str('保留期間內已抓取的文字；不保證原站目前仍存在')),
  chars: int(),
  source: nullable(str('擷取方式')),
  fetchedAt: nullable(time()),
  attributions: arr(ref('Attribution')),
});

interface Param {
  name: string;
  in: 'query' | 'path';
  description: string;
  schema: Schema;
  required?: boolean;
  example?: unknown;
}
const q = (name: string, description: string, schema: Schema = str(), example?: unknown): Param => ({
  name,
  in: 'query',
  description,
  schema,
  ...(example !== undefined ? { example } : {}),
});
const p = (name: string, description: string, schema: Schema = str(), example?: unknown): Param => ({
  name,
  in: 'path',
  required: true,
  description,
  schema,
  ...(example !== undefined ? { example } : {}),
});
const intIn = (min: number, max: number, dflt: number): Schema => ({ type: 'integer', minimum: min, maximum: max, default: dflt });
const categoryParam = q('category', '排行分類，見 /api/v1/categories', { ...str(), default: 'all' }, 'news');
const threadId = p('id', '事件串 id（/api/v1/events 的 threadId）', { type: 'integer', minimum: 1 }, 365);

interface Endpoint {
  path: string;
  tag: string;
  summary: string;
  description?: string;
  params?: Param[];
  response: Schema;
  errors?: Record<string, string>;
  /** Example request path (with query) for docs; defaults to `path`. */
  example?: string;
  cache?: string;
}

export const API_TAGS = [
  { name: 'meta', description: 'API 本身' },
  { name: 'ranking', description: '標籤排行與分類' },
  { name: 'articles', description: '文章搜尋' },
  { name: 'tags', description: '單一標籤' },
  { name: 'events', description: '事件（同一件事，各家怎麼說）' },
  { name: 'topics', description: '各媒體的議題／專題' },
  { name: 'media', description: '媒體與爬蟲狀態' },
];

export const ENDPOINTS: Endpoint[] = [
  {
    path: '/api/v1/similarity',
    tag: 'articles',
    summary: '內文相似與明確引用關係',
    description:
      '僅比較可用內文，排除「內容」聯播來源。取期間內最新最多 10000 篇，最多回傳 2000 對；sample 揭露截斷。相似連線無方向；citation 由刊登媒體指向明確提及來源，並不保證最初作者。',
    params: [
      q('hours', '回溯小時', intIn(1, 168, 48)),
      q('threshold', '最低 Dice 相似度', { type: 'number', minimum: 0.5, maximum: 1, default: 0.65 }),
    ],
    response: ref('Similarity'),
    errors: { '400': '參數無效' },
    cache: '1 分鐘',
  },
  {
    path: '/api/v1/articles/{id}/content',
    tag: 'articles',
    summary: '單篇已保存內文',
    params: [p('id', '文章 id', { type: 'integer', minimum: 1 }, 1)],
    response: obj({ article: ref('ContentArticle'), content: ref('CachedContent') }),
    errors: { '400': '文章 id 無效', '404': '文章不存在' },
    cache: '1 分鐘',
  },
  {
    path: '/api/v1/media/{media}/keywords',
    tag: 'media',
    summary: '媒體報導關鍵字',
    description:
      '統計期間內最新最多 2000 篇的標籤與標題關鍵詞，排除新聞分類與通用詞；每篇每詞計一次。標題詞彙沿用近 7 天跨媒體標籤字典。與文章列表分頁無關。',
    params: [p('media', '媒體代碼', str(), 'rti'), q('hours', '回溯刊登小時', intIn(1, 168, 168))],
    response: obj({
      media: str(),
      hours: int(),
      from: time(),
      to: time(),
      sampledArticles: int('實際取樣文章數'),
      capped: bool('期間文章超過 2000 篇，僅取最新文章'),
      terms: arr(obj({ label: str(), count: int('包含此詞的文章數') })),
    }),
    errors: { '400': '參數無效', '404': '媒體不存在' },
    cache: '2 分鐘',
  },
  {
    path: '/api/v1/media/{media}/content',
    tag: 'media',
    summary: '媒體內文庫列表',
    description: '以文章 id 遞減分頁；僅回傳內文狀態與長度，單篇內文另由 content API 取得。',
    params: [
      p('media', '媒體代碼', str(), 'cna'),
      q('limit', '每頁筆數', intIn(1, 100, 40)),
      q('cursor', '上一頁 nextCursor', str()),
      q('q', '標題、摘要或完整標籤關鍵字（最多 60 字元）', str()),
      q('hours', '僅列出近幾小時刊登的文章；省略則不限時間', { type: 'integer', minimum: 1, maximum: 168 }),
    ],
    response: obj({
      media: str(),
      title: str(),
      publisher: ref('OutletIdentity'),
      limit: int(),
      count: int(),
      nextCursor: nullable(str()),
      articles: arr({ allOf: [ref('ContentArticle'), obj({ bodyStatus: str(), bodyChars: int(), contentFetchedAt: nullable(time()) })] }),
    }),
    errors: { '400': '參數無效', '404': '媒體不存在' },
    cache: '1 分鐘',
  },
  {
    path: '/api/v1',
    tag: 'meta',
    summary: 'API 索引',
    description: '列出所有端點與文件位置。',
    response: obj({
      name: str(),
      version: str(),
      docs: str('人看的文件'),
      openapi: str('OpenAPI 3.1 規格'),
      endpoints: arr(obj({ method: str(), path: str(), summary: str(), example: str() })),
    }),
    cache: '1 小時',
  },
  {
    path: '/api/v1/openapi.json',
    tag: 'meta',
    summary: 'OpenAPI 3.1 規格',
    description: '可匯入 Swagger UI、Postman、openapi-generator 等工具。',
    response: { type: 'object' },
    cache: '1 小時',
  },
  {
    path: '/api/v1/categories',
    tag: 'ranking',
    summary: '排行分類',
    description: '可用於 `category` 參數的分類，含 blue／green 兩個政治傾向分類。',
    response: arr(obj({ key: str('分類代碼'), label: str('中文名稱'), media: int('分類內媒體數') })),
  },
  {
    path: '/api/v1/ranking',
    tag: 'ranking',
    summary: '標籤排行（每 10 分鐘更新）',
    description:
      '過去 24 小時各媒體文章標籤的排行，每 10 分鐘重算一次、以整點小時存快照。`order=burst`（預設）依爆發力排序，`order=score` 依正規化分數排序。`at` 可取過去某個時間點的快照。',
    params: [
      categoryParam,
      q('order', '排序：burst 爆發力／score 分數', { ...str(), enum: ['burst', 'score'], default: 'burst' }, 'score'),
      q('limit', '筆數', intIn(1, 500, 50), 20),
      q('at', '取這個時間（ISO 8601）以前最新的快照', time(), '2026-09-30T12:00:00+08:00'),
    ],
    response: obj({
      snapshot: obj({
        id: int(),
        category: str(),
        hourStart: time('快照所屬小時（UTC）'),
        computedAt: time('計算時間'),
        weight: num('正規化用的權重（有發文的媒體數）'),
        articleCount: int('視窗內文章數'),
        mediaCount: int('視窗內有發文的媒體數'),
        historyAvailable: arr(int(), '有歷史快照可比較的小時數'),
      }),
      order: str(undefined, { enum: ['burst', 'score'] }),
      entries: arr(ref('RankingEntry')),
    }),
    errors: { '400': '`at` 格式錯誤', '404': '未知分類，或該時間以前沒有快照' },
    example: '/api/v1/ranking?category=news&limit=20',
  },
  {
    path: '/api/v1/articles',
    tag: 'articles',
    summary: '文章搜尋',
    description: `依時間窗、關鍵字（標題、摘要或標籤）、媒體、分類、政治傾向、標籤篩選所有爬到的文章，新到舊排序。本站不儲存內文，關鍵字只比對標題、摘要與標籤。給 \`facets=1\` 會另外回傳整個查詢（不限本頁）依媒體與政治傾向的篇數。時間窗預設為過去 24 小時，最長 ${MAX_SPAN_DAYS} 天。還有下一頁時 \`nextCursor\` 不為 null，把它原樣放進 \`cursor\` 參數（其他參數不變）取下一頁。`,
    params: [
      q('q', '標題或摘要包含這段文字，或文章帶有完全相同的標籤（最多 60 字）', str(), '颱風'),
      q('media', '媒體代碼，逗號分隔（最多 50 個）', str(), 'cna,pts'),
      q('category', '排行分類（例如 news、blue、green），與 media 同時給則取交集', str(), 'green'),
      q('camp', '政治傾向：blue、green 或 other（不在藍綠名單的媒體）', str('', { enum: ['blue', 'green', 'other'] }), 'blue'),
      q('tag', '文章帶有這個標籤（完全相符）', str(), '賴清德'),
      q('since', '起始時間（含）：ISO 8601，或 YYYY-MM-DD 表示台北時間當天 0 點', str(), '2026-09-30'),
      q('until', '結束時間（不含），格式同 since；預設現在', str(), '2026-10-01'),
      q('hours', '沒給 since 時，從 until 往前幾小時', { type: 'number', exclusiveMinimum: 0, default: 24 }, 72),
      q('limit', '每頁筆數', intIn(1, MAX_LIMIT, 50), 20),
      q('cursor', '上一頁回應的 nextCursor', str()),
      q('facets', '1 表示回傳 facets（整個查詢的總數、各政治傾向與各媒體篇數）', str('', { enum: ['0', '1'] }), '1'),
    ],
    response: obj(
      {
        query: obj({
          q: nullable(str()),
          media: nullable(arr(ref('MediaKey'))),
          category: nullable(str()),
          tag: nullable(str()),
          camp: nullable(camp),
          since: time(),
          until: time(),
          limit: int(),
        }),
        count: int('本頁筆數'),
        facets: obj(
          {
            total: int('整個查詢的篇數'),
            camps: obj({ blue: int(), green: int(), other: int() }, '各政治傾向篇數'),
            media: arr(obj({ media: ref('MediaKey'), count: int() }), '各媒體篇數，多到少'),
          },
          '只有 facets=1 時出現',
        ),
        nextCursor: nullable(str('下一頁的 cursor；沒有下一頁為 null')),
        articles: arr(
          obj({
            id: int(),
            media: ref('MediaKey'),
            mediaTitle: str('媒體名稱'),
            camp,
            title: str(),
            description: nullable(str('摘要（媒體提供的 description）')),
            url: str(),
            image: nullable(str()),
            publishedAt: time('發布時間（UTC）'),
            datePending: bool('true 表示來源沒有提供發布時間、內文尚未抓取，publishedAt 暫為首次看到的時間'),
            section: nullable(str('媒體自己的分類／欄目')),
            tags: arr(str()),
          }),
        ),
      },
      undefined,
      ['facets'],
    ),
    errors: { '400': '參數錯誤（未知媒體、分類或政治傾向、時間格式、時間窗超過上限、cursor 無效）' },
    example: '/api/v1/articles?q=%E9%A2%B1%E9%A2%A8&hours=72&limit=20',
  },
  {
    path: '/api/v1/tags/{tag}/articles',
    tag: 'tags',
    summary: '帶有某標籤的最新文章',
    params: [
      p('tag', '標籤（URL 編碼）', str(), '賴清德'),
      q('hours', '往前幾小時', intIn(1, 336, 48), 24),
      q('limit', '筆數', intIn(1, 200, 60), 20),
    ],
    response: obj({
      tag: str(),
      hours: int(),
      articles: arr({ allOf: [ref('Article'), obj({ mediaTitle: str('媒體名稱') })] }),
    }),
    example: '/api/v1/tags/%E8%B3%B4%E6%B8%85%E5%BE%B7/articles?limit=20',
  },
  {
    path: '/api/v1/tags/{tag}/series',
    tag: 'tags',
    summary: '標籤每小時的分數與文章數',
    description: '取自每小時的排行快照；該小時沒進排行時 score 與 count 為 0、rank 為 null。',
    params: [p('tag', '標籤（URL 編碼）', str(), '賴清德'), categoryParam, q('hours', '往前幾小時', intIn(1, 336, 72), 168)],
    response: obj({
      tag: str(),
      category: str(),
      hours: int(),
      points: arr(obj({ t: time('小時（UTC）'), score: num('正規化分數'), count: int('文章數'), rank: nullable(int('名次')) })),
    }),
    errors: { '404': '未知分類' },
    example: '/api/v1/tags/%E8%B3%B4%E6%B8%85%E5%BE%B7/series?hours=168',
  },
  {
    path: '/api/v1/tags/{tag}/stats',
    tag: 'tags',
    summary: '標籤長期統計',
    description:
      '這個標籤在各分類第一次／最後一次上榜的小時、上榜小時數與最高峰。level 2：至少 2 家媒體各提到 2 次以上；level 3：另需至少 3 家媒體、其中一家 3 次以上（news 分類的門檻，其他分類較寬）。',
    params: [p('tag', '標籤（URL 編碼）', str(), '賴清德')],
    response: obj({
      tag: str(),
      stats: arr(
        obj({
          category: str(),
          level: int(undefined),
          firstHour: time(),
          lastHour: time(),
          hoursCount: int('上榜小時數'),
          maxHour: time('文章數最多的小時'),
          maxCount: int('該小時文章數'),
        }),
      ),
    }),
    example: '/api/v1/tags/%E8%B3%B4%E6%B8%85%E5%BE%B7/stats',
  },
  {
    path: '/api/v1/events',
    tag: 'events',
    summary: '目前的事件排行（每小時）',
    description:
      '把同時爆發的標籤分群成「事件」，每小時 :04 與 :34 重算。`prev`／`next`／`dayHours` 可用於翻閱歷史小時（放進 `at`）。`stale` 為 true 表示最新快照超過 3 小時未更新。',
    params: [q('limit', '事件數', intIn(1, 30, 30), 10), q('at', '取這個時間（ISO 8601）以前最新的一小時', time(), '2026-09-30T12:00:00Z')],
    response: obj({
      hour: time('快照小時（UTC）'),
      builtAt: time(),
      stale: bool(),
      prev: nullable(time('上一個有快照的小時')),
      next: nullable(time('下一個有快照的小時；最新時為 null')),
      dayHours: arr(time(), '同一台北日內所有有快照的小時'),
      events: arr(
        obj({
          rank: int(),
          score: num(),
          major: arr(str(), '主要標籤'),
          tags: arr(obj({ tag: str(), burst: num() }), '事件內所有標籤與爆發力'),
          news: arr(ref('Headline'), '代表新聞（最多 6 則）'),
          relatedEventPk: nullable(str('= threadId 的字串形式（相容舊版）')),
          threadId: nullable(int('事件串 id，可查 /api/v1/events/threads/{id}')),
        }),
      ),
    }),
    errors: { '400': '`at` 格式錯誤', '404': '該時間以前沒有快照', '503': '尚無任何快照' },
    example: '/api/v1/events?limit=10',
  },
  {
    path: '/api/v1/events/threads',
    tag: 'events',
    summary: '某一天的所有事件串',
    description: '台北時間某一天內曾出現的事件串，依最高分排序（最多 300 個）。`days` 列出所有有資料的日期。',
    params: [q('day', '台北日期 YYYY-MM-DD，預設今天', str(undefined, { pattern: '^\\d{4}-\\d{2}-\\d{2}$' }), '2026-09-30')],
    response: obj({
      day: str(),
      days: arr(str()),
      threads: arr(
        obj({
          id: int(),
          firstTime: time(),
          lastTime: time(),
          hours: int('出現的小時數'),
          majorTags: arr(str()),
          maxTag: nullable(str('分數最高的標籤')),
          maxScore: num(),
          bestRank: nullable(int('最佳名次')),
          news: arr(obj({ title: str(), url: str(), image: nullable(str()), media: ref('MediaKey') })),
        }),
      ),
    }),
    errors: { '400': '日期格式錯誤' },
    example: '/api/v1/events/threads?day=2026-09-30',
  },
  {
    path: '/api/v1/events/threads/{id}',
    tag: 'events',
    summary: '單一事件串',
    description: '事件串的整體資訊與逐小時紀錄（最多 72 小時，新到舊）。`thread.history` 的鍵是台北時間 `YYYY-MM-DD HH:00:00`。',
    params: [threadId],
    response: obj({
      thread: obj(
        {
          id: int(),
          category: str(),
          firstTime: time(),
          lastTime: time(),
          hours: int(),
          allTags: arr(str()),
          majorTags: arr(str()),
          maxTag: nullable(str()),
          maxScore: num(),
          history: map(map(num()), '台北時間小時 → 標籤 → 分數'),
          combinedFrom: arr(int(), '併入本串的事件串'),
          combinedTo: arr(int(), '本串併入的事件串'),
          hoursTotal: nullable(int()),
          equalFirstTime: nullable(time()),
          equalLastTime: nullable(time()),
        },
        undefined,
      ),
      related: arr(int(), '相關事件串 id'),
      hours: arr(
        obj({
          hourStart: time(),
          rank: int(),
          score: num(),
          major: arr(str()),
          tags: arr({ type: 'array', prefixItems: [str(), num()] }, '[標籤, 爆發力]'),
          news: arr(ref('Headline')),
        }),
      ),
    }),
    errors: { '400': 'id 格式錯誤', '404': '找不到' },
    example: '/api/v1/events/threads/365',
  },
  {
    path: '/api/v1/events/threads/{id}/series',
    tag: 'events',
    summary: '事件串的每小時趨勢',
    description: '事件主要標籤（最多 6 個）每小時的排行分數，以及藍／綠／其他媒體每小時的報導數；前後各多 12 小時。',
    params: [threadId],
    response: obj({
      threadId: int(),
      tags: arr(str()),
      from: time(),
      to: time(),
      points: arr(
        obj({
          t: time(),
          blue: int('藍營傾向媒體文章數'),
          green: int('綠營傾向媒體文章數'),
          other: int('其他媒體文章數'),
          tags: nullable(map(obj({ score: num(), rank: nullable(int()) }))),
        }),
      ),
    }),
    errors: { '400': 'id 格式錯誤', '404': '找不到' },
    example: '/api/v1/events/threads/365/series',
  },
  {
    path: '/api/v1/events/threads/{id}/coverage',
    tag: 'events',
    summary: '同一事件的各家標題對照',
    description: '帶有事件主要標籤的所有文章，依媒體與藍／綠／其他分組。`blindspot` 列出「對方陣營有報、這一方完全沒報」的陣營。',
    params: [threadId],
    response: obj({
      threadId: int(),
      majorTags: arr(str()),
      from: time(),
      to: time(),
      articles: int('文章總數'),
      outlets: int('媒體數'),
      camps: arr(obj({ camp, label: str(), outlets: int(), articles: int() })),
      blindspot: arr(camp),
      byOutlet: arr(obj({ media: ref('MediaKey'), title: str(), icon: nullable(str()), camp, articles: arr(ref('CoverageArticle')) })),
    }),
    errors: { '400': 'id 格式錯誤', '404': '找不到' },
    example: '/api/v1/events/threads/365/coverage',
  },
  {
    path: '/api/v1/topics',
    tag: 'topics',
    summary: '各媒體的議題／專題',
    description:
      '不給 `media`：跨媒體合併的議題流（`feed`，新到舊，附站內相關報導 `coverage`）與各媒體最近議題（`media`）。給 `media`：只回該媒體最新議題。每小時 :50 更新。',
    params: [
      q('media', '只取這家媒體（須為有追蹤議題的媒體）', ref('MediaKey'), 'pts'),
      q('limit', '筆數：有 media 時預設 20、最多 200；否則為 feed 筆數，預設 60、最多 120', { type: 'integer', minimum: 1 }, 20),
      q('per', '沒給 media 時，每家媒體附幾則最近議題', intIn(1, 10, 4), 2),
    ],
    response: {
      oneOf: [
        obj(
          {
            media: arr(
              obj({
                media: ref('MediaKey'),
                title: str(),
                icon: nullable(str()),
                link: str('媒體議題列表頁'),
                latest: nullable(ref('TopicItem')),
                recent: arr(ref('TopicItem')),
              }),
            ),
            feed: arr({
              allOf: [
                ref('TopicItem'),
                obj({
                  media: ref('MediaKey'),
                  mediaTitle: str(),
                  icon: nullable(str()),
                  mediaImage: nullable(str()),
                  coverage: nullable(
                    obj(
                      {
                        tags: arr(str(), '議題對應到的站內標籤'),
                        basis: str('title＝從議題名稱比對到的標籤；page＝議題名稱比對不到時，該媒體專題頁所列自家文章共有的標籤'),
                        count: int('過去 3 天同時帶有這些標籤的文章數'),
                        capped: bool('count 達上限 500'),
                        mediaCount: int(),
                        latest: arr(obj({ id: int(), media: ref('MediaKey'), mediaTitle: str(), title: str(), url: str(), time: time() })),
                      },
                      '站內相關報導',
                    ),
                  ),
                }),
              ],
            }),
          },
          '不給 media',
        ),
        obj({ media: ref('MediaKey'), title: str(), link: str(), mediaImage: nullable(str()), topics: arr(ref('TopicItem')) }, '給 media'),
      ],
    },
    errors: { '404': '該媒體沒有追蹤議題' },
    example: '/api/v1/topics?limit=20',
  },
  {
    path: '/api/v1/media',
    tag: 'media',
    summary: '所有媒體代碼與名稱',
    response: map(
      obj({
        title: nullable(str('媒體名稱')),
        icon: nullable(str('favicon 網址；已存放在本站的為 https://tag.observe.tw/favicons/<媒體代碼>.png（64×64 PNG）')),
      }),
      '媒體代碼 → 名稱與圖示',
    ),
  },
  {
    path: '/api/v1/media/{media}',
    tag: 'media',
    summary: '單一媒體最近的文章與熱門標籤',
    params: [p('media', '媒體代碼', ref('MediaKey'), 'cna'), q('hours', '往前幾小時', intIn(1, 168, 24), 24)],
    response: obj({
      media: ref('MediaKey'),
      title: str(),
      icon: nullable(str()),
      hours: int(),
      articleCount: int('期間內文章數（最多計 200）'),
      topTags: arr(obj({ tag: str(), count: int() }), '最多 50 個'),
      articles: arr(
        obj({ id: int(), title: str(), url: str(), image: nullable(str()), publishedAt: time(), tags: arr(str()) }),
        '最新 60 篇',
      ),
    }),
    errors: { '404': '未知媒體' },
    example: '/api/v1/media/cna',
  },
  {
    path: '/api/v1/media-stats',
    tag: 'media',
    summary: '各媒體收錄量與爬蟲狀態',
    description: 'today 為台北時間今天 0 點起。status：ok 正常、stale 太久沒有新文章、failing 近 3 小時爬取全部失敗、disabled 已停用。',
    response: obj({
      generatedAt: time(),
      todayStart: time(),
      totals: obj({
        today: int(),
        last24h: int(),
        publishingMedia24h: int(),
        pendingDate: int(),
        activeSources: int(),
        disabledSources: int(),
        taggedShare24h: num('24 小時內有標籤的文章比例（0–1）'),
        statusCounts: map(int()),
      }),
      media: arr(
        obj({
          media: ref('MediaKey'),
          title: str(),
          icon: nullable(str()),
          category: nullable(str()),
          categoryLabel: nullable(str()),
          camp,
          schedule: str('爬取頻率'),
          today: int(),
          last24h: int(),
          last7d: int(),
          collectingSince: nullable(time()),
          pendingDate: int('尚未確定發布時間的文章數'),
          taggedShare24h: nullable(num()),
          lastArticle: nullable(time()),
          lastCrawlOk: nullable(time()),
          status: str(undefined, { enum: ['ok', 'stale', 'failing', 'disabled'] }),
        }),
      ),
    }),
  },
];

const PUBLIC_ORIGIN = 'https://tag.observe.tw';

export const API_INTRO = {
  title: '新文易數 API',
  version: '1',
  summary: '台灣新聞媒體的標籤排行、事件分群、各家標題對照與議題追蹤資料，全部公開、免金鑰、唯讀。',
  rules: [
    '基底網址 `https://tag.observe.tw`，所有端點都是 `GET`（也接受 `HEAD`），回傳 UTF-8 JSON。',
    '不需要 API 金鑰。每個 IP 每分鐘最多 240 次 API 請求，超過回 `429`；回應帶 `x-ratelimit-limit`、`x-ratelimit-remaining`、`x-ratelimit-reset` 標頭。',
    '允許跨網域（CORS `Access-Control-Allow-Origin: *`），瀏覽器前端可直接呼叫。',
    '時間一律是 UTC 的 ISO 8601（例如 `2026-09-30T21:00:00.000Z`）；「一天」指台北時間（UTC+8）的日曆日。',
    '回應帶 `cache-control`，資料本身每 10 分鐘（排行）到每小時（事件、議題）更新，請勿以高於此的頻率輪詢。',
    '錯誤回 `{"error": "..."}`，搭配 HTTP 狀態碼：`400` 參數錯誤、`404` 找不到、`405` 非 GET、`429` 太頻繁、`5xx` 伺服器問題。',
    '路徑參數（標籤、媒體代碼）請 URL 編碼，例如 `/api/v1/tags/%E8%B3%B4%E6%B8%85%E5%BE%B7/articles`。路徑結尾不要加 `/`。',
    '`v1` 內只做向後相容的變更（新增欄位、新增端點）；移除或改名會先在本文件公告。',
    '標題、圖片與內文著作權屬原媒體；本 API 提供標題、連結、統計及保存期間內的擷取文字。使用資料請註明「資料來源：新文易數 tag.observe.tw」。',
    '舊站 tag.analysis.tw 的 `/api/*.php` 在本站回 `410`，JSON 內 `replacement` 指向對應的 v1 端點。',
    '不寫程式也能追：RSS `/feeds/events.xml`（新事件）與 `/feeds/tag/<標籤>.xml`（某標籤的最新報導，標籤需 URL 編碼）；全站網址清單在 `/sitemap.xml`。',
  ],
  quickstart: [
    {
      label: '命令列（curl + jq）',
      lang: 'sh',
      code: [
        '# 新聞媒體目前爆發力最高的 10 個標籤',
        `curl -s '${PUBLIC_ORIGIN}/api/v1/ranking?category=news&limit=10' | jq '.entries[] | {tag, burst, count}'`,
        '',
        '# 過去三天標題含「颱風」的文章；有下一頁時把 nextCursor 放進 cursor',
        `curl -s '${PUBLIC_ORIGIN}/api/v1/articles?q=%E9%A2%B1%E9%A2%A8&hours=72&limit=50' | jq -r '.nextCursor'`,
        `curl -s '${PUBLIC_ORIGIN}/api/v1/articles?q=%E9%A2%B1%E9%A2%A8&hours=72&limit=50&cursor=<nextCursor>'`,
        '',
        '# 現在排第一的事件，藍綠各家怎麼報',
        `id=$(curl -s '${PUBLIC_ORIGIN}/api/v1/events?limit=1' | jq '.events[0].threadId')`,
        `curl -s "${PUBLIC_ORIGIN}/api/v1/events/threads/$id/coverage" | jq '.camps, .blindspot'`,
      ].join('\n'),
    },
    {
      label: 'JavaScript（瀏覽器或 Node 18+）',
      lang: 'js',
      code: [
        `const res = await fetch('${PUBLIC_ORIGIN}/api/v1/ranking?category=news&limit=10');`,
        'const { snapshot, entries } = await res.json();',
        'for (const e of entries) console.log(e.position, e.tag, e.burst.toFixed(1));',
      ].join('\n'),
    },
    {
      label: 'Python',
      lang: 'python',
      code: [
        'import requests',
        '',
        `r = requests.get("${PUBLIC_ORIGIN}/api/v1/articles", params={"q": "颱風", "hours": 72})`,
        'for a in r.json()["articles"]:',
        '    print(a["publishedAt"], a["mediaTitle"], a["title"])',
      ].join('\n'),
    },
  ],
};

export function buildOpenApi() {
  const paths: Record<string, unknown> = {};
  for (const e of ENDPOINTS) {
    const errors = Object.fromEntries(
      Object.entries(e.errors ?? {}).map(([code, description]) => [
        code,
        { description, content: { 'application/json': { schema: ref('Error') } } },
      ]),
    );
    paths[e.path] = {
      get: {
        operationId: operationId(e.path),
        tags: [e.tag],
        summary: e.summary,
        ...(e.description ? { description: e.description } : {}),
        parameters: e.params ?? [],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: e.response } } },
          ...errors,
          '429': { description: '請求太頻繁', content: { 'application/json': { schema: ref('Error') } } },
        },
      },
    };
  }
  return {
    openapi: '3.1.0',
    info: {
      title: API_INTRO.title,
      version: API_INTRO.version,
      summary: API_INTRO.summary,
      description: API_INTRO.rules.map((r) => `- ${r}`).join('\n'),
      contact: { name: '新文易數', url: `${PUBLIC_ORIGIN}/api/` },
      'x-quickstart': API_INTRO.quickstart,
    },
    servers: [{ url: PUBLIC_ORIGIN }],
    externalDocs: { description: 'API 文件', url: `${PUBLIC_ORIGIN}/api/` },
    tags: API_TAGS,
    paths,
    components: { schemas },
  };
}

export const operationId = (path: string) =>
  path
    .replace(/^\/api\/v1\/?/, '')
    .split(/[/.-]/)
    .filter(Boolean)
    .map((s, i) => {
      const w = s.replace(/[{}]/g, '');
      const cap = s.startsWith('{') ? `By${w[0].toUpperCase()}${w.slice(1)}` : w[0].toUpperCase() + w.slice(1);
      return i === 0 && !s.startsWith('{') ? w : cap;
    })
    .join('') || 'index';

/** Fills path parameters with their examples: /api/v1/tags/{tag}/stats → /api/v1/tags/%E8…/stats */
export const examplePath = (e: Endpoint) =>
  e.example ??
  e.path.replace(/\{(\w+)\}/g, (_, name) => encodeURIComponent(String(e.params?.find((x) => x.name === name)?.example ?? name)));

export function registerApiMeta(app: FastifyInstance) {
  const spec = JSON.stringify(buildOpenApi());
  const index = {
    name: API_INTRO.title,
    version: API_INTRO.version,
    docs: `${PUBLIC_ORIGIN}/api/`,
    openapi: `${PUBLIC_ORIGIN}/api/v1/openapi.json`,
    endpoints: ENDPOINTS.map((e) => ({ method: 'GET', path: e.path, summary: e.summary, example: examplePath(e) })),
  };
  for (const url of ['/api/v1', '/api/v1/'])
    app.get(url, async (_request, reply) => {
      reply.header('cache-control', 'public, max-age=3600');
      return index;
    });
  app.get('/api/v1/openapi.json', async (_request, reply) => {
    reply.header('cache-control', 'public, max-age=3600').type('application/json; charset=utf-8');
    return spec;
  });
}
