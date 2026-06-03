import type { Settings, ClearResult, TimeRange, DataTypeSettings } from '../types/settings';
import { getDomain, getOrigin } from './storage';

// Static metadata: [settings key, browsingData API key, display name].
// Hoisted to module scope so they aren't re-allocated on every clear.
type ClearTypeTuple = [keyof DataTypeSettings, keyof chrome.browsingData.DataTypeSet, string];

// Data types that support origin filtering (scoped to the current site).
const ORIGIN_SUPPORTED_TYPES: ClearTypeTuple[] = [
  ['cache', 'cache', 'Cache'],
  ['cacheStorage', 'cacheStorage', 'Cache Storage'],
  ['cookies', 'cookies', 'Cookies'],
  ['localStorage', 'localStorage', 'Local Storage'],
  ['fileSystems', 'fileSystems', 'File Systems'],
  ['indexedDB', 'indexedDB', 'Indexed DB'],
  ['serviceWorkers', 'serviceWorkers', 'Service Workers'],
  ['webSQL', 'webSQL', 'WebSQL'],
];

// Data types that DON'T support origin filtering (clear ALL browser data).
const GLOBAL_ONLY_TYPES: ClearTypeTuple[] = [
  ['history', 'history', 'Browsing History'],
  ['downloads', 'downloads', 'Download History'],
  ['formData', 'formData', 'Form Data'],
  ['passwords', 'passwords', 'Saved Passwords'],
  ['pluginData', 'pluginData', 'Plugin Data'],
];

// Convert time range to milliseconds
export function getTimeRangeMs(timeRange: TimeRange): number {
  const now = Date.now();
  switch (timeRange) {
    case 'last15min': return now - (15 * 60 * 1000);
    case 'lastHour': return now - (60 * 60 * 1000);
    case 'last24Hours': return now - (24 * 60 * 60 * 1000);
    case 'lastWeek': return now - (7 * 24 * 60 * 60 * 1000);
    case 'allTime': return 0;
    default: return 0;
  }
}

// Exact-or-subdomain match. A listed entry "example.com" matches "example.com"
// and "*.example.com", but NOT "notexample.com", "ample.com", or
// "example.com.evil.com". Avoids the loose bidirectional-substring matching that
// previously let unrelated hosts slip into the whitelist/blacklist.
export function domainMatches(domain: string, entry: string): boolean {
  if (!domain || !entry) return false;
  return domain === entry || domain.endsWith('.' + entry);
}

// Pick the tab id for a clear without a chrome.tabs.query round-trip: the popup
// passes it in the payload (preferred), otherwise a content-script message
// carries it via sender.tab. -1 is chrome.tabs.TAB_ID_NONE → treat as no tab.
export function resolveClearTabId(payloadTabId?: number, senderTabId?: number): number | undefined {
  const id = payloadTabId ?? senderTabId;
  return id != null && id >= 0 ? id : undefined;
}

// Exact-or-subdomain membership against a precomputed Set, in O(number of
// dot-labels) regardless of the list size. Same semantics as domainMatches.
// Used on the hot tab-completion path where the blacklist Set is cached.
export function isDomainBlocked(domain: string, set: Set<string>): boolean {
  if (!domain || set.size === 0) return false;
  if (set.has(domain)) return true;
  let idx = domain.indexOf('.');
  while (idx !== -1) {
    if (set.has(domain.slice(idx + 1))) return true;
    idx = domain.indexOf('.', idx + 1);
  }
  return false;
}

// Check if domain is in whitelist
export function isWhitelisted(url: string, whitelist: string[]): boolean {
  if (!whitelist || whitelist.length === 0) return false;
  const domain = getDomain(url);
  if (!domain) return false;
  return whitelist.some(w => domainMatches(domain, w));
}

// Check if domain is in blacklist (always clear)
export function isBlacklisted(url: string, blacklist: string[]): boolean {
  if (!blacklist || blacklist.length === 0) return false;
  const domain = getDomain(url);
  if (!domain) return false;
  return blacklist.some(b => domainMatches(domain, b));
}

// URLs that cannot be scripted by extensions
const RESTRICTED_URL_PATTERNS = [
  /^chrome:\/\//i,
  /^chrome-extension:\/\//i,
  /^edge:\/\//i,
  /^about:/i,
  /^view-source:/i,
  /^devtools:\/\//i,
  /^chrome\.google\.com\/webstore/i,
  /^chromewebstore\.google\.com/i,
  /^microsoftedge\.microsoft\.com\/addons/i,
  /^addons\.mozilla\.org/i,
];

// Check if URL is scriptable (can execute scripts on it)
export function isScriptableUrl(url: string | undefined): boolean {
  if (!url) return false;
  return !RESTRICTED_URL_PATTERNS.some(pattern => pattern.test(url));
}

// Check if tab can be scripted (exists + URL is scriptable + not error page)
// Single API call for maximum performance
export async function canScriptTab(tabId: number, url?: string): Promise<boolean> {
  try {
    const tab = await chrome.tabs.get(tabId);
    
    // Tab must exist and not be unloaded
    if (!tab || !tab.id || tab.status === 'unloaded') return false;
    
    // Check if URL is scriptable
    const tabUrl = url || tab.url;
    if (!isScriptableUrl(tabUrl)) return false;
    
    return true;
  } catch {
    return false;
  }
}

// Clear browsing data for a specific site
export async function clearBrowsingData(
  url: string,
  settings: Settings
): Promise<ClearResult> {
  const domain = getDomain(url);
  const origin = getOrigin(url);
  const clearedTypes: string[] = [];

  if (!domain || !origin) {
    return {
      success: false,
      clearedTypes: [],
      error: 'Invalid URL',
    };
  }

  // Check if this is a restricted URL (can't clear data for chrome:// etc.)
  if (!isScriptableUrl(url)) {
    return {
      success: false,
      clearedTypes: [],
      error: 'Cannot clear data for this page type',
    };
  }

  // Check whitelist (unless blacklisted - blacklist takes priority)
  const blacklisted = isBlacklisted(url, settings.blacklist);
  if (!blacklisted && isWhitelisted(url, settings.whitelist)) {
    return {
      success: false,
      clearedTypes: [],
      error: 'This site is whitelisted',
    };
  }

  try {
    const { dataTypes, timeRange } = settings;

    // Add time range if not "all time"
    const sinceTime = getTimeRangeMs(timeRange);

    // Build origin-filtered data to remove
    const originDataToRemove: chrome.browsingData.DataTypeSet = {};
    let hasOriginData = false;
    for (const [settingKey, apiKey, displayName] of ORIGIN_SUPPORTED_TYPES) {
      if (dataTypes[settingKey]) {
        originDataToRemove[apiKey] = true;
        hasOriginData = true;
        clearedTypes.push(displayName);
      }
    }

    // Build global data to remove (no origin filter)
    const globalDataToRemove: chrome.browsingData.DataTypeSet = {};
    let hasGlobalData = false;
    for (const [settingKey, apiKey, displayName] of GLOBAL_ONLY_TYPES) {
      if (dataTypes[settingKey]) {
        globalDataToRemove[apiKey] = true;
        hasGlobalData = true;
        clearedTypes.push(displayName);
      }
    }

    // NOTE: do NOT parallelize these two removals. Chromium's BrowsingDataRemover
    // queues removal requests and runs them one at a time (and the API docs state
    // a single batched remove() is the fastest path), so concurrency gives no
    // speedup — the browser serializes it internally — while overlapping remove()
    // calls risk an "already in progress" rejection. Issue them sequentially:
    // origin-scoped first, then the global (all-sites) removal.
    if (hasOriginData) {
      const originOptions: chrome.browsingData.RemovalOptions = { origins: [origin] };
      if (sinceTime > 0) originOptions.since = sinceTime;
      await chrome.browsingData.remove(originOptions, originDataToRemove);
    }
    if (hasGlobalData) {
      const globalOptions: chrome.browsingData.RemovalOptions = {};
      if (sinceTime > 0) globalOptions.since = sinceTime;
      await chrome.browsingData.remove(globalOptions, globalDataToRemove);
    }

    return {
      success: true,
      clearedTypes,
    };
  } catch (error) {
    console.error('Error clearing data:', error);
    return {
      success: false,
      clearedTypes,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Clear session storage via content script execution
// Optimized: Check URL synchronously first, then try executeScript directly
export async function clearSessionStorage(tabId: number, url?: string): Promise<boolean> {
  // Fast synchronous check - no API call needed
  if (url && !isScriptableUrl(url)) {
    return false;
  }

  // Try directly - faster than pre-checking tab existence
  // If tab doesn't exist or has navigated, executeScript will throw and we catch it
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        sessionStorage.clear();
      },
    });
    return true;
  } catch {
    // Silently fail - tab might have navigated, closed, be on error page, or restricted URL
    return false;
  }
}
