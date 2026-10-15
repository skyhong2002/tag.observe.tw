import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { load } from 'cheerio';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import * as crawlers from '../src/lib/media-crawlers.mts';

const requireWeb = createRequire(new URL('../package.json', import.meta.url));
const React = requireWeb('react');
const { renderToStaticMarkup } = requireWeb('react-dom/server');
const h = React.createElement;
const noop = () => null;
const link = ({ children, prefetch: _prefetch, icon: _icon, ...props }: Record<string, unknown>) => h('a', props, children);

// Compile only the component under test in memory. Every runtime import must
// appear in this whitelist; no app/server module or network service is loaded.
// SSR exercises markup with explicitly seeded hook state, not browser layout.
function component(path: string, imports: Record<string, unknown> = {}, states?: unknown[]) {
  let index = 0;
  const hooks = states
    ? {
        ...React,
        useState: (initial: unknown) => [
          index < states.length ? states[index++] : typeof initial === 'function' ? initial() : initial,
          vi.fn(),
        ],
        useEffect: () => {},
        useRef: () => ({ current: null }),
        useId: () => 'suggest-test',
        useMemo: (fn: () => unknown) => fn(),
      }
    : React;
  const allowed = { react: hooks, 'react/jsx-runtime': requireWeb('react/jsx-runtime'), 'next/link': { default: link }, ...imports };
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {} as { default: (props: Record<string, unknown>) => unknown };
  runInNewContext(code, {
    exports,
    require: (name: string) => {
      if (!(name in allowed)) throw new Error(`Unmocked component dependency: ${name}`);
      return allowed[name as keyof typeof allowed];
    },
    URLSearchParams,
    AbortController,
    setTimeout,
    clearTimeout,
  });
  return exports.default;
}
const panel = component('../src/components/TagRelationsPanel.tsx', { './reader/TagRelationSubmission': { default: noop } });
const table = component('../src/components/MediaCrawlersTable.tsx', {
  'next/image': { default: noop },
  '@/components/FilterSuggestInput': { default: noop },
  '@/lib/api': { taipei: (text: string) => text },
  '@/lib/media-crawlers.mts': crawlers,
  '@/lib/media-icons': { localMediaIcon: () => null, mediaIconClass: () => '' },
  '@/lib/table-styles': { table: {} },
  './MediaHoverLink': { default: link },
  './SortIndicator': { default: noop },
  './TableScroller': { default: component('../src/components/TableScroller.tsx') },
});
type Session = { enabled: boolean; user?: { role: string } | null } | null;

function adminPage(session: Session) {
  const gate = component('../src/app/(site)/admin/AdminGate.tsx', {
    '@/lib/session': { useSession: () => session, loginHref: (next: string) => `/login/?${new URLSearchParams({ next })}` },
  });
  // Keep each child's existing gate: this catches duplicate permission messages
  // if the shared parent gate is removed while preserving admin-only contents.
  const child =
    (name: string) =>
    ({ initialTag }: Record<string, unknown>) =>
      h(gate, { next: '/admin/tags/' }, h('section', { 'data-editor': name, 'data-tag': initialTag }, name));
  return component('../src/app/(site)/admin/tags/page.tsx', {
    '../AdminGate': { default: gate },
    '../avatars/AvatarReview': { default: noop },
    '../tag-groups/TagGroupEditor': { default: noop },
    '../tag-visuals/TagVisualReview': { default: noop },
    '../writing/WritingPeople': { default: child('writing') },
    './TagArticles': { default: child('articles') },
    './TagSubmissions': { default: noop },
  });
}

describe('four UI issue regressions (mocked SSR; no pixel validation)', () => {
  it('020 verifies both real editor wrappers retain the gate used by the mock contract', () => {
    for (const [path, child] of [
      ['../src/app/(site)/admin/tags/TagArticles.tsx', 'Browser'],
      ['../src/app/(site)/admin/writing/WritingPeople.tsx', 'Subjects'],
    ]) {
      const source = readFileSync(new URL(path!, import.meta.url), 'utf8');
      const file = ts.createSourceFile(path!, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      let gatedChild = false;
      const visit = (node: ts.Node) => {
        if (ts.isJsxElement(node) && node.openingElement.tagName.getText(file) === 'AdminGate') {
          gatedChild ||= node.children.some((item) => ts.isJsxSelfClosingElement(item) && item.tagName.getText(file) === child);
        }
        ts.forEachChild(node, visit);
      };
      visit(file);
      expect(gatedChild, `${path} must gate ${child}`).toBe(true);
    }
  });

  it('002 preserves long labels and hrefs inside shrinkable relation chips', () => {
    const label = 'VeryLongUnbrokenRelationLabel'.repeat(12);
    const $ = load(
      renderToStaticMarkup(
        h(panel, { tag: '測試', data: { relations: [{ id: 1, type: 'is-a', inherited: true, target: { label, href: '/tag/long/' } }] } }),
      ),
    );
    const chip = $('a[href="/tag/long/"]');
    expect(chip.text()).toBe(`${label}（上層）`);
    expect(chip.find('span').first().attr('class')).toContain('min-w-0 break-words');
    expect(chip.find('span').last().attr('class')).toContain('shrink-0');
    expect(chip.parent('li').attr('class')).toContain('max-w-full');
    expect(chip.closest('dl > div').attr('class')).toContain('min-w-0');
  });

  it.each<[Session, string]>([
    [null, '載入中…'],
    [{ enabled: false }, '登入功能尚未開放。'],
    [{ enabled: true, user: null }, '這個頁面只開放給管理員，請先以管理員帳號登入。'],
    [{ enabled: true, user: { role: 'reader' } }, '這個頁面只開放給管理員。'],
  ])('020 shows one shared permission message for session %j', async (session, message) => {
    const Page = adminPage(session);
    const $ = load(renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ view: 'relations', tag: ' 台灣 & A ' }) })));
    expect($('p').filter((_, el) => $(el).text() === message)).toHaveLength(1);
    expect($('[data-editor]')).toHaveLength(0);
    if (session?.enabled && !session.user) {
      const next = new URL($('a[href^="/login/"]').attr('href')!, 'https://example.test').searchParams.get('next');
      expect(next).toBe(`/admin/tags/?${new URLSearchParams({ view: 'relations', tag: '台灣 & A' })}`);
    }
  });

  it('020 allows both relationship editors for an admin and passes the normalized tag', async () => {
    const Page = adminPage({ enabled: true, user: { role: 'admin' } });
    const $ = load(renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ view: 'relations', tag: ' 台灣 ' }) })));
    expect($('[data-editor]')).toHaveLength(2);
    expect($('[data-editor="articles"]').attr('data-tag')).toBe('台灣');
  });

  it.each([{ media: [] }, { media: [{ media: 'test', title: '測試媒體', country: '台灣', countryCode: 'TW', schedule: 'hourly' }] }])(
    '027 places the empty message outside the horizontal table scroller (%j)',
    ({ media }) => {
      const $ = load(renderToStaticMarkup(h(table, { media, initialQuery: 'no-matching-outlet', asOf: '2026-10-13' })));
      const empty = $('p').filter((_, el) => $(el).text() === '沒有符合條件的媒體，請調整或清除篩選。');
      expect(empty).toHaveLength(1);
      expect(empty.parents('.table-frame, .table-scroller, table')).toHaveLength(0);
      expect(empty.prev('.table-frame')).toHaveLength(1);
      expect($('tbody tr')).toHaveLength(0);
    },
  );

  it('027 omits the empty message when a crawler matches', () => {
    const media = [{ media: 'test', title: '測試媒體', country: '台灣', countryCode: 'TW', schedule: 'hourly' }];
    const $ = load(renderToStaticMarkup(h(table, { media, initialQuery: '', asOf: '2026-10-13' })));
    expect($('tbody tr')).toHaveLength(1);
    expect($.text()).not.toContain('沒有符合條件的媒體');
  });

  it('028 renders the expanded accessible suggestions below the sticky header class', () => {
    const Suggest = component('../src/components/SuggestInput.tsx', {}, [true, [{ key: 'tw', label: '台灣新聞' }], 0]);
    const $ = load(renderToStaticMarkup(h(Suggest, { value: '台灣', onValueChange: vi.fn(), suggest: vi.fn(), onPick: vi.fn() })));
    expect($('[role="combobox"]').attr('aria-expanded')).toBe('true');
    expect($('[role="listbox"]').attr('id')).toBe($('[role="combobox"]').attr('aria-controls'));
    expect($('[role="option"]').attr('aria-selected')).toBe('true');
    expect($('[role="listbox"]').attr('class')?.split(' ')).toContain('z-20');
    const header = readFileSync(new URL('../src/components/SiteHeader.tsx', import.meta.url), 'utf8');
    expect(header).toMatch(/<header\s+data-site-header\s+className="[^"]*\bz-30\b/);
  });
});
