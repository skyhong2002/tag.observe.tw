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

// Shared by the hourly table and the day archive; `span` names the window.
const campBaseline = (span: string) =>
  obj(
    {
      outlets: obj({ blue: int(), green: int(), other: int() }, `事件窗口（${span}）內有發稿的媒體家數`),
      articles: obj({ blue: int(), green: int(), other: int() }, '同窗口內各陣營文章數'),
    },
    '各陣營的整體基準，用來判斷單一事件的藍綠比例是否異常；其他只計排行榜用的新聞媒體',
  );
const eventCoverage = (span: string) =>
  obj({
    outlets: arr(obj({ media: str(), camp: str('blue／green／other') }), `${span}寫過此事件主要標籤的媒體，依篇數排序`),
    articles: int('報導篇數'),
    camps: obj({ blue: int(), green: int(), other: int() }, '各陣營媒體家數'),
    share: nullable(obj({ blue: int(), green: int() }, '藍綠之間的家數百分比（不含其他）')),
    lean: nullable(num('藍綠家數比相對於 baseline 的 log2；0 為平常比例，正偏藍、負偏綠')),
    tilt: nullable(str('明顯偏向的陣營（|lean| ≥ 0.8，約 1.75 倍，且藍綠合計 ≥ 5 家）')),
    blindspot: arr(str(), '盲點：幾乎沒報導的陣營（該陣營 ≤ 1 家而另一陣營 ≥ 4 家）。blue 表示藍營讀者看不到這件事'),
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
      camp: str('媒體陣營 blue／green／other（只在 /api/v1/events 回傳）'),
    },
    '事件代表新聞',
    ['id', 'camp'],
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
  RankingBasis: obj({
    id: str('固定媒體名單版本'),
    media: arr(ref('MediaKey')),
    coverageFrom: time('所有基準來源開始收錄後的第一個完整小時'),
    validFrom: time('收錄開始後滿 24 小時；更早的移動平均及分數為 null'),
  }),
  RankingEntry: obj(
    {
      rank: int('依原始分數的名次'),
      position: int('在本次回應排序中的位置（從 1 起）'),
      tag: str('標籤'),
      score: num('原始分數：每篇文章 +1，同一媒體的第 2、3… 篇遞減為 0.5、0.25…'),
      count: int('過去 24 小時帶這個標籤的文章數'),
      media: map(int(), '各媒體的文章數'),
      normalized: num('原始分數 ÷ 固定基準媒體數 × 50'),
      burst: nullable(num('爆發力：與同一基準 3/6/12/24/48 小時前分數比較的加權差；缺值、舊榜截斷或基準不相容為 null')),
      history: map(nullable(num()), 'N 小時前的正規化分數（鍵為 3、6、12、24、48；沒有可比較資料為 null）'),
      rank24h: nullable(int('24 小時前依原始分數的名次；沒有可比較快照、基準不同或當時不在榜上為 null')),
      new: bool('24 小時前的完整快照中沒有這個標籤'),
      related: arr(
        obj({
          tag: str('一起出現的標籤'),
          count: int('視窗內同時帶兩個標籤的文章數'),
          share: num('佔這個標籤文章數的比例（0–1）'),
        }),
        'related=1 時回傳：同一視窗、同一基準媒體中最常與這個標籤同時出現的標籤，最多 5 個，依共同文章數排序',
      ),
      trend: arr(
        obj({
          t: time(),
          hourlyCount: nullable(int('該完整小時收錄篇數')),
          average24h: nullable(num('當小時及前 23 小時篇數總和 ÷ 24（篇／小時）；歷史不足為 null')),
          score: nullable(num('固定基準 24 小時分數')),
          count: nullable(int('固定基準 24 小時累計篇數')),
        }),
        'trend=1 時回傳 49 個等距小時點，涵蓋 48 小時變化',
      ),
      rankTrail: arr(
        obj({
          t: time('快照所屬小時（UTC）'),
          position: nullable(int('該小時依爆發力排序的名次；沒有快照、不在榜上或當時爆發力無法比較為 null')),
        }),
        'ranks=1 且 order=burst 時回傳：最近 24 個整點快照的爆發力名次，舊到新，最後一點即目前快照',
      ),
    },
    undefined,
    ['trend', 'related', 'rankTrail'],
  ),
  CoverageArticle: obj({
    id: int(),
    title: str(),
    url: str(),
    image: nullable(str()),
    publishedAt: time(),
    hits: int('這篇文章帶了幾個事件主要標籤'),
    description: nullable(str('媒體提供的摘要，最多 160 字；沒有或與標題重複時為 null')),
  }),
  TopicCheck: obj(
    {
      checkedAt: nullable(time('最近一次完成檢查時間')),
      lastSuccessAt: nullable(time('最近一次所有入口成功的時間')),
      status: str('ok、partial、failed、running 或 pending'),
      fetched: int('本次取得的去重專題數'),
      stale: bool('超過三小時未完整更新，或尚未成功'),
      sources: arr(ref('TopicSource'), '最近一次完成檢查的各入口結果'),
      error: str('整次檢查失敗時的錯誤訊息'),
    },
    undefined,
    ['error'],
  ),
  TopicSource: obj(
    {
      url: str('媒體官方的議題／專題列表入口'),
      kind: str('入口宣告的類型：topic 議題、feature 專題、auto 依新聞日期判定', { enum: ['topic', 'feature', 'auto'] }),
      items: int('本次取得的項目數'),
      pages: int('有分頁時實際讀到第幾頁'),
      error: str('入口失敗或部分項目失敗的原因'),
    },
    undefined,
    ['pages', 'error'],
  ),
  TopicCounts: obj({ topic: int('累計議題數'), feature: int('累計專題數') }, '該媒體累計追蹤到的議題與專題數'),
  TopicItem: obj({
    id: str('議題 id'),
    time: time('首次看到的時間'),
    backlog: bool('true 表示開始追蹤該入口時就已上架（或在列表第二頁之後），time 只是開始追蹤的時間'),
    title: str('議題名稱'),
    url: str('媒體的專題頁網址'),
    image: nullable(str()),
    kind: str('topic 議題（持續增加新聞）、feature 專題（一次性的新聞包）', { enum: ['topic', 'feature'] }),
    status: str('active；ended＝已停更（議題最新一則新聞超過 90 天）', { enum: ['active', 'ended'] }),
    sponsored: bool('媒體標示為廣告／品牌合作'),
    parentId: nullable(int('上層議題 id（子議題）；與 id 不同，為數字')),
    storyFirstAt: nullable(time('專題頁所列新聞中最早一則的日期')),
    storyLastAt: nullable(time('專題頁所列新聞中最新一則的日期')),
    updatedAt: nullable(
      time(
        '最後更新：有 storyLastAt 用 storyLastAt，否則非 backlog 用 time（首次看到）；backlog 又沒有報導日期者為 null（更新時間不明）。所有列表依此新到舊排序，null 在最後',
      ),
    ),
    storyCount: nullable(int('專題頁所列新聞數')),
    tags: arr(str(), '從議題名稱比對到的站內標籤（只看名稱，不需近期有報導；比對不到為空陣列）'),
  }),
  TopicTagCount: obj({
    tag: str(),
    media: int('有議題或專題帶這個標籤的媒體家數'),
    topic: int('帶這個標籤的議題數'),
    feature: int('帶這個標籤的專題數'),
  }),
  TopicCoverage: nullable(
    obj(
      {
        tags: arr(str(), '議題對應到的站內標籤'),
        basis: str('title＝從議題名稱比對到的標籤；page＝議題名稱比對不到時，該媒體專題頁所列自家文章共有的標籤'),
        count: int('過去 3 天同時帶有這些標籤的文章數'),
        capped: bool('count 達上限 500'),
        mediaCount: int(),
        latest: arr(obj({ id: int(), media: ref('MediaKey'), mediaTitle: str(), title: str(), url: str(), time: time() })),
      },
      '站內相關報導；比對不到站內標籤時為 null',
    ),
  ),
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
schemas.PairRelationInfo = obj(
  {
    kind: str('分類優先序：明示来源、同署名、未辨識稿源', { enum: ['attributed', 'same-byline', 'unattributed'] }),
    sharedAuthors: arr(str(), '共同人名署名；不保證同一人'),
    aCitesB: bool(),
    bCitesA: bool(),
    aCreditRole: str('A 對 B 的來源標示角色', { enum: ['來源', '引用'] }),
    bCreditRole: str('B 對 A 的來源標示角色', { enum: ['來源', '引用'] }),
    commonSources: arr(obj({ media: str(), name: str() })),
    publication: str('標示刊登先後，與稿源無關；同一分鐘或時間未確認不計方向', { enum: ['same', 'a-earlier', 'b-earlier', 'unknown'] }),
  },
  undefined,
  ['aCreditRole', 'bCreditRole'],
);
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
  datePending: bool(),
  bodyLength: int(),
  attributions: arr(ref('Attribution')),
});
schemas.SimilarityPair = obj({
  id: str(),
  relation: ref('PairRelationInfo'),
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
  indexed: int('可用內文中已由相似度索引比對的篇數'),
  withAuthors: int(),
  missing: int(),
  pending: int(),
  enabled: bool(),
  excludedFromStatistics: bool(),
});
const similarityPeriod = {
  hours: nullable(int('回溯小時；以日期區間查詢時為 null')),
  days: nullable(obj({ from: str('台北日期 YYYY-MM-DD'), to: str('台北日期 YYYY-MM-DD（含）') }, '日期區間；以小時查詢時為 null')),
  from: time('期間起點'),
  to: time('期間終點'),
};
schemas.Similarity = obj({
  generatedAt: time(),
  ...similarityPeriod,
  threshold: num(),
  method: str(),
  coverage: arr(ref('SimilarityCoverage')),
  index: obj(
    {
      available: int('期間內可用內文篇數（不含「內容」聯播來源）'),
      analyzed: int('期間內已比對、內文夠長可比對的篇數'),
      pending: int('等待下一次索引的可用內文篇數'),
      pairs: int('門檻以上、兩篇都在期間內的相似配對數'),
      groups: int('同題報導組數（相似配對的連通群組）'),
      citations: int('明示引用則數'),
      windowDays: int('每篇與前後幾天內的他家文章比對'),
    },
    '全量索引的涵蓋：沒有抽樣或篇數上限',
  ),
  nodes: arr(
    obj({
      id: str(),
      name: str(),
      country: str(),
      countryCode: str(),
      articles: int('期間內已比對篇數'),
      external: bool('只被引用、沒有收錄內文的媒體'),
      similar: int('有直接相似配對的文章數'),
      sameByline: int('同署名跨站、無明示來源的文章數'),
      attributed: int('彼此引用或有共同明示來源的文章數'),
      unattributed: int('未辨識稿源的文章數'),
      earliest: int('未辨識稿源配對中標示刊登較早的篇數；不含同署名或時間未確認'),
      later: int('未辨識稿源配對中標示刊登較晚的篇數；不含同署名或時間未確認'),
      outgoing: int('引用其他媒體的篇數'),
      incoming: int('被其他媒體引用的篇數'),
    }),
  ),
  edges: arr(
    obj(
      {
        source: str(),
        target: str(),
        kind: str(undefined, { enum: ['similarity', 'citation'] }),
        relation: str('視覺分類，同署名優先', { enum: ['attributed', 'same-byline', 'unattributed'] }),
        directed: bool('箭頭由 target 指向 source；未辨識稿源僅表示刊登先後'),
        count: int(),
        score: nullable(num()),
        sameByline: int(),
        attributed: int(),
        unattributed: int(),
      },
      'similarity 依視覺分類與方向彙整，count 為直接配對數；citation 的 source 為引用方、target 為明示來源，count 為引用篇數',
      ['relation', 'directed'],
    ),
  ),
});
schemas.StoryGroup = obj({
  id: str(),
  sourceId: nullable(int('展示代表文章 id；不是稿源')),
  articleIds: arr(int(), '同組文章，刊登時間先後排序'),
  tiedFirst: int('同時最早刊登的篇數'),
  pairCount: int('同組相似配對總數'),
  pairs: arr(ref('SimilarityPair'), '分數最高的最多 100 組'),
});
schemas.SimilarityEvidence = obj({
  total: int('符合條件的證據總數'),
  page: int(),
  pageSize: int(),
  hiddenSources: int('scope 內媒體的直接比對對象在 scope 外的則數'),
  items: arr(
    obj(
      {
        kind: str(undefined, { enum: ['origin', 'citation'] }),
        key: str(),
        publishedAt: time(),
        articleId: int(),
        sourceId: int('origin：直接比對的另一篇文章 id；不是稿源'),
        groupId: str('origin：同題報導組 id'),
        directPair: nullable(ref('SimilarityPair')),
        source: ref('Attribution'),
      },
      'origin 有 sourceId／groupId／directPair；citation 有 source',
      ['sourceId', 'groupId', 'directPair', 'source'],
    ),
  ),
  articles: map(ref('SimilarityArticle'), '以 id 為鍵，本頁用到的文章'),
  groups: map(ref('StoryGroup'), '以 id 為鍵，本頁用到的同題報導組'),
});
schemas.SimilarityDaily = obj({
  from: str(),
  to: str(),
  threshold: num(),
  days: arr(str(), '台北日期'),
  totals: obj({
    articles: arr(int(), '每日已比對篇數'),
    pairs: arr(int(), '每日相似配對數（以較晚刊登者的日期計）'),
    identical: arr(int(), '其中內文相同'),
    citations: arr(int(), '每日明示引用則數'),
  }),
  media: arr(
    obj({
      media: str(),
      name: str(),
      articles: arr(int()),
      pairs: arr(int(), '一端為此媒體的配對數'),
      sameByline: arr(int(), '同署名跨站、無明示來源的文章數'),
      attributed: arr(int(), '已註明來源的文章數'),
      unattributed: arr(int(), '未辨識稿源的文章數'),
      copied: arr(
        int(),
        '較早刊登：此媒體先刊出、之後有他媒刊出相似內容的篇數（文章去重，以自身刊登日計；排除同署名、有明示來源、同一分鐘與未確認時間）',
      ),
      copying: arr(
        int(),
        '較晚刊登：此媒體刊出時已有他媒相似文章的篇數（文章去重，以自身刊登日計；排除同署名、有明示來源、同一分鐘與未確認時間）',
      ),
      citing: arr(int(), '此媒體引用他媒的則數'),
      cited: arr(int(), '他媒引用此媒體的則數'),
    }),
    '各陣列與 days 一一對應',
  ),
});
schemas.ArticleSimilarity = obj({
  articleId: int(),
  threshold: num(),
  indexedAt: nullable(time('索引比對時間；null 表示等待中')),
  chars: nullable(int('正規化內文長度；null 表示內文太短或不可比對')),
  windowDays: int(),
  matches: arr(
    obj({
      article: ref('SimilarityArticle'),
      relation: ref('PairRelationInfo'),
      score: num(),
      containment: num(),
      kind: str(undefined, { enum: ['identical', 'high'] }),
      evidence: str('最多 100 字的連續相同片段'),
    }),
    '相似度高者在前',
  ),
});
const relatedArticle = obj({
  id: int(),
  media: str(),
  mediaTitle: str(),
  title: str(),
  image: nullable(str()),
  publishedAt: time(),
  sharedTags: arr(str(), '共同標籤，較少見的在前'),
});
schemas.ArticleRelated = obj({
  articleId: int(),
  windowDays: int('只找刊登時間前後幾天內的報導'),
  tags: arr(obj({ tag: str(), articles: int('期間內用到此標籤的篇數'), media: int('期間內用到此標籤的媒體數') }), '本篇的關鍵字'),
  events: arr(
    obj({
      id: int('事件 thread id，網頁在 /eve/{id}/'),
      title: str('事件代表標題'),
      firstTime: time(),
      lastTime: time(),
      sharedTags: arr(str()),
    }),
    '主要標籤與本篇重疊的事件，最多 3 個',
  ),
  otherMedia: arr(relatedArticle, '其他媒體的相關報導，最多 8 篇、每家最多 2 篇'),
  sameMedia: arr(relatedArticle, '同一媒體的相關報導，最多 5 篇'),
});
schemas.JournalistOutlet = obj({ media: ref('MediaKey'), name: str('媒體名稱'), count: int('期間內署名篇數') });
schemas.JournalistSimilarity = obj({
  pairs: int('至少一端是此記者文章的相似配對數'),
  articles: int('有相似配對的自家文章數（去重）'),
  later: int('自家文章比對方晚至少一分鐘刊登的篇數（期間內文章去重，各欄可重疊）；不含同署名跨站或已註明來源'),
  earlier: int('自家文章比對方早至少一分鐘刊登的篇數（期間內文章去重，各欄可重疊）；不含同署名跨站或已註明來源'),
  sameAuthor: int('有同署名相近文章的篇數（期間內文章去重，不保證同一人）'),
  attributed: int('排除同署名後，有明示來源相似配對的篇數（期間內文章去重）'),
  identical: int('正規化內文完全相同的配對數'),
});
schemas.JournalistSummary = obj({
  name: str('署名整理出的人名或筆名'),
  articles: int('期間內署名文章數'),
  media: arr(ref('JournalistOutlet'), '刊登媒體，篇數多者在前'),
  withBody: int('有可比對正文的篇數'),
  cited: int('內文明示引用其他媒體的篇數'),
  latest: time('最近一篇刊登時間'),
  compared: int('相似度索引已比對的篇數'),
  firstSeen: int('已比對文章扣除明示引用、有較早相近版本及時間未確認的文章，依 ID 去重'),
  unmatched: int('已比對但未見達門檻相近文章的篇數；不代表原創'),
  similar: ref('JournalistSimilarity'),
});
schemas.JournalistPair = obj({
  own: ref('SimilarityArticle'),
  other: ref('SimilarityArticle'),
  score: num('正規化內文五字片段的 Dice 相似度'),
  containment: num(),
  sharedShingles: int(),
  kind: str(undefined, { enum: ['identical', 'high'] }),
  evidence: str('最多 100 字的連續相同片段'),
  minutes: int('對方刊登時間減自家刊登時間（分鐘）；正值表示自家較早'),
  relation: str('later 自家較晚、earlier 自家較早、same 一分鐘內', { enum: ['later', 'earlier', 'same'] }),
  sameAuthor: bool('對方文章署同一名字'),
  attributed: bool('已有彼此引用或共同明示來源'),
  publicationUnknown: bool('標示刊登時間尚未確認'),
  ownCitesOther: bool('自家文章明示引用對方媒體'),
  otherCitesOwn: bool('對方文章明示引用自家媒體'),
});
schemas.JournalistArticle = obj({
  id: int(),
  media: ref('MediaKey'),
  mediaTitle: str(),
  title: str(),
  url: str(),
  image: nullable(str()),
  publishedAt: time(),
  tags: arr(str()),
  bodyStatus: str(undefined, { enum: ['ok', 'short', 'missing', 'blocked', 'error', 'not_fetched', 'expired'] }),
  bodyChars: int('站內可讀的正文字元數；超過刊登後 7 天為 0'),
  byline: arr(str(), '站方原始署名欄位，未經整理'),
  coauthors: arr(str(), '同篇其他具名作者'),
  attributions: arr(ref('Attribution'), '內文明示引用的媒體'),
  matches: int('這篇與他站的相似配對數'),
  compared: bool('相似度索引是否已比對這篇'),
});
schemas.JournalistDetail = obj({
  name: str(),
  generatedAt: time(),
  hours: int(),
  threshold: num(),
  method: str(),
  stats: obj({
    articles: int(),
    withBody: int(),
    averageChars: nullable(int('可讀正文的平均字元數')),
    cited: int(),
    tags: arr(obj({ tag: str(), count: int() }), '最多 30 個常見標籤'),
    similar: ref('JournalistSimilarity'),
  }),
  media: arr(ref('JournalistOutlet')),
  articles: arr(ref('JournalistArticle'), '期間內署名文章，最新在前，最多 1000 篇'),
  pairs: arr(ref('JournalistPair'), '相似度高者在前'),
  index: obj({
    compared: int('已比對的自家文章數'),
    firstSeen: int('已比對文章扣除明示引用、有較早相近版本及時間未確認的文章，依 ID 去重'),
    unmatched: int('已比對但未見達門檻相近文章的篇數；不代表原創'),
    pending: int('有可用正文、等待索引的自家文章數'),
    windowDays: int('每篇與前後幾天內的他家文章比對'),
  }),
});
schemas.DiscoverySource = obj({
  media: str('文章發現來源代碼，非刊登媒體'),
  title: str('發現來源名稱'),
  url: str('實際發現文章的公開頁面網址'),
  discoveredAt: time('首次經此來源發現文章的時間，不取代刊登時間'),
});
schemas.ContentArticle = obj(
  {
    id: int(),
    media: str(),
    mediaTitle: str(),
    title: str(),
    url: str(),
    image: nullable(str()),
    publishedAt: time('排序用時間；若另有 publishedDate，刊期只有日精度，不代表確知時分'),
    publishedDate: str('經官方證據核實的日期；原站未公開發刊時分', { format: 'date' }),
    publishedDatePrecision: str(undefined, { enum: ['day'] }),
    tags: arr(str()),
    description: nullable(str()),
    summary: nullable(str('媒體提供的獨立摘要；無摘要時為 null，不從正文自動生成')),
    summarySource: nullable(
      str(
        '摘要依據：article:selector、jsonld:abstract、meta:summary、meta:description、meta:og:description、feed:description 或 feed:summary',
      ),
    ),
    authors: arr(str()),
    publisher: ref('OutletIdentity'),
    discoverySources: arr(ref('DiscoverySource')),
    collections: arr(
      obj(
        {
          id: str(),
          media: str(),
          title: str(),
          kind: str(undefined, { enum: ['topic', 'feature'] }),
          self: bool('此文章就是該專題頁本身'),
        },
        undefined,
        ['self'],
      ),
      '單篇內文回傳原站清單中實際收錄此文章的議題與專題，不限日期；self 為 true 的專題即此文章本身',
    ),
  },
  undefined,
  ['publishedDate', 'publishedDatePrecision', 'discoverySources', 'collections'],
);
schemas.CachedContent = obj({
  status: str(undefined, { enum: ['ok', 'short', 'missing', 'blocked', 'error', 'not_fetched', 'expired'] }),
  body: nullable(str('刊登 7 天內已抓取的文字；之後為 null。不保證原站目前仍存在')),
  chars: int(),
  source: nullable(str('擷取方式')),
  fetchedAt: nullable(time()),
  expiresAt: nullable(time('站內提供正文的期限：刊登後 7 天。之後 body 為 null、chars 為 0、status 為 expired。未取得正文時為 null')),
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
  { name: 'journalists', description: '記者署名與跨媒體相似' },
  { name: 'tags', description: '單一標籤' },
  { name: 'events', description: '事件（同一件事，各家怎麼說）' },
  { name: 'topics', description: '各媒體的議題／專題' },
  { name: 'media', description: '媒體與爬蟲狀態' },
];

const observationPage = obj({
  path: str('本站路徑（未編碼）'),
  kind: str('event／tag／topic／feature／article／journalist／media／page'),
  title: str(),
  views: int(),
});

const creditEntity = obj({
  key: str('署名識別；部門依刊登媒體區分'),
  name: str(),
  kind: str('', { enum: ['person', 'desk', 'organization', 'unknown'] }),
  media: nullable(str('部門或待辨識署名的刊登媒體')),
  organization: nullable(str('已辨識機構的來源代碼')),
  roles: arr(str('原文明確標示的角色')),
});
const creditSummary = {
  allOf: [creditEntity, obj({ articles: int(), latest: time(), outlets: arr(obj({ media: str(), name: str(), count: int() })) })],
};
const bylineFilters = [
  q('hours', '最近幾小時', intIn(1, 720, 48)),
  q('page', '頁碼，從 0 起', intIn(0, 10000, 0)),
  q('media', '限制刊登媒體', str()),
];

export const ENDPOINTS: Endpoint[] = [
  {
    path: '/api/v1/reader-presence',
    tag: 'meta',
    summary: '本站最近 90 秒的線上讀者估計',
    description:
      '單一 gateway 記憶體內的短期連線估計，不是 GA4 人數，不持久保存或按 IP 分組；服務重啟會歸零。此公開 GET 只回傳總數，不回傳識別碼。',
    cache: 'no-store',
    response: obj({ activeReaders: int('最近 90 秒送過心跳且未離開的讀者數'), windowSeconds: int('統計時間窗，固定 90 秒') }),
  },
  {
    path: '/api/v1/bylines',
    tag: 'journalists',
    summary: '所有新聞署名：個人、團隊、機構與待辨識',
    description:
      '依公開署名自動分類。部門依刊登媒體區分；同名不保證同一人。原文角色不推定職業；共同署名各自計入，篇數不可相加。沿用個人署名移除名單。',
    params: [
      ...bylineFilters,
      q('kind', '署名類型', str('', { enum: ['person', 'desk', 'organization', 'unknown'] })),
      q('q', '搜尋署名名稱', str()),
    ],
    response: obj({
      generatedAt: time(),
      hours: int(),
      page: int(),
      pageSize: int(),
      total: int(),
      credited: int('可辨識署名文章数'),
      counts: map(int()),
      outlets: arr(obj({ media: str(), name: str() })),
      bylines: arr(creditSummary),
    }),
    errors: { '400': '無效的篩選條件' },
    cache: '2 分鐘',
    example: '/api/v1/bylines?hours=48&kind=organization',
  },
  {
    path: '/api/v1/bylines/{key}',
    tag: 'journalists',
    summary: '單一署名的文章與原文角色',
    params: [p('key', '署名總覽回傳的 key，放進路徑時需 URL 編碼', str()), ...bylineFilters],
    response: obj({
      generatedAt: time(),
      hours: int(),
      page: int(),
      pageSize: int(),
      total: int(),
      byline: creditSummary,
      articles: arr(
        obj({
          id: int(),
          media: str(),
          mediaTitle: str(),
          title: str(),
          url: str(),
          image: nullable(str()),
          publishedAt: time(),
          tags: arr(str()),
          credits: arr(str('原文署名')),
          entities: arr(creditEntity),
          attributions: arr(ref('Attribution')),
        }),
      ),
    }),
    errors: { '400': '無效的署名或篩選條件', '404': '本期沒有這個署名' },
    cache: '2 分鐘',
    example: '/api/v1/bylines/organization%3Acna?hours=48',
  },

  {
    path: '/api/v1/site-observation',
    tag: 'meta',
    summary: '網站觀測：GA4 與 Search Console 每日彙整',
    description:
      'worker 每小時自 GA4（台灣時間）與 Search Console（美國太平洋時間，含尚未定案的近日資料）讀取彙整數字，近幾天每次重抓覆蓋；live 為 GA Realtime 最近 30 分鐘，約每 2 分鐘更新，超過 15 分鐘未更新則為 null。只含 tag.observe.tw 的流量；不含搜尋字詞、站內搜尋內容或使用者識別資料。traffic／search 在尚無資料時為 null；traffic.daily 從開始追蹤日補零。content 為讀者造訪的內容頁（事件、標籤、議題、專題、文章、記者、媒體），pages 含首頁與索引頁。vitals 需 GA4 已登錄 metric_name／metric_rating 自訂維度，否則為 null。',
    params: [q('days', '期間（含今天）', { type: 'integer', enum: [7, 28, 90], default: 28 })],
    cache: '1 分鐘',
    errors: { '400': 'days 不是 7、28 或 90' },
    response: obj({
      updatedAt: nullable(time()),
      live: nullable(
        obj({
          fetchedAt: time(),
          activeUsers: int('最近 30 分鐘活躍使用者'),
          views: int('最近 30 分鐘瀏覽'),
          perMinute: arr(int(), '每分鐘瀏覽，30 筆，最舊在前'),
        }),
      ),
      days: int(),
      start: str('台北日期 YYYY-MM-DD'),
      end: str('今天（台北）'),
      trackingSince: nullable(str('GA4 第一筆資料的日期')),
      traffic: nullable(
        obj({
          daily: arr(obj({ date: str(), views: int(), sessions: int(), users: int('當日活躍使用者') })),
          views: int(),
          sessions: int(),
          channels: arr(obj({ name: str('GA4 預設管道群組'), value: int('工作階段') })),
          devices: arr(obj({ name: str('desktop／mobile／tablet'), value: int('工作階段') })),
          events: arr(obj({ name: str('open_original／select_content／rss_click／app_installed'), value: int() })),
        }),
      ),
      pages: arr(observationPage, '瀏覽最多的 20 頁'),
      content: arr(observationPage, '瀏覽最多的 10 個內容頁'),
      search: nullable(
        obj({
          daily: arr(obj({ date: str(), clicks: int(), impressions: int(), position: num('平均排名') })),
          clicks: int(),
          impressions: int(),
          position: nullable(num('以曝光加權的平均排名')),
          pages: arr(obj({ path: str(), kind: str(), title: str(), clicks: int(), impressions: int() }), '搜尋點擊最多的 10 頁'),
        }),
      ),
      vitals: nullable(arr(obj({ name: str('LCP／INP／CLS'), good: int(), needsImprovement: int(), poor: int() }), '各評級的樣本數')),
    }),
  },
  {
    path: '/api/v1/similarity',
    tag: 'articles',
    summary: '內文相似與明確引用關係',
    description:
      '讀取全量相似度索引：每篇可用內文都與前後 7 天內其他媒體的全部文章比對，配對永久保存，每 10 分鐘更新；排除「內容」聯播來源。index 揭露期間內的比對篇數與尚待比對篇數。相似連線只使用直接比對，依同署名、明示來源與刊登先後分開彙整；citation 由刊登媒體指向明確提及來源，並不保證最初作者。文章證據另由 /api/v1/similarity/evidence 分頁取得。',
    params: [
      q('hours', '回溯小時；與 from／to 擇一', intIn(1, 168, 48)),
      q('from', '起始台北日期 YYYY-MM-DD（與 to 一起使用，最多 31 天）', str()),
      q('to', '結束台北日期 YYYY-MM-DD（含）', str()),
      q('threshold', '最低 Dice 相似度', { type: 'number', minimum: 0.5, maximum: 1, default: 0.65 }),
    ],
    response: ref('Similarity'),
    errors: { '400': '參數無效' },
    cache: '小時查詢 1 分鐘；日期區間 10 分鐘',
  },
  {
    path: '/api/v1/similarity/evidence',
    tag: 'articles',
    summary: '相似與引用證據（分頁）',
    description:
      '與 /api/v1/similarity 相同期間與門檻的全部證據，最新在前，每頁 20 則。origin 為直接比對的相似文章配對，不推定稿源；citation 為明示引用。可依媒體、連線、方向與關鍵字（標題、媒體、署名、相同片段）篩選。',
    params: [
      q('hours', '回溯小時；與 from／to 擇一', intIn(1, 168, 48)),
      q('from', '起始台北日期 YYYY-MM-DD（與 to 一起使用，最多 31 天）', str()),
      q('to', '結束台北日期 YYYY-MM-DD（含）', str()),
      q('threshold', '最低 Dice 相似度', { type: 'number', minimum: 0.5, maximum: 1, default: 0.65 }),
      q('mode', '關係類型', { type: 'string', enum: ['all', 'similarity', 'citation'], default: 'all' }),
      q('node', '只看與此媒體有關的證據', str()),
      q('edgeRelation', '相似連線視覺分類（同署名優先）', { type: 'string', enum: ['attributed', 'same-byline', 'unattributed'] }),
      q('edgeDirected', '該相似連線是否有箭頭', { type: 'string', enum: ['true', 'false'] }),
      q('edgeKind', '只看一條連線：類型（需同時給 source、target）', { type: 'string', enum: ['similarity', 'citation'] }),
      q('source', '連線起點媒體', str()),
      q('target', '連線終點媒體', str()),
      q('direction', '引用：outgoing 引用他媒、incoming 被引用；相似配對無方向，忽略此參數', {
        type: 'string',
        enum: ['all', 'outgoing', 'incoming'],
        default: 'all',
      }),
      q('scope', '逗號分隔的媒體；兩端都要在內', str()),
      q('focus', '逗號分隔的媒體；至少一端在內', str()),
      q('relation', '相似配對來源線索，指定時只回相似配對', str(undefined, { enum: ['attributed', 'same-byline', 'unattributed'] })),
      q('q', '關鍵字（最多 100 字元）', str()),
      q('page', '頁碼，從 0 開始', { type: 'integer', minimum: 0, default: 0 }),
    ],
    response: ref('SimilarityEvidence'),
    errors: { '400': '參數無效' },
    cache: '小時查詢 1 分鐘；日期區間 10 分鐘',
    example: '/api/v1/similarity/evidence?hours=48&node=cna&mode=similarity',
  },
  {
    path: '/api/v1/similarity/daily',
    tag: 'articles',
    summary: '每日相似配對與引用統計',
    description: '每日已比對篇數、相似配對、內文相同與明示引用，並分列各媒體。資料自 2026 年 9 月開始累積並永久保存。',
    params: [
      q('from', '起始台北日期 YYYY-MM-DD；預設 to 前 29 天', str()),
      q('to', '結束台北日期（含）；預設今天', str()),
      q('threshold', '最低 Dice 相似度', { type: 'number', minimum: 0.5, maximum: 1, default: 0.65 }),
    ],
    response: ref('SimilarityDaily'),
    errors: { '400': '參數無效（最多 366 天）' },
    cache: '含今天 5 分鐘；過去日期 1 小時',
  },
  {
    path: '/api/v1/articles/{id}/similarity',
    tag: 'articles',
    summary: '單篇文章的他站相似報導',
    description: '索引為這篇保存的全部相似配對：與前後 7 天內其他媒體文章比對的結果，刊登多久之後仍可查詢。',
    params: [
      p('id', '文章 id', { type: 'integer', minimum: 1 }, 1),
      q('threshold', '最低 Dice 相似度', { type: 'number', minimum: 0.5, maximum: 1, default: 0.65 }),
    ],
    response: ref('ArticleSimilarity'),
    errors: { '400': '參數無效', '404': '文章不存在' },
    cache: '5 分鐘',
  },
  {
    path: '/api/v1/journalists',
    tag: 'journalists',
    summary: '期間內具名記者一覽',
    description:
      '從文章署名整理出人名或筆名（排除媒體、部門、通訊社、職稱、電頭與責任編輯），列出各自的刊登媒體與篇數。相似統計取自同期間、同門檻的全量相似度索引；compared 為已比對篇數。同名不同人不會分開；較晚刊登只是閱讀線索，不是抄襲判定。',
    params: [
      q('hours', '回溯小時', intIn(1, 168, 48)),
      q('threshold', '最低 Dice 相似度', { type: 'number', minimum: 0.5, maximum: 1, default: 0.65 }),
      q('limit', '最多回傳人數（依篇數排序）', intIn(1, 3000, 500)),
    ],
    response: obj({
      generatedAt: time(),
      hours: int(),
      threshold: num(),
      method: str(),
      index: obj({
        analyzed: int('期間內已比對篇數'),
        pairs: int('期間內門檻以上的相似配對數'),
        windowDays: int(),
        from: time('期間起點'),
      }),
      totals: obj({ journalists: int('具名人數'), articles: int('有人名署名的文章數'), credited: int('有任何署名欄位的文章數') }),
      limit: int(),
      journalists: arr(ref('JournalistSummary')),
    }),
    errors: { '400': '參數無效' },
    cache: '2 分鐘',
    example: '/api/v1/journalists?hours=48&limit=50',
  },
  {
    path: '/api/v1/journalists/{name}',
    tag: 'journalists',
    summary: '單一記者的文章、刊登媒體與他站相似配對',
    description:
      '列出期間內署此名字的文章（以站方署名欄位比對，再以同一套人名整理規則確認）。相似配對來自全量相似度索引：每篇已比對的文章都與前後 7 天內其他媒體的全部文章比對，排除「內容」聯播來源。同署名的跨站版本另計為 sameAuthor。',
    params: [
      p('name', '人名或筆名（2–40 字）', str(), '彭巧蓁'),
      q('hours', '回溯小時', intIn(1, 720, 168)),
      q('threshold', '最低 Dice 相似度', { type: 'number', minimum: 0.5, maximum: 1, default: 0.65 }),
    ],
    response: ref('JournalistDetail'),
    errors: { '400': '參數無效', '404': '期間內沒有文章署此名字' },
    cache: '5 分鐘',
    example: '/api/v1/journalists/%E5%BD%AD%E5%B7%A7%E8%93%81?hours=168',
  },
  {
    path: '/api/v1/articles/{id}/related',
    tag: 'articles',
    summary: '延伸閱讀：同題的其他報導、關鍵字與事件',
    description:
      '刊登前後 3 天內與本篇共用標籤的報導，依標籤稀有度（IDF）與標題相近程度排序：共用 3 個以上標籤即列入；只共用 1–2 個時需標題也相近。標題幾乎相同的轉載只列一篇；內文相似的文章另見 /api/v1/articles/{id}/similarity，這裡不重複。事件依主要標籤重疊判斷，單一常見標籤（如選舉）不足以歸入。',
    params: [p('id', '文章 id', { type: 'integer', minimum: 1 }, 1)],
    response: ref('ArticleRelated'),
    errors: { '400': '文章 id 無效', '404': '文章不存在' },
    cache: '5 分鐘',
  },
  {
    path: '/api/v1/articles/{id}/content',
    tag: 'articles',
    summary: '單篇內文（刊登 7 天內）',
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
    description:
      '以文章 id 遞減分頁；僅回傳內文狀態與長度，單篇內文另由 content API 取得。google_news 與 dongtaiwang 列出經該來源發現的文章；sourceKind 為 discovery、publisher 為 null，每篇文章仍歸屬原刊登媒體。discoverySources 記錄發現來源及網址。',
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
      sourceKind: str('discovery 為文章發現來源；publisher 為刊登媒體', { enum: ['discovery', 'publisher'] }),
      publisher: nullable(ref('OutletIdentity')),
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
      q('trend', '1 表示附上每小時篇數與 24 小時移動平均；截至快照計算時間前的最後完整小時', str('', { enum: ['0', '1'] }), '1'),
      q('related', '1 表示附上每個標籤最常一起出現的標籤', str('', { enum: ['0', '1'] }), '1'),
      q(
        'ranks',
        '1 表示附上每個標籤最近 24 小時的爆發力名次（由每小時快照重算，只在 order=burst 時提供）',
        str('', { enum: ['0', '1'] }),
        '1',
      ),
    ],
    response: obj({
      snapshot: obj({
        id: int(),
        category: str(),
        hourStart: time('快照所屬小時（UTC）'),
        computedAt: time('計算時間'),
        weight: num('固定基準名單的媒體數'),
        basis: ref('RankingBasis'),
        available: bool('是否已滿足基準的 24 小時收錄範圍'),
        articleCount: nullable(int('視窗內基準媒體文章數；舊快照無法完整重建時為 null')),
        mediaCount: nullable(int('視窗內基準媒體中有發文的家數；舊快照為 null')),
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
    description: `依時間窗、關鍵字（標題、摘要或標籤）、媒體、分類、政治傾向、標籤篩選所有爬到的文章，新到舊排序。關鍵字只比對標題、摘要與標籤，不搜尋內文（站內正文只保留刊登後 7 天）。給 \`facets=1\` 會另外回傳整個查詢（不限本頁）依媒體與政治傾向的篇數。時間窗預設為過去 24 小時，最長 ${MAX_SPAN_DAYS} 天。還有下一頁時 \`nextCursor\` 不為 null，把它原樣放進 \`cursor\` 參數（其他參數不變）取下一頁。`,
    params: [
      q('q', '標題或摘要包含這段文字，或文章帶有完全相同的標籤（最多 60 字）', str(), '颱風'),
      q('credit', '原文署名包含這段文字，最多 120 字', str()),
      q('source', '明示引用的來源代碼，例如 cna、reuters', str()),
      q('section', '原站分類完整名稱（完全相符）', str()),
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
      q('settled', '1 表示略過刊登時間還沒確認的文章（datePending 為 true 的那些），facets 也一併略過', str('', { enum: ['0', '1'] }), '1'),
    ],
    response: obj(
      {
        query: obj({
          q: nullable(str()),
          credit: nullable(str()),
          source: nullable(str()),
          section: nullable(str()),
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
            description: nullable(str('媒體提供的 description')),
            summary: nullable(str('媒體摘要；未取得時為 null')),
            summarySource: nullable(str('摘要取自原文摘要區、JSON-LD abstract、meta 或 feed；與 description 來源明確區分')),
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
    description:
      '每個完整小時一點。hourlyCount 從收錄文章按發布時間統計，average24h 為當小時及前 23 小時篇數總和 ÷ 24，無報導小時以 0 計，並讀取顯示範圍前 23 小時。整條曲線只使用 basis 的固定媒體，score/count 也從文章重算 24 小時加權分數／累計篇數。rank 是該小時排行快照中依原始分數的名次（同一分類）；該小時沒有快照或未進入儲存的榜單時為 null。coverageFrom 前的篇數、validFrom 前的平均與分數均為 null；收錄開始後的空小時以零計。歷史篇數反映目前資料庫收錄，可包含後來補抓的文章。',
    params: [p('tag', '標籤（URL 編碼）', str(), '賴清德'), categoryParam, q('hours', '往前幾小時', intIn(1, 336, 72), 168)],
    response: obj({
      tag: str(),
      category: str(),
      hours: int(),
      basis: ref('RankingBasis'),
      points: arr(
        obj({
          t: time('完整小時起點（UTC）'),
          score: nullable(num('24 小時正規化分數')),
          count: nullable(int('固定基準 24 小時累計篇數，非單小時篇數')),
          rank: nullable(int('該小時快照中依原始分數的名次；沒有快照或未入榜為 null')),
          hourlyCount: nullable(int('該小時收錄篇數；收錄開始前為 null')),
          average24h: nullable(num('24 小時移動平均（篇／小時）；歷史不足為 null')),
        }),
      ),
    }),
    errors: { '404': '未知分類' },
    example: '/api/v1/tags/%E8%B3%B4%E6%B8%85%E5%BE%B7/series?hours=168',
  },
  {
    path: '/api/v1/tags/{tag}/status',
    tag: 'tags',
    summary: '標籤目前狀態',
    description:
      '關鍵字頁的摘要：這個標籤在新聞媒體排行榜上的名次、分數、爆發力、24 小時變動與報導媒體家數（不在榜上為 null）、最常一起出現的標籤、最近 72 小時含這個標籤的事件串，以及長期統計的首次上榜與高峰。',
    params: [p('tag', '標籤（URL 編碼）', str(), '賴清德')],
    response: obj({
      tag: str(),
      ranking: nullable(
        obj({
          category: str('排行分類；目前固定為 news'),
          hourStart: time('快照所屬小時'),
          position: int('依爆發力的名次'),
          rank: int('依原始分數的名次'),
          normalized: num('正規化分數'),
          burst: nullable(num('爆發力')),
          count: int('過去 24 小時文章數'),
          mediaCount: int('報導的基準媒體家數'),
          basisMediaCount: int('基準媒體總數'),
          rank24h: nullable(int('24 小時前依分數的名次')),
          new: bool('24 小時前不在完整榜單上'),
        }),
      ),
      related: arr(
        obj({ tag: str(), count: int('共同文章數'), share: num('佔這個標籤文章數的比例（0–1）') }),
        '最多 8 個，依共同文章數排序',
      ),
      threads: arr(
        obj({
          id: int('事件串 id；頁面為 /eve/{id}/'),
          maxTag: nullable(str('事件串的代表標籤')),
          majorTags: arr(str()),
          firstTime: time(),
          lastTime: time(),
          hours: int('出現在事件榜的小時數'),
          maxScore: num('最高分'),
        }),
        '最近 72 小時內含這個標籤的 news 事件串，最多 6 個，最近活動的在前',
      ),
      history: nullable(
        obj(
          {
            level: int('2 或 3；優先回傳 3'),
            firstHour: time('首次上榜小時'),
            lastHour: time('最近上榜小時'),
            hoursCount: int('上榜小時數'),
            maxHour: time('文章數最多的小時'),
            maxCount: int('該小時文章數'),
          },
          'news 分類的長期統計',
        ),
      ),
    }),
    example: '/api/v1/tags/%E8%B3%B4%E6%B8%85%E5%BE%B7/status',
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
      dayStats: arr(obj({ hour: time(), top: num('該小時第 1 名的爆發力'), count: int('該小時事件數') }), '同一台北日內每個快照小時的概況'),
      baseline: campBaseline('過去 24 小時'),
      events: arr(
        obj({
          rank: int(),
          score: num(),
          major: arr(str(), '主要標籤'),
          tags: arr(obj({ tag: str(), burst: num() }), '事件內所有標籤與爆發力'),
          news: arr(ref('Headline'), '代表新聞（最多 6 則），各附媒體陣營 camp'),
          relatedEventPk: nullable(str('= threadId 的字串形式（相容舊版）')),
          threadId: nullable(int('事件串 id，可查 /api/v1/events/threads/{id}')),
          prevRank: nullable(int('前一個快照的名次（依事件串或主要標籤比對）；null 表示本小時新上榜')),
          hours: nullable(int('事件串到這個小時為止已出現的小時數')),
          rankTrail: nullable(arr(nullable(int()), '事件串在截至本小時的 24 個快照小時的名次（最舊在前）；不在榜上的小時為 null')),
          firstTime: nullable(time('事件串第一次上榜的小時')),
          coverage: eventCoverage('過去 24 小時'),
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
    description:
      '台北時間某一天內曾出現的事件串，依最高分排序（最多 300 個）。`days` 列出所有有資料的日期。藍綠報導（`coverage`、`baseline`）的窗口是到當天結束為止的 24 小時，也就是當天整天；今天則是到現在為止的 24 小時，與 /api/v1/events 相同。',
    params: [q('day', '台北日期 YYYY-MM-DD，預設今天', str(undefined, { pattern: '^\\d{4}-\\d{2}-\\d{2}$' }), '2026-09-30')],
    response: obj({
      day: str(),
      days: arr(str()),
      dayHours: arr(time(), '當天所有有快照的小時'),
      dayStats: arr(obj({ hour: time(), top: num('該小時第 1 名的爆發力'), count: int('該小時事件數') }), '當天每個快照小時的概況'),
      baseline: campBaseline('當天'),
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
          rankTrail: nullable(arr(nullable(int()), '到 trailEnd 為止 24 個快照小時的名次（最舊在前）；不在榜上的小時為 null')),
          trailEnd: nullable(time('名次走勢的最後一小時：事件串當天最後在榜的小時')),
          coverage: eventCoverage('當天'),
          news: arr(ref('Headline'), '最佳名次那一小時的代表新聞（最多 6 則），各附媒體陣營 camp'),
        }),
      ),
    }),
    errors: { '400': '日期格式錯誤' },
    example: '/api/v1/events/threads?day=2026-09-30',
  },
  {
    path: '/api/v1/events/threads/period',
    tag: 'events',
    summary: '過去 1、3、7 或 31 天的主要事件串',
    description:
      '依事件串在期間內每小時分數的總和排序，在榜越久、越前面的越重；同一則新聞被拆成不同事件串時（主要標籤過半重疊或第一個標籤相同）只留較重的一個。藍綠報導（`coverage`、`baseline`）的窗口是整段期間。',
    params: [q('days', '期間天數：1、3、7 或 31，預設 1', int(), '7'), q('limit', '回傳幾個事件串，1 到 12，預設 6', int(), '6')],
    response: obj({
      days: int(),
      from: time(),
      to: time(),
      baseline: campBaseline('期間內'),
      threads: arr(
        obj({
          id: int(),
          firstTime: time(),
          lastTime: time(),
          majorTags: arr(str()),
          maxTag: nullable(str('分數最高的標籤')),
          weight: num('期間內每小時分數的總和'),
          hours: int('期間內在榜的小時數'),
          bestRank: int('期間內的最佳名次'),
          coverage: eventCoverage('期間內'),
          news: arr(ref('Headline'), '期間內最佳名次那一小時的代表新聞（最多 6 則），各附媒體陣營 camp'),
        }),
      ),
    }),
    errors: { '400': '`days` 不是 1、3、7 或 31' },
    example: '/api/v1/events/threads/period?days=7',
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
    description:
      '事件主要標籤（最多 6 個）以固定媒體基準重算每小時分數，歷史不足為 null；藍／綠／其他報導數則涵蓋所有媒體。前後各多 12 小時，只畫已完成小時。',
    params: [threadId],
    response: obj({
      threadId: int(),
      basis: ref('RankingBasis'),
      tags: arr(str()),
      from: time(),
      to: time(),
      points: arr(
        obj({
          t: time(),
          blue: int('藍營傾向媒體文章數'),
          green: int('綠營傾向媒體文章數'),
          other: int('其他媒體文章數'),
          tags: nullable(map(obj({ score: nullable(num()), rank: nullable(int('固定為 null')) }))),
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
    path: '/api/v1/topics/{id}/stories',
    tag: 'topics',
    summary: '議題／專題實際收錄的新聞索引',
    description:
      '累計原站議題／專題頁實際列出的文章，不限報導日期。依報導日期由新到舊排列，未知日期在後。已收錄文章提供本站 id；未收錄的提供原文 url。舊資料尚未還原的連結為 null。此清單不使用名稱或文章標籤推測成員，也不修改原文標籤。分頁或動態載入的文章可能尚未完整取得。',
    params: [{ name: 'id', in: 'path', required: true, description: '議題／專題 ID', schema: int() }],
    response: obj({
      id: str(),
      media: ref('MediaKey'),
      mediaTitle: str(),
      title: str(),
      kind: str(undefined, { enum: ['topic', 'feature', 'article'] }),
      url: str(),
      image: nullable(str()),
      articleId: nullable(int('專題頁本身的文章 ID；透過文章 content API 取得內文與圖片')),
      checkedAt: nullable(time()),
      total: int(),
      stories: arr(
        obj({
          key: str(),
          title: str(),
          url: nullable(str()),
          id: nullable(int()),
          date: nullable(time()),
          description: nullable(str()),
          image: nullable(str()),
          tags: arr(str()),
          authors: arr(str()),
        }),
      ),
    }),
    errors: { '400': 'id 格式錯誤', '404': '找不到' },
    example: '/api/v1/topics/1/stories',
  },
  {
    path: '/api/v1/topics',
    tag: 'topics',
    summary: '各媒體的議題／專題',
    description:
      '`kind=topic`（預設）為議題：持續增加新聞的集合；`kind=feature` 為專題：一次性的新聞包（長文、微網站或一次發完的系列）。媒體入口有宣告者依宣告，其餘依專題頁所列新聞的日期判定。不給 `media`：跨媒體合併的議題流（`feed`，依最後更新新到舊，附站內相關報導 `coverage`，不含已停更與更新時間不明者；開始追蹤前已上架的議題有新報導也會列入）與各媒體最近更新的議題（`media`）。給 `media`：只回該媒體最近更新的議題（同樣附 `coverage`），子議題列在上層議題的 `children`。給 `tag` 或 `q`（且不給 `media`）：依 kind，回所有媒體帶這個標籤／名稱含這段文字的同類型上層項目（含已停更，不附 coverage），依媒體分組：符合數多的媒體在前，同一媒體依最後更新新到舊、更新時間不明者在後。不給 `media` 時都附 `tags`：指定 kind 的未停更上層項目名稱中最常見的站內標籤（依媒體家數，前 40 個）。所有列表依最後更新（`updatedAt`）排序：議題頁上最新一則報導的時間；沒有報導日期的用本站首次發現時間（backlog 則為不明，排最後）。每小時 :50 檢查官方入口，`check` 顯示各媒體檢查狀態；部分入口失敗時保留成功結果與既有資料。',
    params: [
      q('kind', 'topic 議題（預設）或 feature 專題', str(undefined, { enum: ['topic', 'feature'] }), 'feature'),
      q('media', '只取這家媒體（須為有追蹤議題的媒體）', ref('MediaKey'), 'pts'),
      q('limit', '筆數：有 media 時預設 20、最多 200；否則為 feed 筆數，預設 60、最多 120', { type: 'integer', minimum: 1 }, 20),
      q('per', '沒給 media 時，每家媒體附幾則最近議題', intIn(1, 10, 4), 2),
      q('tag', '只取指定 kind 中名稱對應到這個站內標籤的項目（跨媒體）', str(), '核電'),
      q('q', '只取指定 kind 中名稱含這段文字的項目（不分大小寫，最多 50 字；跨媒體）', str(), '選舉'),
    ],
    response: {
      oneOf: [
        obj(
          {
            kind: str(undefined, { enum: ['topic', 'feature'] }),
            media: arr(
              obj({
                media: ref('MediaKey'),
                title: str(),
                icon: nullable(str()),
                link: str('媒體議題列表頁'),
                check: ref('TopicCheck'),
                count: int('該媒體累計追蹤到的 kind 類項目數'),
                counts: ref('TopicCounts'),
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
                  coverage: ref('TopicCoverage'),
                }),
              ],
            }),
            tags: arr(ref('TopicTagCount'), '指定 kind 最常見的標籤'),
          },
          '不給 media',
        ),
        obj(
          {
            kind: str(undefined, { enum: ['topic', 'feature'] }),
            tag: nullable(str()),
            q: nullable(str()),
            total: int('符合的項目數'),
            mediaCount: int('符合的媒體家數'),
            counts: obj({ topic: int('符合的議題數'), feature: int('符合的專題數') }),
            topics: arr(
              {
                allOf: [ref('TopicItem'), obj({ media: ref('MediaKey'), mediaTitle: str(), icon: nullable(str()) })],
              },
              '依媒體分組；limit 預設 300、最多 500',
            ),
            tags: arr(ref('TopicTagCount'), '指定 kind 最常見的標籤'),
          },
          '給 tag 或 q（不給 media）',
        ),
        obj(
          {
            media: ref('MediaKey'),
            kind: str(undefined, { enum: ['topic', 'feature'] }),
            title: str(),
            link: str(),
            mediaImage: nullable(str()),
            check: ref('TopicCheck'),
            count: int('該媒體累計追蹤到的 kind 類項目數'),
            counts: ref('TopicCounts'),
            topics: arr({
              allOf: [
                ref('TopicItem'),
                obj({ coverage: ref('TopicCoverage'), children: arr(ref('TopicItem'), '子議題（不分 kind，不附 coverage）') }),
              ],
            }),
          },
          '給 media',
        ),
      ],
    },
    errors: { '400': 'kind 不是 topic 或 feature', '404': '該媒體沒有追蹤議題' },
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
        camp,
      }),
      '媒體代碼 → 名稱、圖示與政治傾向分組',
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
    path: '/api/v1/media-traffic-comparison',
    tag: 'media',
    summary: '本站爬蟲跨月收錄量',
    description:
      '依台北時間發布月份統計本站自行抓取（source=own）的文章，排除發布日期待定與未來文章，不限正文狀態。包含新聞來源清單與媒體目錄的所有來源，供介面對照原始 Similarweb 月份資料；本端點不提供流量數字。月份升冪排列，從參考表最舊月份延續至當月；連續區間最多保留近 24 個月，另保留較早的原表月份。當月只統計截至 generatedAt 的資料。早於首次收錄月份的正數是補收舊文章，並非完整歷史月；零筆也不代表當時沒有發稿。發現來源透過關聯統計原媒體文章，不改變文章歸屬，跨來源加總時應排除 discovery 避免重複計算。',
    response: obj({
      generatedAt: time('統計產生時間；所有月份均為此時間點的已收錄資料'),
      collectionStartedAt: nullable(time('本站自行抓取文章的最早收錄時間；不含 legacy 匯入，沒有紀錄時為 null')),
      months: arr(str('台北發布月份，格式 YYYYMM', { pattern: '^\\d{4}(?:0[1-9]|1[0-2])$' }), '可用比較月份，升冪排列'),
      media: arr(
        obj({
          media: ref('MediaKey'),
          sourceKind: str('publisher 為原刊登媒體；discovery 為文章發現來源', { enum: ['publisher', 'discovery'] }),
          firstAcquiredAt: nullable(time('刊登媒體為首次自行抓取時間，發現來源為首次發現時間；不受月份範圍限制，從未收錄為 null')),
          monthly: arr(
            obj({
              month: str('對應 months 的台北發布月份', { pattern: '^\\d{4}(?:0[1-9]|1[0-2])$' }),
              articles: { ...int('目前資料庫中該來源、該發布月的文章數；0 表示零筆已收錄文章，不保證歷史收錄完整'), minimum: 0 },
            }),
            '每個可用月份皆有一筆；無文章時回傳 0，不以 null 取代已知筆數',
          ),
        }),
      ),
    }),
    cache: '5 分鐘',
  },
  {
    path: '/api/v1/media-stats',
    tag: 'media',
    summary: '各媒體收錄量與爬蟲狀態',
    description:
      '列出已登錄媒體，包含未啟用抓取與僅作為引用來源者，排除重複代碼。發現來源的個別列依文章關聯計量；全站文章總數僅計原刊登媒體，避免重複計算。today 為台北時間今天 0 點起。status：ok 正常、stale 太久沒有新文章、failing 近 3 小時爬取全部失敗、disabled 未啟用定期抓取（含停用）。',
    response: obj({
      generatedAt: time(),
      todayStart: time(),
      summaryWindow: obj({
        since: time(),
        until: time(),
        hours: int('摘要統計窗口，168 小時'),
        basis: str('以出版時間界定窗口，published_at'),
      }),
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
          sourceKind: str('discovery 為文章發現來源，篇數透過關聯計算；publisher 為刊登媒體，全站文章總數不重複計入發現來源', {
            enum: ['discovery', 'publisher'],
          }),
          category: nullable(str()),
          categoryLabel: nullable(str()),
          camp,
          schedule: str('爬取頻率；hourly 或 every N min；未啟用時為 off'),
          crawlSchedule: obj({
            intervalMinutes: nullable(num('實際逐媒體最小巡查間隔（分鐘）')),
            reason: str('調整依據'),
            reviewedAt: time('排程評估時間'),
            nextEligibleAt: nullable(time('最早可巡查時間；不是佇列保證開始時間')),
            lastStartedAt: nullable(time()),
            running: bool(),
          }),
          crawlHealth: obj({
            runs24h: int('近24小時已完成巡查與內文抓取次數'),
            failures24h: int('含部分失敗的有錯誤執行次數'),
            lastFailureAt: nullable(time()),
          }),
          country: str('媒體營運／在地發行版本的國家或地區，不是報導發生地'),
          countryCode: str('國家或地區代碼；INT 跨國、ZZ 待確認'),
          scope: nullable(
            obj({
              scope: str('本站實際收錄版本主要服務的讀者範圍', {
                enum: ['tw', 'tw-foreign', 'intl-zh', 'cn', 'hkmo', 'sgmy', 'overseas-zh', 'zh-special', 'foreign'],
              }),
              scopeLabel: str(),
              language: str('收錄版本的文字', { enum: ['zh-Hant', 'zh-Hans', 'en', 'ja'] }),
              languageLabel: str(),
              roles: arr(obj({ role: str(undefined, { enum: ['wire', 'platform', 'discovery', 'corporate'] }), label: str() })),
              coverage: nullable(str('實際收錄範圍與歷史差異，例如只收某個頻道或版本')),
            }),
          ),
          crawler: obj({
            methods: arr(str('依實際設定呈現 RSS、Sitemap、JSON API、HTML 或文章發現流程')),
            transport: nullable(str('HTTP、curl 或瀏覽器工具')),
            body: str('正文或標題摘要收錄方式'),
            lastVerifiedMethod: nullable(str('最近匹配目前入口的成功驗證方式')),
            links: arr(obj({ label: str(), url: str('GitHub 設定或解析程式連結') })),
          }),
          summary: nullable(
            obj(
              {
                total: int('窗口內已出版且日期已確認的本站文章數；不含議題／專題包裝頁'),
                withSummary: int('目前存有非空 summary 的文章數；不表示全部欄位已人工驗證'),
                sources: arr(str('實際取得的 summarySource；unknown 表示來源未記錄')),
                exampleId: nullable(int('有摘要的站內文章範例，優先選原文導言；不是最新文章保證')),
              },
              '文章發現入口為 null，摘要需查看原刊登媒體',
            ),
          ),
          today: int(),
          last24h: int(),
          last7d: int(),
          collectingSince: nullable(time()),
          totalCollected: int(
            '本站爬蟲歷來儲存的紀錄筆數（source=own，含專題頁、待確認日期紀錄，不含歷史匯入）；探索平台計已連結文章的發現紀錄',
          ),
          pendingDate: int('尚未確定發布時間的文章數'),
          taggedShare24h: nullable(num()),
          lastArticle: nullable(time()),
          lastCrawlOk: nullable(time()),
          status: str(undefined, { enum: ['ok', 'stale', 'failing', 'disabled'] }),
          topics: nullable(
            obj(
              {
                media: str('議題爬蟲使用的媒體代碼（報導者為 twreporter）'),
                sources: arr(ref('TopicSource'), '最近一次完成檢查的各入口結果'),
                checkedAt: nullable(time('最近一次完成檢查時間')),
                lastSuccessAt: nullable(time('最近一次所有入口成功的時間')),
                status: str('ok、partial、failed、running 或 pending'),
                counts: ref('TopicCounts'),
                rulesUrl: str('GitHub 上該媒體議題爬蟲規則的位置'),
              },
              '議題／專題爬蟲；沒有追蹤議題的媒體為 null',
            ),
          ),
        }),
      ),
    }),
  },
  {
    path: '/api/v1/liveboard',
    tag: 'articles',
    summary: '即時看板輪詢：新文章、相似報導組與發稿量',
    description:
      '給 /liveboard/ 這類常駐畫面輪詢。不帶參數時回最近 3 小時內收錄的 40 篇本站爬取文章與最近的相似報導組；之後把回應的 cursor 原樣帶回，只取新收錄的文章（依收錄順序，不是發布時間，晚抓到的也不會漏）與新算出的相似報導組。相似報導組是 3 小時內算出的正文相似配對連起來的一群文章，最早發布者為 lead，其餘依是否直接相似、相似度排序。stats 為依發布時間的各陣營發稿量。',
    params: [
      q('after', '上次回應的 cursor.after（文章 id）', { type: 'integer', minimum: 0 }, 23198458),
      q('pairsAfter', '上次回應的 cursor.pairsAfter', time()),
      q('readAfter', '上次回應的 cursor.readAfter', time()),
    ],
    errors: { '400': 'after、pairsAfter 或 readAfter 格式錯誤' },
    cache: '15 秒（相似報導組與 stats 每分鐘更新）',
    response: obj({
      generatedAt: time(),
      cursor: obj({ after: nullable(int()), pairsAfter: nullable(time()), readAfter: nullable(time()) }, '下次輪詢原樣帶回'),
      articles: arr(
        obj({
          id: int(),
          media: ref('MediaKey'),
          mediaTitle: str(),
          camp,
          title: str(),
          url: str(),
          image: nullable(str()),
          publishedAt: time(),
          datePending: bool('發布時間仍只是首次看到的時間'),
          tags: arr(str(), '前 8 個標籤'),
          authors: arr(str(), '原始作者署名（包含具名作者與機構）'),
          attributions: arr(ref('Attribution'), '原文明示的內容提供者或引用媒體及證據'),
          text: nullable(str('內文開頭（新文章 600 字、相似報導組的 lead 與前 3 篇同組文章 1500 字），沒有內文時為摘要')),
        }),
        '新收錄文章，新的在前，最多 40 篇',
      ),
      stories: arr(
        obj({
          key: str('lead 文章 id'),
          computedAt: time('組內最新配對的計算時間'),
          lead: obj({}, '最早發布的文章，欄位同 articles'),
          followers: arr(
            obj({
              article: obj({}, '欄位同 articles'),
              score: num('Dice 相似度（0.5–1）'),
              containment: num(),
              kind: str(undefined, { enum: ['identical', 'high'] }),
              evidence: str('共同段落摘錄'),
              relation: ref('PairRelationInfo'),
              direct: bool('false 表示只與組內其他文章相似，不能展示為與 lead 相似'),
              gapMinutes: int('比 lead 晚幾分鐘發布'),
            }),
          ),
          more: int('未列出的同組文章數'),
        }),
        '新算出的相似報導組，最多 12 組',
      ),
      activity: obj(
        {
          crawls: arr(
            obj({
              media: ref('MediaKey'),
              mediaTitle: str(),
              stage: str('index 來源巡查、article 抓取內文、topic 議題'),
              at: time('結束時間，執行中為開始時間'),
              running: bool(),
              inserted: int('新增文章數'),
              failed: bool(),
            }),
            '近 10 分鐘的爬取，新的在前，最多 40 筆',
          ),
          running: arr(obj({ job: str(), since: time() }), '執行中的排程工作'),
          upcoming: arr(obj({ job: str(), label: str(), at: time() }), '接下來的 8 個排程工作'),
        },
        '爬蟲與排程工作動態；每 15 秒更新',
      ),
      topics: arr(
        obj({
          id: int(),
          media: ref('MediaKey'),
          mediaTitle: str(),
          title: str(),
          url: str(),
          image: nullable(str()),
          kind: str('topic 議題、feature 專題', { enum: ['topic', 'feature'] }),
          isNew: bool('24 小時內新出現；否則為新增了報導'),
          at: time('新出現或新增報導的時間'),
          storyCount: nullable(int()),
          stories: arr(
            obj({
              title: str(),
              url: nullable(str()),
              date: nullable(time()),
              article: nullable(obj({}, '對應的已收錄文章，欄位同 articles，text 為內文前 160 字')),
            }),
            '頁面上最新的 4 則報導',
          ),
        }),
        '6 小時內新增報導或 24 小時內新出現的議題／專題，每家媒體最多 2 個，最多 12 個',
      ),
      reading: arr(
        obj({}, '欄位同 articles，text 為內文前 700 字'),
        '6 小時內發布、最近取得內文的 20 篇中，晚於 readAfter 取得的；最新取得的在前，每分鐘更新',
      ),
      stats: obj({
        last60m: arr(obj({ t: time(), blue: int(), green: int(), other: int() }), '近 60 分鐘每 5 分鐘'),
        hourly24: arr(obj({ t: time(), blue: int(), green: int(), other: int() }), '近 24 小時逐時'),
        total24h: int(),
        activeMedia1h: int('近 1 小時有發稿的媒體數'),
      }),
      visitors: nullable(
        obj(
          { activeUsers: int(), views: int(), perMinute: arr(int(), '近 30 分鐘每分鐘瀏覽數，舊的在前') },
          '本站 GA 即時資料；即時工作停擺時為 null',
        ),
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
    '標題、圖片與內文著作權屬原媒體；本 API 提供標題、連結、統計及刊登 7 天內的擷取文字。使用資料請註明「資料來源：新文易數 tag.observe.tw」。',
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
