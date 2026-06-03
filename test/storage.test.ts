import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installChromeMock, type ChromeMock } from './chrome-mock';
import { DEFAULT_SETTINGS } from '../src/types/settings';

// Fresh module per test so the in-memory settings cache and the onChanged
// listener start clean (mirrors a fresh MV3 service-worker wake). The chrome
// mock is already installed by beforeEach before this runs.
async function freshStorage() {
  vi.resetModules();
  // module registers its onChanged listener against the current global chrome
  return await import('../src/utils/storage');
}

describe('storage settings cache (MV3 service worker)', () => {
  let mock: ChromeMock;
  beforeEach(() => {
    mock = installChromeMock();
  });

  it('reads sync once, then serves subsequent get() from memory', async () => {
    mock.sync.store.settings = { ...DEFAULT_SETTINGS, theme: 'light' };
    const { storage } = await freshStorage();

    const a = await storage.get();
    const b = await storage.get();

    expect(a.theme).toBe('light');
    expect(b.theme).toBe('light');
    expect(mock.sync.getCount).toBe(1); // second get() served from cache
  });

  it('set() updates the cache without a re-read', async () => {
    const { storage } = await freshStorage();
    await storage.get(); // prime
    const before = mock.sync.getCount;

    await storage.set({ ...DEFAULT_SETTINGS, theme: 'light' });
    const got = await storage.get();

    expect(got.theme).toBe('light');
    expect(mock.sync.getCount).toBe(before); // no extra read after set
  });

  it('refreshes the cache when settings change in another context (onChanged)', async () => {
    mock.sync.store.settings = { ...DEFAULT_SETTINGS, theme: 'dark' };
    const { storage } = await freshStorage();
    await storage.get();
    const reads = mock.sync.getCount;

    // simulate the popup / another device writing new settings
    mock.chrome.storage.sync.set({ settings: { ...DEFAULT_SETTINGS, theme: 'light' } });
    await mock.flush();

    const got = await storage.get();
    expect(got.theme).toBe('light');
    expect(mock.sync.getCount).toBe(reads); // updated from the change event, not a re-read
  });

  it('still merges defaults for forward-compatibility', async () => {
    mock.sync.store.settings = { theme: 'light' }; // partial / old saved shape
    const { storage } = await freshStorage();
    const got = await storage.get();
    expect(got.timeRange).toBe(DEFAULT_SETTINGS.timeRange);
  });
});

describe('storage.set — statistics stay out of sync + cache integrity', () => {
  let mock: ChromeMock;
  beforeEach(() => {
    mock = installChromeMock();
  });

  it('does not persist the statistics field into sync storage', async () => {
    const { storage } = await freshStorage();
    await storage.set({
      ...DEFAULT_SETTINGS,
      statistics: { totalClears: 99, cookiesCleared: 0, cacheCleared: 0, lastClearTime: 0, sitesCleared: [] },
    });
    const stored = mock.sync.store.settings as Record<string, unknown>;
    expect(stored).toBeDefined();
    expect(stored.statistics).toBeUndefined(); // stripped — sync quota not spent on stats
    expect((stored as { theme?: string }).theme).toBe(DEFAULT_SETTINGS.theme);
  });

  it('invalidates the cache when the sync write fails, so the next get re-reads', async () => {
    mock.sync.store.settings = { ...DEFAULT_SETTINGS, theme: 'dark' };
    const { storage } = await freshStorage();
    await storage.get(); // prime cache (theme=dark)
    const readsAfterPrime = mock.sync.getCount;

    mock.sync.failNextSet = 'QUOTA_BYTES quota exceeded';
    await storage.set({ ...DEFAULT_SETTINGS, theme: 'light' }); // fails to persist

    const got = await storage.get();
    expect(got.theme).toBe('dark'); // not the unpersisted 'light'
    expect(mock.sync.getCount).toBeGreaterThan(readsAfterPrime); // cache was invalidated
  });
});

describe('localStats — statistics live in chrome.storage.local, not sync', () => {
  let mock: ChromeMock;
  beforeEach(() => {
    mock = installChromeMock();
  });

  it('returns default statistics when nothing is stored', async () => {
    const { localStats } = await freshStorage();
    const s = await localStats.get();
    expect(s.totalClears).toBe(0);
    expect(s.sitesCleared).toEqual([]);
  });

  it('round-trips through local storage and never touches sync', async () => {
    const { localStats } = await freshStorage();
    await localStats.set({ totalClears: 3, cookiesCleared: 30, cacheCleared: 15, lastClearTime: 123, sitesCleared: ['a.com'] });
    const s = await localStats.get();
    expect(s.totalClears).toBe(3);
    expect(mock.sync.setCount).toBe(0); // critical: no sync write quota consumed
    expect(mock.local.setCount).toBe(1);
  });
});

describe('applyClear — pure statistics reducer', () => {
  beforeEach(() => {
    installChromeMock(); // storage module needs chrome at import time
  });

  it('increments counts and dedups recent sites newest-first, capped at 10', async () => {
    const { applyClear } = await freshStorage();
    const base = { totalClears: 0, cookiesCleared: 0, cacheCleared: 0, lastClearTime: 0, sitesCleared: ['x.com'] };

    const next = applyClear(base, 'a.com', ['Cookies', 'Cache']);
    expect(next.totalClears).toBe(1);
    expect(next.cookiesCleared).toBe(10);
    expect(next.cacheCleared).toBe(5);
    expect(next.lastClearTime).toBeGreaterThan(0);
    expect(next.sitesCleared[0]).toBe('a.com');

    // re-clearing a.com moves it to front without duplicating
    const again = applyClear(next, 'a.com', []);
    expect(again.sitesCleared.filter(s => s === 'a.com')).toHaveLength(1);
    expect(again.totalClears).toBe(2);
  });

  it('does not mutate the input statistics object', async () => {
    const { applyClear } = await freshStorage();
    const base = { totalClears: 5, cookiesCleared: 0, cacheCleared: 0, lastClearTime: 0, sitesCleared: [] };
    const snapshot = JSON.stringify(base);
    applyClear(base, 'a.com', ['Cookies']);
    expect(JSON.stringify(base)).toBe(snapshot);
  });

  it('caps recent sites at 10', async () => {
    const { applyClear } = await freshStorage();
    let s = { totalClears: 0, cookiesCleared: 0, cacheCleared: 0, lastClearTime: 0, sitesCleared: [] as string[] };
    for (let i = 0; i < 15; i++) s = applyClear(s, `site${i}.com`, []);
    expect(s.sitesCleared).toHaveLength(10);
    expect(s.sitesCleared[0]).toBe('site14.com');
  });
});
