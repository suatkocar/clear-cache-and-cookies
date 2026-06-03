import { storage, getCleanUrl, getDomain, localStats } from '../utils/storage';
import { clearBrowsingData, clearSessionStorage, isScriptableUrl, canScriptTab, isDomainBlocked, resolveClearTabId } from '../utils/clearData';
import { recordClear, flushStats } from '../utils/statsRecorder';
import type { Message, ClearDataPayload, Settings } from '../types/settings';

// ==================== MESSAGE HANDLING ====================

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true;
});

async function handleMessage(
  message: Message,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): Promise<void> {
  switch (message.action) {
    case 'GET_SETTINGS': {
      await flushStats(); // surface any debounced clears in the stats the popup shows
      const [settings, statistics] = await Promise.all([storage.get(), localStats.get()]);
      sendResponse({ ...settings, statistics });
      break;
    }

    case 'GET_INIT_DATA': {
      // Single round-trip for popup mount: settings + stats + active tab + cookie count.
      await flushStats();
      const [settings, statistics, tabs] = await Promise.all([
        storage.get(),
        localStats.get(),
        chrome.tabs.query({ active: true, currentWindow: true }),
      ]);
      const tab = tabs[0];
      const cookieCount = tab?.url ? await getCookieCount(tab.url) : 0;
      sendResponse({ settings: { ...settings, statistics }, currentTab: tab ?? null, cookieCount });
      break;
    }

    case 'SAVE_SETTINGS': {
      const settings = message.payload as Settings;
      await storage.set(settings);
      
      // Update features based on new settings
      updateContextMenu(settings);
      updateScheduledCleaning(settings);
      if (settings.behavior.showBadge) {
        updateBadge();
      } else {
        chrome.action.setBadgeText({ text: '' });
      }
      
      notifyAllTabs({ action: 'SETTINGS_UPDATED', payload: settings });
      sendResponse({ success: true });
      break;
    }

    case 'CLEAR_DATA': {
      const payload = message.payload as ClearDataPayload;
      
      // Fire browsing-data removal immediately.
      const browsingPromise = clearBrowsingData(payload.url, payload.settings);

      // Resolve the target tab WITHOUT a tabs.query round-trip when possible:
      // the popup passes payload.tabId, a content-script message carries
      // sender.tab. This removes the last sequential dependency on the hot path,
      // so sessionStorage clearing starts truly in parallel with browsingData.
      let tabId = resolveClearTabId(payload.tabId, sender.tab?.id);
      let tabUrl = payload.url;
      if (tabId == null) {
        // Fallback (rare): neither source had a tab id — find the active tab.
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        tabId = activeTab?.id;
        tabUrl = activeTab?.url ?? payload.url;
      }

      const sessionPromise =
        payload.settings.dataTypes.sessionStorage && tabId != null
          ? clearSessionStorage(tabId, payload.url)
          : Promise.resolve(false);

      const [result, sessionCleared] = await Promise.all([browsingPromise, sessionPromise]);
      if (sessionCleared) {
        result.clearedTypes.push('Session Storage');
      }

      // Update statistics (debounced + local — off the response hot path)
      if (result.success) {
        recordClear(getDomain(payload.url), result.clearedTypes);

        // Show notification if enabled
        if (payload.settings.behavior.showNotification) {
          showNotification(result.clearedTypes);
        }
      }

      // Handle reload after clear
      if (result.success && payload.settings.behavior.reloadAfterClear && tabId != null) {
        reloadTab(tabId, tabUrl, payload.settings.behavior.cleanUrlOnReload);
      }

      // Update badge after clearing
      if (payload.settings.behavior.showBadge) {
        updateBadge();
      }

      sendResponse(result);
      break;
    }

    case 'GET_CURRENT_TAB': {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      sendResponse(tabs[0] || null);
      break;
    }

    case 'GET_COOKIE_COUNT': {
      const url = message.payload as string;
      if (url) {
        const count = await getCookieCount(url);
        sendResponse({ count });
      } else {
        sendResponse({ count: 0 });
      }
      break;
    }

    case 'ADD_TO_WHITELIST': {
      const domain = message.payload as string;
      const settings = await storage.get();
      if (!settings.whitelist.includes(domain)) {
        // Immutable update — never mutate the shared cached settings object.
        const next: Settings = { ...settings, whitelist: [...settings.whitelist, domain] };
        await storage.set(next);
        notifyAllTabs({ action: 'SETTINGS_UPDATED', payload: next });
      }
      sendResponse({ success: true });
      break;
    }

    case 'REMOVE_FROM_WHITELIST': {
      const domain = message.payload as string;
      const settings = await storage.get();
      if (settings.whitelist.includes(domain)) {
        const next: Settings = { ...settings, whitelist: settings.whitelist.filter(d => d !== domain) };
        await storage.set(next);
        notifyAllTabs({ action: 'SETTINGS_UPDATED', payload: next });
      }
      sendResponse({ success: true });
      break;
    }

    case 'GET_STATISTICS': {
      await flushStats(); // surface any debounced clears
      sendResponse(await localStats.get());
      break;
    }

    case 'EXPORT_SETTINGS': {
      await flushStats(); // include pending clears in the export
      const [settings, statistics] = await Promise.all([storage.get(), localStats.get()]);
      sendResponse({ ...settings, statistics });
      break;
    }

    case 'IMPORT_SETTINGS': {
      const newSettings = message.payload as Settings;
      await storage.set(newSettings);
      // Statistics live in local storage; restore them there on import.
      if (newSettings.statistics) {
        await localStats.set(newSettings.statistics);
      }
      updateContextMenu(newSettings);
      updateScheduledCleaning(newSettings);
      notifyAllTabs({ action: 'SETTINGS_UPDATED', payload: newSettings });
      sendResponse({ success: true });
      break;
    }

    case 'DISABLE_FLOATING_BUTTON': {
      const settings = await storage.get();
      const next: Settings = {
        ...settings,
        behavior: { ...settings.behavior, floatingButtonEnabled: false },
      };
      await storage.set(next);
      notifyAllTabs({ action: 'SETTINGS_UPDATED', payload: next });
      sendResponse({ success: true });
      break;
    }

    case 'APPLY_PROFILE': {
      const profileId = message.payload as string;
      const settings = await storage.get();
      const profile = settings.profiles.find(p => p.id === profileId);

      if (profile) {
        // Build a fresh dataTypes object (all off, then profile on) — immutable.
        const nextDataTypes = { ...settings.dataTypes };
        (Object.keys(nextDataTypes) as Array<keyof typeof nextDataTypes>).forEach((key) => {
          nextDataTypes[key] = false;
        });
        Object.entries(profile.dataTypes).forEach(([key, value]) => {
          nextDataTypes[key as keyof typeof nextDataTypes] = value as boolean;
        });
        const next: Settings = { ...settings, dataTypes: nextDataTypes, activeProfile: profileId };
        await storage.set(next);
        updateContextMenu(next);
        // Keep content-script caches (tooltip/menu) in sync with the new selection.
        notifyAllTabs({ action: 'SETTINGS_UPDATED', payload: next });
      }
      sendResponse({ success: true });
      break;
    }

    case 'TOGGLE_DATA_TYPE': {
      const dataType = message.payload as keyof Settings['dataTypes'];
      const settings = await storage.get();
      const next: Settings = {
        ...settings,
        dataTypes: { ...settings.dataTypes, [dataType]: !settings.dataTypes[dataType] },
        activeProfile: '', // Clear active profile when manually changing
      };
      await storage.set(next);
      updateContextMenu(next);
      // Broadcast so every content script refreshes its cached settings (the
      // floating-button tooltip reads dataTypes from that cache).
      notifyAllTabs({ action: 'SETTINGS_UPDATED', payload: next });
      sendResponse({ success: true });
      break;
    }

    default:
      sendResponse({ error: 'Unknown action' });
  }
}

// Reload tab with optional URL cleaning - fire and forget
async function reloadTab(tabId: number, currentUrl: string, cleanUrl: boolean): Promise<void> {
  // Verify tab still exists
  if (!await canScriptTab(tabId, currentUrl)) {
    // Tab closed, navigated, or on restricted page - try simple reload
    try {
      await chrome.tabs.reload(tabId);
    } catch { /* Tab doesn't exist anymore */ }
    return;
  }

  const targetUrl = cleanUrl ? getCleanUrl(currentUrl) : currentUrl;
  const needsCleanNavigation = cleanUrl && targetUrl !== currentUrl;
  
  if (needsCleanNavigation && isScriptableUrl(currentUrl)) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (url: string) => {
          window.stop();
          window.location.replace(url);
        },
        args: [targetUrl]
      });
      return;
    } catch { /* Fall through to alternative methods */ }
  }
  
  // Fallback: use tabs API
  try {
    if (needsCleanNavigation) {
      await chrome.tabs.update(tabId, { url: targetUrl });
    } else {
      // URL already clean or cleanUrl disabled - just reload
      await chrome.tabs.reload(tabId);
    }
  } catch { /* Tab doesn't exist anymore */ }
}

// Notify all tabs in parallel - fire and forget
function notifyAllTabs(message: Message): void {
  chrome.tabs.query({}).then(tabs => {
    // Send to all tabs in parallel, ignore failures
    const validTabs = tabs.filter(tab => tab.id && isScriptableUrl(tab.url));
    Promise.allSettled(
      validTabs.map(tab => chrome.tabs.sendMessage(tab.id!, message))
    );
  });
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'clear-data') {
    // Get settings and current tab in parallel
    const [settings, tabs] = await Promise.all([
      storage.get(),
      chrome.tabs.query({ active: true, currentWindow: true })
    ]);
    
    const currentTab = tabs[0];
    
    if (!currentTab?.url || !currentTab?.id) return;
    
    // Skip restricted URLs
    if (!isScriptableUrl(currentTab.url)) return;
    
    const tabId = currentTab.id;
    const currentUrl = currentTab.url;
    
    // Notify content script that clear started (for floating button animation)
    chrome.tabs.sendMessage(tabId, { action: 'KEYBOARD_CLEAR_START' }).catch(() => {
      // Content script may not be ready yet
    });
    
    // Clear browsing data and session storage in parallel
    const browsingPromise = clearBrowsingData(currentUrl, settings);
    const sessionPromise = settings.dataTypes.sessionStorage
      ? clearSessionStorage(tabId, currentUrl)
      : Promise.resolve(false);

    const [result, sessionCleared] = await Promise.all([browsingPromise, sessionPromise]);
    // Report sessionStorage in clearedTypes (parity with the CLEAR_DATA path).
    if (sessionCleared) {
      result.clearedTypes.push('Session Storage');
    }

    // Notify content script that clear completed
    chrome.tabs.sendMessage(tabId, { action: 'KEYBOARD_CLEAR_COMPLETE', payload: { success: result.success } }).catch(() => {
      // Content script may not be ready
    });

    // Handle successful clear
    if (result.success) {
      // Update statistics (debounced + local)
      recordClear(getDomain(currentUrl), result.clearedTypes);

      // Show notification if enabled
      if (settings.behavior.showNotification) {
        showNotification(result.clearedTypes);
      }
      
      // Update badge
      if (settings.behavior.showBadge) {
        updateBadge();
      }
      
      // Reload if enabled
      if (settings.behavior.reloadAfterClear) {
        await reloadTab(tabId, currentUrl, settings.behavior.cleanUrlOnReload);
      }
    }
  }
});

// ==================== INITIALIZATION ====================

chrome.runtime.onInstalled.addListener(async (details) => {
  const settings = await storage.get();

  if (details.reason === 'install') {
    await storage.set(settings);
  }

  // One-time migration: statistics used to live inside synced settings; move
  // them to local storage (their new home) if local is still empty.
  const existingLocal = await localStats.get();
  if (existingLocal.totalClears === 0 && settings.statistics && settings.statistics.totalClears > 0) {
    await localStats.set(settings.statistics);
  }

  // Initialize all features
  initializeFeatures(settings);
});

// Flush any pending (debounced) statistics before the service worker suspends.
chrome.runtime.onSuspend.addListener(() => {
  void flushStats();
});

// Initialize features on extension load (covers reload scenario)
async function initializeFeatures(settings?: Settings): Promise<void> {
  const currentSettings = settings || await storage.get();
  
  // Always setup context menu if enabled
  updateContextMenu(currentSettings);
  updateScheduledCleaning(currentSettings);
  
  // Update badge
  if (currentSettings.behavior.showBadge) {
    updateBadge();
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Run initialization when service worker starts
(async () => {
  const settings = await storage.get();
  initializeFeatures(settings);
})();

// On startup - clear if enabled
chrome.runtime.onStartup.addListener(async () => {
  const settings = await storage.get();
  
  if (settings.behavior.clearOnStartup) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    if (currentTab?.url && isScriptableUrl(currentTab.url)) {
      await clearBrowsingData(currentTab.url, settings);
    }
  }
  
  // Initialize features
  initializeFeatures(settings);
});

// ==================== BADGE ====================

async function getCookieCount(url: string): Promise<number> {
  try {
    const cookies = await chrome.cookies.getAll({ url });
    return cookies.length;
  } catch {
    return 0;
  }
}

async function updateBadge(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    
    if (currentTab?.url && isScriptableUrl(currentTab.url)) {
      const count = await getCookieCount(currentTab.url);
      const text = count > 99 ? '99+' : count > 0 ? count.toString() : '';
      await chrome.action.setBadgeText({ text });
      await chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    } else {
      await chrome.action.setBadgeText({ text: '' });
    }
  } catch { /* ignore */ }
}

// Update badge when tab changes
chrome.tabs.onActivated.addListener(async () => {
  const settings = await storage.get();
  if (settings.behavior.showBadge) {
    updateBadge();
  }
});

// Badge refresh + blacklist auto-clear on tab completion are handled by the
// single consolidated onUpdated listener in the TAB CLOSE section below.

// ==================== CONTEXT MENU ====================

const dataTypeMenuItems = [
  // Basic
  { id: 'cache', title: '🗂️ Cache' },
  { id: 'cacheStorage', title: '💾 Cache Storage' },
  { id: 'cookies', title: '🍪 Cookies' },
  { id: 'localStorage', title: '📦 Local Storage' },
  { id: 'sessionStorage', title: '⏱️ Session Storage' },
  // Advanced
  { id: 'fileSystems', title: '📁 File Systems' },
  { id: 'indexedDB', title: '🗄️ IndexedDB' },
  { id: 'serviceWorkers', title: '⚙️ Service Workers' },
  { id: 'webSQL', title: '🗃️ WebSQL' },
  // Other
  { id: 'history', title: '📜 Browsing History' },
  { id: 'downloads', title: '📥 Download History' },
  { id: 'formData', title: '📝 Form Data' },
  { id: 'passwords', title: '🔑 Passwords ⚠️' },
  { id: 'pluginData', title: '🔌 Plugin Data' },
  { id: 'siteSettings', title: '🔧 Site Settings' },
  { id: 'hostedAppData', title: '📱 App Data' },
];

function updateContextMenu(settings: Settings): void {
  chrome.contextMenus.removeAll(() => {
    if (settings.behavior.contextMenuEnabled) {
      // Main clear option
      chrome.contextMenus.create({
        id: 'clear-site-data',
        title: '🧹 Clear All (Selected)',
        contexts: ['page', 'frame']
      });
      
      // Separator
      chrome.contextMenus.create({
        id: 'separator-1',
        type: 'separator',
        contexts: ['page', 'frame']
      });
      
      // Individual data type options
      dataTypeMenuItems.forEach(item => {
        const isEnabled = settings.dataTypes[item.id as keyof typeof settings.dataTypes];
        chrome.contextMenus.create({
          id: `clear-${item.id}`,
          title: `${item.title}${isEnabled ? ' ✓' : ''}`,
          contexts: ['page', 'frame']
        });
      });
      
      // Separator
      chrome.contextMenus.create({
        id: 'separator-2',
        type: 'separator',
        contexts: ['page', 'frame']
      });
      
      // Whitelist option
      chrome.contextMenus.create({
        id: 'add-to-whitelist',
        title: '⭐ Add to whitelist',
        contexts: ['page']
      });
      
      // Blacklist option
      chrome.contextMenus.create({
        id: 'add-to-blacklist',
        title: '🚫 Add to blacklist (auto-clear)',
        contexts: ['page']
      });
    }
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.url || !isScriptableUrl(tab.url)) return;
  
  const settings = await storage.get();
  const menuId = info.menuItemId as string;
  
  if (menuId === 'clear-site-data') {
    // Clear all from settings
    const result = await clearBrowsingData(tab.url, settings);
    
    if (result.success) {
      recordClear(getDomain(tab.url), result.clearedTypes);

      if (settings.behavior.showNotification) {
        showNotification(result.clearedTypes);
      }
      
      if (settings.behavior.reloadAfterClear && tab.id) {
        reloadTab(tab.id, tab.url, settings.behavior.cleanUrlOnReload);
      }
    }
  } else if (menuId.startsWith('clear-')) {
    // Clear specific data type — build a fresh settings object (enable only the
    // selected type) without cloning or mutating the shared cache.
    const dataType = menuId.replace('clear-', '');
    const nextDataTypes = { ...settings.dataTypes };
    (Object.keys(nextDataTypes) as Array<keyof typeof nextDataTypes>).forEach((key) => {
      nextDataTypes[key] = (key === dataType);
    });
    const modifiedSettings: Settings = { ...settings, dataTypes: nextDataTypes };

    const result = await clearBrowsingData(tab.url, modifiedSettings);
    
    if (result.success) {
      recordClear(getDomain(tab.url), result.clearedTypes);

      if (settings.behavior.showNotification) {
        showNotification(result.clearedTypes);
      }
      
      if (settings.behavior.reloadAfterClear && tab.id) {
        reloadTab(tab.id, tab.url, settings.behavior.cleanUrlOnReload);
      }
    }
  } else if (menuId === 'add-to-whitelist') {
    const domain = getDomain(tab.url);
    if (domain && !settings.whitelist.includes(domain)) {
      // Immutable update (new array refs) so caches/Sets keyed on identity refresh.
      const next: Settings = {
        ...settings,
        whitelist: [...settings.whitelist, domain],
        blacklist: settings.blacklist.filter(d => d !== domain),
      };
      await storage.set(next);
      notifyAllTabs({ action: 'SETTINGS_UPDATED', payload: next });
      showNotification([`Added ${domain} to whitelist`]);
    }
  } else if (menuId === 'add-to-blacklist') {
    const domain = getDomain(tab.url);
    if (domain && !settings.blacklist.includes(domain)) {
      const next: Settings = {
        ...settings,
        blacklist: [...settings.blacklist, domain],
        whitelist: settings.whitelist.filter(d => d !== domain),
      };
      await storage.set(next);
      notifyAllTabs({ action: 'SETTINGS_UPDATED', payload: next });
      showNotification([`Added ${domain} to blacklist (auto-clear)`]);
    }
  }
});

// ==================== SCHEDULED CLEANING ====================

const ALARM_NAME = 'scheduled-clean';

function updateScheduledCleaning(settings: Settings): void {
  if (settings.schedule.enabled) {
    chrome.alarms.create(ALARM_NAME, {
      periodInMinutes: settings.schedule.intervalHours * 60
    });
  } else {
    chrome.alarms.clear(ALARM_NAME);
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    const settings = await storage.get();
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    
    if (currentTab?.url && isScriptableUrl(currentTab.url)) {
      const result = await clearBrowsingData(currentTab.url, settings);
      
      if (result.success) {
        // Record last scheduled run locally — avoids a full settings sync-write
        // on every alarm (the value isn't surfaced in the UI).
        chrome.storage.local.set({ scheduleLastRun: Date.now() });

        recordClear(getDomain(currentTab.url), result.clearedTypes);

        if (settings.behavior.showNotification) {
          showNotification(result.clearedTypes);
        }
      }
    }
  }
});

// ==================== TAB CLOSE AUTO-CLEAR ====================

// Track tab URLs for clearOnTabClose feature
const tabUrls = new Map<number, string>();

// Blacklist Set cached against the blacklist array reference. storage.get()
// returns a stable cached settings object until settings actually change, so we
// rebuild the Set only then — keeping per-tab-completion lookups at O(labels).
let blacklistRef: string[] | null = null;
let blacklistSet = new Set<string>();
function blacklistSetFor(list: string[]): Set<string> {
  if (list !== blacklistRef) {
    blacklistSet = new Set(list);
    blacklistRef = list;
  }
  return blacklistSet;
}

// Single consolidated tab-completion listener: track URL (cheap, no read),
// then handle badge + blacklist auto-clear behind cheap guards.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (tab.url) tabUrls.set(tabId, tab.url);
  void handleTabComplete(tab);
});

async function handleTabComplete(tab: chrome.tabs.Tab): Promise<void> {
  const settings = await storage.get(); // cached in-memory after first read

  if (settings.behavior.showBadge) {
    updateBadge();
  }

  if (tab.url && isScriptableUrl(tab.url)) {
    const domain = getDomain(tab.url);
    if (domain && isDomainBlocked(domain, blacklistSetFor(settings.blacklist))) {
      console.log(`[Clear Cache] Auto-clearing blacklisted site: ${domain}`);
      const result = await clearBrowsingData(tab.url, settings);
      if (result.success) {
        recordClear(domain, result.clearedTypes); // count auto-clears like every other path
        if (settings.behavior.showNotification) {
          showNotification([`🚫 Auto-cleared blacklisted: ${domain}`, ...result.clearedTypes]);
        }
      }
    }
  }
}

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  const tabUrl = tabUrls.get(tabId);
  tabUrls.delete(tabId); // Clean up
  if (removeInfo.isWindowClosing || !tabUrl || !isScriptableUrl(tabUrl)) return;

  const settings = await storage.get();
  if (!settings.behavior.clearOnTabClose) return;

  const result = await clearBrowsingData(tabUrl, settings);
  if (result.success) {
    recordClear(getDomain(tabUrl), result.clearedTypes);
  }
});

// ==================== NOTIFICATIONS ====================

function showNotification(clearedTypes: string[]): void {
  const message = clearedTypes.length > 0 
    ? `Cleared: ${clearedTypes.join(', ')}`
    : 'No data cleared';
  
  chrome.notifications.create(`clear-${Date.now()}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: 'Clear Cache & Cookies',
    message,
    priority: 2
  }, () => {
    // Ignore errors if notification fails
    if (chrome.runtime.lastError) {
      console.log('Notification error:', chrome.runtime.lastError.message);
    }
  });
}

// ==================== STATISTICS ====================
// Statistics are recorded via recordClear() (debounced) and persisted in
// chrome.storage.local by ../utils/statsRecorder. See ../utils/storage applyClear.
