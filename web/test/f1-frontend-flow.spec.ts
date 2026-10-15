import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

const requireWeb = createRequire(new URL('../package.json', import.meta.url));
const React = requireWeb('react');
const jsx = requireWeb('react/jsx-runtime');
type TestElement = { type: string | ((props: Record<string, unknown>) => TestElement); props: Record<string, unknown> };
const render = (node: TestElement) => (node.type as (props: Record<string, unknown>) => TestElement)(node.props);
const action = (node: TestElement, name: string) => node.props[name] as (...args: unknown[]) => Promise<void>;
const children = (node: TestElement): TestElement[] => React.Children.toArray(node.props.children);
const uploadNode = (tree: TestElement) => children(tree).find((child) => typeof child.type === 'function' && child.type.name === 'Upload')!;
// The VM seeds hooks once; it does not rerender or model React dependency scheduling.
// These tests exercise request guards, explicit cleanup callbacks, and SSR markup only.
const { renderToStaticMarkup } = requireWeb('react-dom/server');
function load(path: string, states: unknown[], imports: Record<string, unknown>, fetch: (...args: unknown[]) => unknown = vi.fn()) {
  let index = 0;
  const setters: ReturnType<typeof vi.fn>[] = [];
  const effects: (() => undefined | (() => void))[] = [];
  const hooks = {
    ...React,
    useState: (initial: unknown) => {
      const setter = vi.fn();
      setters.push(setter);
      return [index < states.length ? states[index++] : initial, setter];
    },
    useCallback: (fn: unknown) => fn,
    useRef: (initial: unknown) => ({ current: initial }),
    useEffect: (effect: () => undefined | (() => void)) => effects.push(effect),
  };
  const allowed = { react: hooks, 'react/jsx-runtime': jsx, ...imports };
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: { default?: (props: Record<string, unknown>) => TestElement } = {};
  runInNewContext(code, {
    exports,
    require: (name: string) => {
      if (!(name in allowed)) throw Error(`Unmocked ${name}`);
      return allowed[name as keyof typeof allowed];
    },
    fetch,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    AbortController,
    Date,
    Uint8Array,
    btoa,
  });
  return { component: exports.default!, setters, effects, fetch };
}
function nodes(value: unknown, type: string): TestElement[] {
  const tree = value as TestElement;
  if (!tree || typeof tree !== 'object') return [];
  const children = React.Children.toArray(tree.props?.children);
  return [...(tree.type === type ? [tree] : []), ...children.flatMap((child: unknown) => nodes(child, type))];
}
const session = (user: unknown) => ({
  '@/lib/session': {
    useSession: () => ({ enabled: true, user }),
    loginHref: (next: string) => `/auth/google?next=${encodeURIComponent(next)}`,
  },
});

describe('F1 isolated frontend state and markup contracts (not browser UI approval)', () => {
  it('preserves encoded tag and relations anchor through login gate', () => {
    const harness = load('../src/components/reader/TagRelationSubmission.tsx', [], session(null));
    const tree = harness.component({ tag: '台灣 & A' });
    expect(nodes(tree, 'a')[0].props.href).toBe(
      `/auth/google?next=${encodeURIComponent(`/tag/${encodeURIComponent('台灣 & A')}/relations/`)}`,
    );
    expect(nodes(tree, 'form')).toHaveLength(0);
  });
  it.each(['related', 'is-a', 'alias'])('posts normalized %s once while pending', async (type) => {
    let resolve!: (value: unknown) => void;
    const fetch = vi.fn(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const harness = load(
      '../src/components/reader/TagRelationSubmission.tsx',
      [type, ' 分類 ', ' 查證 ', false, '', ''],
      session({ role: 'reader' }),
      fetch,
    );
    const submit = action(nodes(harness.component({ tag: '台灣' }), 'form')[0], 'onSubmit');
    const first = submit({ preventDefault() {} });
    await submit({ preventDefault() {} });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse((fetch.mock.calls as unknown as [string, { body: string }][])[0][1].body)).toEqual({
      type,
      target: '分類',
      reason: '查證',
    });
    resolve({ ok: true, json: async () => ({ status: 'pending', duplicate: false }) });
    await first;
    expect(harness.setters[4]).toHaveBeenCalledWith('已加入投票。其他讀者同意後就會成立。');
  });
  it('rejects self relation before network and leaves form values intact', async () => {
    const harness = load(
      '../src/components/reader/TagRelationSubmission.tsx',
      ['alias', ' 台灣 ', '理由', false, '', ''],
      session({ role: 'reader' }),
    );
    await action(nodes(harness.component({ tag: '台灣' }), 'form')[0], 'onSubmit')({ preventDefault() {} });
    expect(harness.fetch).not.toHaveBeenCalled();
    expect(harness.setters[5]).toHaveBeenCalledWith('請填寫不同的有效標籤（最多 60 字）。');
    expect(harness.setters[1]).not.toHaveBeenCalled();
  });
  it('does not write a late submission result after unmount', async () => {
    let resolve!: (value: unknown) => void;
    const fetch = vi.fn(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const harness = load(
      '../src/components/reader/TagRelationSubmission.tsx',
      ['related', '別詞', '理由', false, '', ''],
      session({ role: 'reader' }),
      fetch,
    );
    const tree = harness.component({ tag: '台灣' });
    const cleanup = harness.effects[0]() as () => void;
    const work = action(nodes(tree, 'form')[0], 'onSubmit')({ preventDefault() {} });
    cleanup();
    resolve({ ok: true, json: async () => ({ status: 'approved' }) });
    await work;
    expect(harness.setters[4]).toHaveBeenCalledTimes(1); // initial message clear only
    expect(harness.setters[1]).not.toHaveBeenCalled();
  });
  it('public relation markup excludes submission reasons and pending details', () => {
    const harness = load('../src/components/TagGroupChips.tsx', [], {
      'next/link': { default: ({ prefetch: _, ...props }: Record<string, unknown>) => React.createElement('a', props) },
    });
    const html = renderToStaticMarkup(
      React.createElement(harness.component, {
        groups: [{ id: 1, label: '政治人物', kind: 'group', parentId: null, source: 'legacy' }],
        relations: [
          { id: 'g', type: 'is-a', target: { id: 'group:1', label: '政治人物', href: '/group/1/' } },
          { id: '1', type: 'alias', target: { id: 'tag:x', label: '別名', href: '/tag/alias/' }, reason: 'PRIVATE' },
        ],
      }),
    );
    expect(html).toContain('別名');
    expect(html).not.toContain('PRIVATE');
    // A relation to a group the chips already show is not listed twice.
    expect(html.match(/政治人物/g)).toHaveLength(1);
  });
  it('「改關係」 links to the vote page for signed-in readers only', () => {
    const signedIn = load('../src/components/RelationLink.tsx', [], session({ role: 'reader' }));
    const html = renderToStaticMarkup(React.createElement(signedIn.component, { tag: '台灣', voting: 5 }));
    expect(html).toContain('/tag/%E5%8F%B0%E7%81%A3/relations/');
    expect(html).toContain('5 筆投票中');
    const anonymous = load('../src/components/RelationLink.tsx', [], session(null));
    expect(anonymous.component({ tag: '台灣', voting: 5 })).toBeNull();
  });
  it('requires review reason and rights confirmation for approval, keeps rejection available', async () => {
    const request = vi.fn(async () => ({}));
    const item = {
      id: 1,
      kind: 'picture',
      tag: '台灣',
      status: 'pending',
      createdAt: '2026-10-13T00:00:00Z',
      rightsConfirmed: false,
      imageUrl: '/auth/admin/tag-submissions/1/image',
    };
    const harness = load(
      '../src/app/(site)/admin/tags/TagSubmissions.tsx',
      ['pending', null, 0, { items: [item], next: null }, '', '查證理由', false, ''],
      {
        'next/link': { default: () => null },
        '../AdminGate': { default: () => null, adminFetch: request },
      },
    );
    const queue = children(harness.component({ kind: 'picture', next: '/admin/tags/?view=pictures' }))[0];
    const queueTree = render(queue);
    const row = children(nodes(queueTree, 'ul')[0])[0];
    const rowTree = render(row);
    const buttons = nodes(rowTree, 'button');
    expect(buttons[0].props.disabled).toBe(true);
    expect(buttons[1].props.disabled).toBe(false);
    expect(nodes(rowTree, 'img')[0].props.src).toBe('/auth/admin/tag-submissions/1/image');
    await action(buttons[0], 'onClick')();
    expect(request).not.toHaveBeenCalled();
    await action(buttons[1], 'onClick')();
    expect(request).toHaveBeenCalledWith('/auth/admin/tag-submissions/1', {
      method: 'PUT',
      body: { status: 'rejected', reason: '查證理由' },
    });
  });

  it('ignores an older picture GET error after a newer retry succeeds', async () => {
    const requests: { resolve: (value: unknown) => void; reject: (error: Error) => void }[] = [];
    const fetch = vi.fn(
      () =>
        new Promise((resolve, reject) => {
          requests.push({ resolve, reject });
        }),
    );
    const harness = load(
      '../src/app/(site)/tag/[tag]/picture/PictureVote.tsx',
      [null, '先前失敗', false],
      session({ role: 'reader' }),
      fetch,
    );
    const board = harness.component({ tag: '台灣' });
    const tree = render(board);
    harness.effects[0]();
    action(nodes(tree, 'button')[0], 'onClick')();
    const state = { candidates: [], uploadsLeft: 1, kind: 'visual' };
    requests[1].resolve({ ok: true, json: async () => state });
    await new Promise((done) => setTimeout(done, 0));
    requests[0].reject(Error('晚到的失敗'));
    await new Promise((done) => setTimeout(done, 0));
    expect(harness.setters[0]).toHaveBeenCalledWith(state);
    expect(harness.setters[1]).not.toHaveBeenCalledWith('晚到的失敗');
  });
  it('allows only one picture mutation while pending', async () => {
    let resolve!: (value: unknown) => void;
    const fetch = vi.fn(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const state = { candidates: [], uploadsLeft: 1, kind: 'avatar', admin: true, locked: false };
    const harness = load('../src/app/(site)/tag/[tag]/picture/PictureVote.tsx', [state, '', false], session({ role: 'admin' }), fetch);
    const board = harness.component({ tag: '台灣' });
    const tree = render(board);
    const mutate = action(nodes(tree, 'button')[0], 'onClick');
    const first = mutate();
    await mutate();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((fetch.mock.calls as unknown as [string, unknown][])[0][0]).toBe('/auth/pictures/%E5%8F%B0%E7%81%A3/kind');
    resolve({ ok: true, json: async () => ({}) });
    await first;
    expect(fetch).toHaveBeenCalledTimes(2); // refresh after successful mutation
  });

  it('deduplicates admin review and ignores late completion after row unmount', async () => {
    let resolve!: (value: unknown) => void;
    const request = vi.fn(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const item = { id: 2, kind: 'relation', tag: '台灣', status: 'pending', createdAt: '2026-10-13T00:00:00Z' };
    const harness = load(
      '../src/app/(site)/admin/tags/TagSubmissions.tsx',
      ['pending', null, 0, { items: [item], next: null }, '', '查證', false, ''],
      {
        'next/link': { default: () => null },
        '../AdminGate': { default: () => null, adminFetch: request },
      },
    );
    const queue = children(harness.component({ kind: 'picture', next: '/admin/tags/?view=pictures' }))[0];
    const row = children(nodes(render(queue), 'ul')[0])[0];
    const tree = render(row);
    const cleanup = harness.effects[1]() as () => void;
    const review = action(nodes(tree, 'button')[0], 'onClick');
    const first = review();
    await review();
    expect(request).toHaveBeenCalledTimes(1);
    cleanup();
    resolve({});
    await first;
    expect(harness.setters[2]).not.toHaveBeenCalled();
  });
  it('refuses upload without rights agreement and aborts pending fetch on unmount', async () => {
    const createUpload = (agree: boolean, fetch: (...args: unknown[]) => unknown) => {
      const harness = load(
        '../src/app/(site)/tag/[tag]/picture/PictureVote.tsx',
        [{ candidates: [], kind: 'visual', uploadsLeft: 1 }, '', false, agree, '', ''],
        session({ role: 'reader' }),
        fetch,
      );
      const board = harness.component({ tag: '台灣' });
      const tree = render(board);
      const upload = uploadNode(tree);
      return { harness, tree: render(upload) };
    };
    const unused = vi.fn();
    const gated = createUpload(false, unused);
    const gatedInput = nodes(gated.tree, 'input').find((node) => node.props.type === 'file');
    expect(gatedInput!.props.disabled).toBe(true);
    action(gatedInput!, 'onChange')({ target: { files: [{ arrayBuffer: async () => new ArrayBuffer(1) }], value: 'file' } });
    await Promise.resolve();
    expect(unused).not.toHaveBeenCalled();
    let signal!: AbortSignal;
    const fetch = vi.fn(
      (_path: unknown, init: unknown) =>
        new Promise((_resolve, reject) => {
          signal = (init as { signal: AbortSignal }).signal;
          signal.addEventListener('abort', () => reject(Error('aborted')), { once: true });
        }),
    );
    const active = createUpload(true, fetch);
    const cleanup = active.harness.effects[1]() as () => void;
    const input = nodes(active.tree, 'input').find((node) => node.props.type === 'file');
    action(input!, 'onChange')({ target: { files: [{ arrayBuffer: async () => new ArrayBuffer(1) }], value: 'file' } });
    await new Promise((done) => setTimeout(done, 0));
    cleanup();
    await new Promise((done) => setTimeout(done, 0));
    expect(signal.aborted).toBe(true);
    expect(active.harness.setters[5]).toHaveBeenCalledTimes(1); // initial message clear only
  });
  it.each(['upload', 'poll', 'body'])('aborts an unresponsive %s at the five-minute real deadline and clears pending', async (phase) => {
    vi.useFakeTimers();
    try {
      let signal!: AbortSignal;
      const fetch = vi.fn((path: unknown, init: unknown) => {
        if (phase === 'poll' && String(path).endsWith('/upload'))
          return Promise.resolve({ ok: true, json: async () => ({ jobId: 'job-test' }) });
        signal = (init as { signal: AbortSignal }).signal;
        if (phase === 'body')
          return Promise.resolve({
            ok: true,
            json: () =>
              new Promise((_resolve, reject) => {
                signal.addEventListener('abort', () => reject(Object.assign(Error('aborted body'), { name: 'AbortError' })), {
                  once: true,
                });
              }),
          });
        return new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(Error('aborted')), { once: true });
        });
      });
      const harness = load(
        '../src/app/(site)/tag/[tag]/picture/PictureVote.tsx',
        [{ candidates: [], kind: 'visual', uploadsLeft: 1 }, '', false, true, '', ''],
        session({ role: 'reader' }),
        fetch,
      );
      const board = harness.component({ tag: '台灣' });
      const tree = render(board);
      const upload = uploadNode(tree);
      const onDone = vi.fn();
      const input = nodes(render({ ...upload, props: { ...upload.props, onDone } }), 'input').find((node) => node.props.type === 'file');
      action(input!, 'onChange')({ target: { files: [{ arrayBuffer: async () => new ArrayBuffer(1) }], value: 'file' } });
      await vi.advanceTimersByTimeAsync(299_999);
      expect(signal.aborted).toBe(false);
      expect(fetch).toHaveBeenCalledTimes(phase === 'poll' ? 2 : 1);
      await vi.advanceTimersByTimeAsync(1);
      expect(signal.aborted).toBe(true);
      expect(harness.setters[5]).toHaveBeenCalledWith('圖片處理等待已逾時，請稍後回來查看，勿重複上傳。');
      expect(harness.setters[4]).toHaveBeenLastCalledWith('');
      expect(vi.getTimerCount()).toBe(0);
      expect(onDone).not.toHaveBeenCalled();
      expect(harness.setters[5]).not.toHaveBeenCalledWith(
        '已加入候選。顯示哪一張由其他讀者投票決定（你不能投自己上傳的圖）；不適合的圖管理員會撤下。',
      );
    } finally {
      vi.useRealTimers();
    }
  });
  it('rejects an oversized encoded JSON upload before reading the file', () => {
    const harness = load(
      '../src/app/(site)/tag/[tag]/picture/PictureVote.tsx',
      [{ candidates: [], kind: 'visual', uploadsLeft: 1 }, '', false, true, '', ''],
      session({ role: 'reader' }),
    );
    const board = harness.component({ tag: '台灣' });
    const input = nodes(render(uploadNode(render(board))), 'input').find((node) => node.props.type === 'file');
    const read = vi.fn();
    action(input!, 'onChange')({ target: { files: [{ size: 12 * 1024 * 1024, arrayBuffer: read }], value: 'file' } });
    expect(read).not.toHaveBeenCalled();
    expect(harness.fetch).not.toHaveBeenCalled();
    expect(harness.setters[5]).toHaveBeenCalledWith('圖片檔案過大，請縮小後再上傳（編碼後請求上限 15 MiB）。');
  });
});
