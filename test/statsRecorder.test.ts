import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installChromeMock, type ChromeMock } from './chrome-mock';

async function fresh() {
  vi.resetModules();
  const storage = await import('../src/utils/storage');
  const recorder = await import('../src/utils/statsRecorder');
  return { ...recorder, ...storage };
}

describe('statsRecorder — debounced, coalesced statistics writes', () => {
  let mock: ChromeMock;
  beforeEach(() => {
    mock = installChromeMock();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces a burst of clears into a single local write', async () => {
    const { recordClear, localStats } = await fresh();

    recordClear('a.com', ['Cookies']);
    recordClear('b.com', ['Cache']);
    recordClear('a.com', ['Cookies']);

    expect(mock.local.setCount).toBe(0); // nothing written yet (debounced)

    await vi.advanceTimersByTimeAsync(2500);

    expect(mock.local.setCount).toBe(1); // one coalesced write, not three
    const stats = await localStats.get();
    expect(stats.totalClears).toBe(3);
    expect(stats.cookiesCleared).toBe(20);
    expect(stats.cacheCleared).toBe(5);
    expect(stats.sitesCleared[0]).toBe('a.com'); // most recent first
  });

  it('flushStats() writes immediately without waiting for the timer', async () => {
    const { recordClear, flushStats, localStats } = await fresh();
    recordClear('a.com', ['Cookies']);
    await flushStats();
    expect(mock.local.setCount).toBe(1);
    expect((await localStats.get()).totalClears).toBe(1);
  });

  it('is a no-op flush when nothing is pending', async () => {
    const { flushStats } = await fresh();
    await flushStats();
    expect(mock.local.setCount).toBe(0);
  });

  it('flushes eagerly once several clears pile up, without waiting for the timer', async () => {
    const { recordClear, localStats } = await fresh();
    for (let i = 0; i < 5; i++) recordClear(`s${i}.com`, ['Cookies']);

    // advance only 10ms (far below the debounce window) — eager flush should
    // already have written because the pending batch hit the threshold.
    await vi.advanceTimersByTimeAsync(10);

    expect(mock.local.setCount).toBe(1);
    expect((await localStats.get()).totalClears).toBe(5);
  });

  it('starts a fresh window after a flush', async () => {
    const { recordClear, flushStats, localStats } = await fresh();
    recordClear('a.com', []);
    await flushStats();
    recordClear('b.com', []);
    await vi.advanceTimersByTimeAsync(2500);
    expect(mock.local.setCount).toBe(2);
    expect((await localStats.get()).totalClears).toBe(2);
  });
});
