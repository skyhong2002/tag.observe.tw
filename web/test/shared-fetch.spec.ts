import { expect, it } from 'vitest';
import { createSharedFetch } from '../src/lib/shared-fetch.mts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

it('lets concurrent renders share one load and reuses it until the TTL passes', async () => {
  let clock = 0;
  const shared = createSharedFetch(8, () => clock);
  const pending = deferred<{ n: number }>();
  let loads = 0;
  const load = () => {
    loads += 1;
    return loads === 1 ? pending.promise : Promise.resolve({ n: loads });
  };
  const a = shared('/similarity', 60_000, load);
  const b = shared('/similarity', 60_000, load);
  clock = 120_000; // still loading: never expires mid-flight
  const c = shared('/similarity', 60_000, load);
  pending.resolve({ n: 1 });
  expect(await Promise.all([a, b, c])).toEqual([{ n: 1 }, { n: 1 }, { n: 1 }]);
  expect(loads).toBe(1);
  clock = 120_000 + 59_999;
  expect(await shared('/similarity', 60_000, load)).toEqual({ n: 1 });
  clock = 120_000 + 60_000;
  expect(await shared('/similarity', 60_000, load)).toEqual({ n: 2 });
  expect(loads).toBe(2);
});

it('does not keep failures', async () => {
  const shared = createSharedFetch(8, () => 0);
  let loads = 0;
  const flaky = () => {
    loads += 1;
    return loads === 1 ? Promise.reject(new Error('503')) : Promise.resolve('ok');
  };
  await expect(shared('/coverage', 60_000, flaky)).rejects.toThrow('503');
  expect(await shared('/coverage', 60_000, flaky)).toBe('ok');
  expect(loads).toBe(2);
});

it('keeps at most maxEntries and drops expired ones', async () => {
  let clock = 0;
  const shared = createSharedFetch(2, () => clock);
  const loads: string[] = [];
  const load = (key: string) => () => {
    loads.push(key);
    return Promise.resolve(key);
  };
  for (const key of ['a', 'b', 'c']) await shared(key, 1000, load(key));
  await shared('c', 1000, load('c'));
  await shared('a', 1000, load('a')); // evicted as the oldest
  expect(loads).toEqual(['a', 'b', 'c', 'a']);
  clock = 5000;
  await shared('c', 1000, load('c'));
  expect(loads).toEqual(['a', 'b', 'c', 'a', 'c']);
});
