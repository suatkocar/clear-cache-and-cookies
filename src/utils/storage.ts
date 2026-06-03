import type { Settings, Statistics } from '../types/settings';
import { DEFAULT_SETTINGS } from '../types/settings';

// ---------------------------------------------------------------------------
// Settings live in chrome.storage.sync (cross-device). In an MV3 service worker
// every sync.get() is an async round-trip, and many tab/alarm events read
// settings. We keep an in-memory cache for the lifetime of the worker and
// invalidate it via chrome.storage.onChanged so a write from the popup or
// another device is reflected without a redundant read. The cache is null on a
// fresh worker wake and self-heals on first get().
// ---------------------------------------------------------------------------

function mergeDefaults(raw?: Partial<Settings>): Settings {
  return raw ? { ...DEFAULT_SETTINGS, ...raw } : { ...DEFAULT_SETTINGS };
}

let cachedSettings: Settings | null = null;
let inflight: Promise<Settings> | null = null;

// Keep the cache fresh when settings change in any other context.
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.settings) {
    const newValue = changes.settings.newValue as Partial<Settings> | undefined;
    cachedSettings = newValue ? mergeDefaults(newValue) : null;
  }
});

export const storage = {
  async get(): Promise<Settings> {
    if (cachedSettings) return cachedSettings;
    if (inflight) return inflight; // coalesce concurrent first-reads
    inflight = new Promise<Settings>((resolve) => {
      chrome.storage.sync.get(['settings'], (result: { settings?: Partial<Settings> }) => {
        cachedSettings = mergeDefaults(result.settings);
        inflight = null;
        resolve(cachedSettings);
      });
    });
    return inflight;
  },

  async set(settings: Settings): Promise<void> {
    // Statistics live in chrome.storage.local — never spend the sync write quota
    // (or item-size budget) on them. Persist a stats-free copy; keep the full
    // object in the in-memory cache for readers.
    const syncSafe: Partial<Settings> = { ...settings };
    delete syncSafe.statistics;
    return new Promise((resolve) => {
      chrome.storage.sync.set({ settings: syncSafe }, () => {
        if (chrome.runtime.lastError) {
          // Write failed/throttled — drop the optimistic cache so the next read
          // reflects what is actually persisted rather than a phantom value.
          cachedSettings = null;
        } else {
          cachedSettings = settings;
        }
        resolve();
      });
    });
  },

  async update(partial: Partial<Settings>): Promise<Settings> {
    const current = await this.get();
    const updated = { ...current, ...partial };
    await this.set(updated);
    return updated;
  },
};

// ---------------------------------------------------------------------------
// Statistics are high-churn, local-only telemetry (updated on every clear).
// Storing them in chrome.storage.sync would burn the sync write quota
// (MAX_WRITE_OPERATIONS_PER_MINUTE/HOUR) and risk throttling-induced latency
// spikes, so they live in chrome.storage.local (no per-minute quota).
// ---------------------------------------------------------------------------

export const DEFAULT_STATISTICS: Statistics = {
  totalClears: 0,
  cookiesCleared: 0,
  cacheCleared: 0,
  lastClearTime: 0,
  sitesCleared: [],
};

export const localStats = {
  async get(): Promise<Statistics> {
    return new Promise((resolve) => {
      chrome.storage.local.get(['statistics'], (result: { statistics?: Partial<Statistics> }) => {
        resolve({ ...DEFAULT_STATISTICS, ...(result.statistics ?? {}) });
      });
    });
  },

  async set(stats: Statistics): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ statistics: stats }, () => resolve());
    });
  },
};

// Pure reducer: given current stats, a cleared domain and the cleared types,
// return the next stats. Does not mutate its input.
export function applyClear(stats: Statistics, domain: string, clearedTypes: string[]): Statistics {
  const next: Statistics = { ...stats, sitesCleared: [...stats.sitesCleared] };
  next.totalClears++;
  next.lastClearTime = Date.now();
  if (clearedTypes.includes('Cookies')) next.cookiesCleared += 10;
  if (clearedTypes.includes('Cache') || clearedTypes.includes('Cache Storage')) next.cacheCleared += 5;
  if (domain) {
    next.sitesCleared = [domain, ...next.sitesCleared.filter((s) => s !== domain)].slice(0, 10);
  }
  return next;
}

// Extract domain from URL
export function getDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return '';
  }
}

// Extract origin from URL
export function getOrigin(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.origin;
  } catch {
    return '';
  }
}

// Get clean URL (domain only, strip path and query params)
// e.g., https://example.com/path?query=1 -> https://example.com/
export function getCleanUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}/`;
  } catch {
    return url;
  }
}
