import { describe, expect, it, vi } from 'vitest';
import { createFeedPoller } from '../../web/src/lib/liveboard-poll.mts';

describe('liveboard connection recovery', () => {
  it('retries a transient failure without flashing the offline logo', async () => {
    const connection = vi.fn();
    const wait = vi.fn(async () => {});
    const poller = createFeedPoller({ connection, wait });
    const load = vi.fn().mockRejectedValueOnce(new Error('reset')).mockResolvedValueOnce({ cursor: 42 });
    expect(await poller.poll(load)).toEqual({ cursor: 42 });
    expect(load).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledTimes(1);
    expect(connection).not.toHaveBeenCalled();
  });

  it('confirms a sustained outage, retains the last state, and restores the logo on recovery', async () => {
    const connection = vi.fn();
    const poller = createFeedPoller({ connection, wait: async () => {} });
    const failure = vi.fn(async () => null);
    await poller.poll(failure);
    await poller.poll(failure);
    expect(connection).not.toHaveBeenCalled();
    await poller.poll(failure);
    expect(connection.mock.calls).toEqual([[false]]);
    await poller.poll(failure);
    expect(connection).toHaveBeenCalledTimes(1);
    expect(await poller.poll(async () => ({ cursor: 43 }))).toEqual({ cursor: 43 });
    expect(connection.mock.calls).toEqual([[false], [true]]);
    await poller.poll(failure);
    expect(connection).toHaveBeenCalledTimes(2);
  });

  it('serializes delayed polls so a stale response cannot replay the same cursor', async () => {
    let resolve!: (value: { cursor: number }) => void;
    const first = new Promise<{ cursor: number }>((done) => {
      resolve = done;
    });
    const load = vi.fn(() => first);
    const poller = createFeedPoller<{ cursor: number }>({ connection: vi.fn() });
    const pending = poller.poll(load);
    expect(await poller.poll(load)).toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
    resolve({ cursor: 44 });
    expect(await pending).toEqual({ cursor: 44 });
  });

  it('ignores a late failure after unmount and stops pending retries', async () => {
    let release!: () => void;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    const connection = vi.fn();
    const load = vi.fn(async () => null);
    const poller = createFeedPoller({ connection, wait: () => wait });
    const pending = poller.poll(load);
    await Promise.resolve();
    poller.stop();
    release();
    expect(await pending).toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
    expect(connection).not.toHaveBeenCalled();
    expect(await poller.poll(load)).toBeNull();
  });
});
