import { describe, expect, it } from 'vitest';
import { analyzeArticle } from './analyze.ts';
import { nameMatcher, type Person, resolveTally, type Tally, tallyMentions } from './people.ts';
import { posterName, socialPost, stripTitle, titleTags } from './rules.ts';

const pad = (lead: string) => `${lead}${'其餘內文。'.repeat(60)}`;

describe('socialPost', () => {
  it.each([
    ['精神科醫師沈小明10日在臉書貼文表示，致詞罵得太好。', 'Facebook', '醫療健康', '沈小明'],
    ['台北市長王大同3日在臉書發文提到政策。', 'Facebook', '公職政治', '王大同'],
    ['前立委陳一二今天在臉書發文批評。', 'Facebook', '前任公職', '陳一二'],
    ['媒體人林三四在節目中表示，選情恐怕不妙。', '節目直播', '評論名嘴', '林三四'],
    ['一名網友在Threads發文抱怨主管深夜傳訊息。', 'Threads', '網友民眾', null],
    ['台大大氣科學博士林五六今天在臉書粉專「氣象站」發布最新預報。', 'Facebook', '專家企業', '林五六'],
    ['美國總統川普10日於社群平台X發文宣布。', 'X', '公職政治', '川普'],
    ['春山出版在臉書發文表示，已向主辦方表達意見。', 'Facebook', '機構', null],
  ])('%s', (lead, platform, role, name) => {
    const post = socialPost(pad(lead));
    expect(post).toMatchObject({ platform, role });
    if (name) expect(post?.name).toBe(name);
  });

  it.each([
    ['前國民黨主席洪一二卻是在臉書發文高喊口號。', 'Facebook', '前任公職', '洪一二'],
    ['氣象粉專「颱風論壇」今日分享雙颱畫面。', 'Facebook', '氣象', '颱風論壇'],
    ['政治評論員吳三四說，對手失算。吳三四發文指出，留言破紀錄。', '社群', '評論名嘴', '吳三四'],
    ['日本學者小五六分析國慶演說。小五六10日在臉書發文分析。', 'Facebook', '專家企業', '小五六'],
    ['經常對時事發表看法的施七八，7日在個人臉書分享看法。', 'Facebook', '未知', '施七八'],
    ['該名駕駛在社群平台 Threads 上發文抱怨。', 'Threads', '網友民眾', null],
    ['衛福部次長林九十也接連在臉書發文。', 'Facebook', '公職政治', '林九十'],
    ['吳十二在氣象應用推廣基金會專欄發文指出，冷空氣將南下。', '社群', '氣象', '吳十二'],
    ['政治工作者周十三今日在臉書發文。', 'Facebook', '評論名嘴', '周十三'],
    ['南韓總統李在明今天在社群平台X發文。', 'X', '公職政治', '李在明'],
    ['多名議員今天就總統之子遭跟監一事在社群媒體發文。', '社群', '公職政治', null],
    ['王小妤在影片曝光後甜蜜發文寫道，一起加油。', '社群', '未知', '王小妤'],
    ['美國總統特使威小夫9日在社交媒體發文說，局勢緩和。', '社群', '公職政治', '威小夫'],
  ])('%s', (lead, platform, role, name) => {
    const post = socialPost(pad(lead));
    expect(post).toMatchObject({ platform, role, name });
  });

  it('does not take an interview on a named programme for a post', () => {
    expect(socialPost(pad('副市長李四川接受節目「少康戰情室」專訪表示，選情穩定。'))).toBeNull();
  });

  it('does not take 「在臉書上可以說」 or 前往 for a post or a former title', () => {
    expect(socialPost(pad('留言數遠超過按讚數，在臉書上可以說是被炎上。'))).toBeNull();
    expect(socialPost(pad('市長前往總統府後，王大同在臉書發文。'))?.role).toBe('未知');
  });

  it('uses the clause after the last comma, not an earlier subject', () => {
    const post = socialPost(pad('立法院長韓大華在典禮上致詞，作家周七八則在臉書發文回應。'));
    expect(post?.role).toBe('評論名嘴');
  });

  it('leaves a bare name 未知 for the people dictionary', () => {
    const post = socialPost(pad('對此，邱九十今天在臉書發文質疑。'));
    expect(post).toMatchObject({ role: '未知', roleSource: null, name: '邱九十' });
  });

  it('ignores posts mentioned after the lead and short bodies', () => {
    expect(socialPost(pad(`${'記者會內容。'.repeat(50)}王大同在臉書發文。`))).toBeNull();
    expect(socialPost('市長在臉書發文。')).toBeNull();
    expect(socialPost(pad('警方今天在記者會上說明案情。'))).toBeNull();
  });
});

describe('names', () => {
  it('drops time words and pronouns', () => {
    expect(posterName('邱九十今天')).toBe('邱九十');
    expect(posterName('沈小明10日')).toBe('沈小明');
    expect(posterName('他日前')).toBeNull();
    expect(stripTitle('科醫師沈小明')).toBe('沈小明');
  });

  it('learns the majority role of names that are tags', () => {
    const tally: Tally = new Map();
    const matcher = nameMatcher(['邱九十', '隨後'])!;
    for (const body of ['前立委邱九十說', '前立委邱九十指出', '前立委邱九十表示', '立委邱九十', '隨後市長隨後'])
      tallyMentions(tally, matcher, body);
    const resolved = resolveTally(tally, new Set(['邱九十']));
    expect(resolved.get('邱九十')).toMatchObject({ role: '前任公職', hits: 3, total: 4 });
    expect(resolved.has('隨後')).toBe(false);
  });
});

describe('analyzeArticle', () => {
  const people = new Map<string, Person>([
    ['邱九十', { role: '前任公職', source: 'auto' }],
    ['沈小明', { role: '評論名嘴', source: 'admin' }],
  ]);
  it('resolves bare names, and admin corrections win over the clause', () => {
    expect(analyzeArticle('標題', pad('邱九十今天在臉書發文。'), people)).toMatchObject({
      role: '前任公職',
      poster: '邱九十',
      roleSource: 'people',
    });
    expect(analyzeArticle('標題', pad('精神科醫師沈小明在臉書發文。'), people)).toMatchObject({ role: '評論名嘴', roleSource: 'people' });
    expect(analyzeArticle('標題', pad('今天天氣晴。'), people)).toMatchObject({ platform: null, role: null });
  });
});

describe('titleTags', () => {
  it.each([
    ['讚韓大華罵太好 名醫看到總統致詞反應驚人', ['反應']],
    ['打瘦瘦針沒效 醫：使用前先做1事', ['懸念']],
    ['議員怒轟市府 市長回應了', ['懸念', '攻擊']],
    ['颱風明起影響北部 氣象署發布海警', []],
  ])('%s', (title, tags) => expect(titleTags(title)).toEqual(tags));
});
