import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installChromeMock } from './chrome-mock';
import { DEFAULT_SETTINGS } from '../src/types/settings';

let removeCalls: Array<{ opts: unknown; types: unknown }>;
let resolvers: Array<() => void>;

function mockBrowsingData() {
  removeCalls = [];
  resolvers = [];
  (globalThis as unknown as { chrome: { browsingData: unknown } }).chrome.browsingData = {
    remove: vi.fn((opts: unknown, types: unknown) => {
      removeCalls.push({ opts, types });
      return new Promise<void>((res) => resolvers.push(res));
    }),
  };
}

async function fresh() {
  vi.resetModules();
  return await import('../src/utils/clearData');
}

describe('clearBrowsingData — origin + global removals run concurrently', () => {
  beforeEach(() => {
    installChromeMock();
    mockBrowsingData();
  });

  it('issues origin and global removals sequentially (origin first, then global)', async () => {
    // Chrome serializes browsingData removals internally and can reject
    // overlapping calls, so we intentionally run them one at a time.
    const { clearBrowsingData } = await fresh();
    const settings = {
      ...DEFAULT_SETTINGS,
      dataTypes: { ...DEFAULT_SETTINGS.dataTypes, cookies: true, history: true },
    };
    const p = clearBrowsingData('https://example.com', settings);
    await Promise.resolve();
    await Promise.resolve();

    // only the origin-scoped removal has been issued so far
    expect(removeCalls.length).toBe(1);

    resolvers[0](); // resolve origin removal
    await Promise.resolve();
    await Promise.resolve();

    // now the global removal is issued
    expect(removeCalls.length).toBe(2);
    resolvers[1]();

    const result = await p;
    expect(result.success).toBe(true);
    expect(result.clearedTypes).toContain('Cookies');
    expect(result.clearedTypes).toContain('Browsing History');
  });

  it('issues a single removal for the default origin-only config', async () => {
    const { clearBrowsingData } = await fresh();
    const p = clearBrowsingData('https://example.com', DEFAULT_SETTINGS);
    await Promise.resolve();
    await Promise.resolve();
    expect(removeCalls.length).toBe(1);
    resolvers.forEach((r) => r());
    const result = await p;
    expect(result.success).toBe(true);
  });

  it('rejects restricted urls without issuing any removal', async () => {
    const { clearBrowsingData } = await fresh();
    const result = await clearBrowsingData('chrome://settings', DEFAULT_SETTINGS);
    expect(result.success).toBe(false);
    expect(removeCalls.length).toBe(0);
  });

  it('honours the whitelist (no removal for whitelisted site)', async () => {
    const { clearBrowsingData } = await fresh();
    const settings = { ...DEFAULT_SETTINGS, whitelist: ['example.com'] };
    const result = await clearBrowsingData('https://app.example.com', settings);
    expect(result.success).toBe(false);
    expect(removeCalls.length).toBe(0);
  });
});
