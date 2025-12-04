import type { Settings, ClearResult, TimeRange } from '../types/settings';
import { getDomain, getOrigin } from './storage';

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

// Check if domain is in whitelist
export function isWhitelisted(url: string, whitelist: string[]): boolean {
  if (!whitelist || whitelist.length === 0) return false;
  const domain = getDomain(url);
  if (!domain) return false;
  return whitelist.some(w => domain.includes(w) || w.includes(domain));
}

// Check if domain is in blacklist (always clear)
export function isBlacklisted(url: string, blacklist: string[]): boolean {
  if (!blacklist || blacklist.length === 0) return false;
  const domain = getDomain(url);
  if (!domain) return false;
  return blacklist.some(b => domain.includes(b) || b.includes(domain));
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

    // Data types that support origin filtering
    const originSupportedTypes: Array<[keyof typeof dataTypes, keyof chrome.browsingData.DataTypeSet, string]> = [
      ['cache', 'cache', 'Cache'],
      ['cacheStorage', 'cacheStorage', 'Cache Storage'],
      ['cookies', 'cookies', 'Cookies'],
      ['localStorage', 'localStorage', 'Local Storage'],
      ['fileSystems', 'fileSystems', 'File Systems'],
      ['indexedDB', 'indexedDB', 'Indexed DB'],
      ['serviceWorkers', 'serviceWorkers', 'Service Workers'],
      ['webSQL', 'webSQL', 'WebSQL'],
    ];

    // Data types that DON'T support origin filtering (clears ALL browser data)
    const globalOnlyTypes: Array<[keyof typeof dataTypes, keyof chrome.browsingData.DataTypeSet, string]> = [
      ['history', 'history', 'Browsing History'],
      ['downloads', 'downloads', 'Download History'],
      ['formData', 'formData', 'Form Data'],
      ['passwords', 'passwords', 'Saved Passwords'],
      ['pluginData', 'pluginData', 'Plugin Data'],
    ];

    // Build origin-filtered data to remove
    const originDataToRemove: chrome.browsingData.DataTypeSet = {};
    for (const [settingKey, apiKey, displayName] of originSupportedTypes) {
      if (dataTypes[settingKey]) {
        originDataToRemove[apiKey] = true;
        clearedTypes.push(displayName);
      }
    }

    // Build global data to remove (no origin filter)
    const globalDataToRemove: chrome.browsingData.DataTypeSet = {};
    for (const [settingKey, apiKey, displayName] of globalOnlyTypes) {
      if (dataTypes[settingKey]) {
        globalDataToRemove[apiKey] = true;
        clearedTypes.push(displayName);
      }
    }

    // Clear origin-filtered data
    if (Object.keys(originDataToRemove).length > 0) {
      const originOptions: chrome.browsingData.RemovalOptions = {
        origins: [origin],
      };
      if (sinceTime > 0) {
        originOptions.since = sinceTime;
      }
      await chrome.browsingData.remove(originOptions, originDataToRemove);
    }

    // Clear global data (no origin filter - affects all sites!)
    if (Object.keys(globalDataToRemove).length > 0) {
      const globalOptions: chrome.browsingData.RemovalOptions = {};
      if (sinceTime > 0) {
        globalOptions.since = sinceTime;
      }
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
