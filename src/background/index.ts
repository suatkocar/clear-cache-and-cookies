import { storage, getCleanUrl, getDomain } from '../utils/storage';
import { clearBrowsingData, clearSessionStorage, isScriptableUrl, canScriptTab } from '../utils/clearData';
import type { Message, ClearDataPayload, Settings } from '../types/settings';

// ==================== MESSAGE HANDLING ====================

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true;
});

async function handleMessage(
  message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): Promise<void> {
  switch (message.action) {
    case 'GET_SETTINGS': {
      const settings = await storage.get();
      sendResponse(settings);
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
      
      const [result, tabs] = await Promise.all([
        clearBrowsingData(payload.url, payload.settings),
        chrome.tabs.query({ active: true, currentWindow: true })
      ]);
      
      const currentTab = tabs[0];
      
      if (payload.settings.dataTypes.sessionStorage && currentTab?.id && currentTab?.url) {
        const sessionCleared = await clearSessionStorage(currentTab.id, currentTab.url);
        if (sessionCleared) {
          result.clearedTypes.push('Session Storage');
        }
      }

      // Update statistics
      if (result.success) {
        await updateStatistics(payload.url, result.clearedTypes);
        
        // Show notification if enabled
        if (payload.settings.behavior.showNotification) {
          showNotification(result.clearedTypes);
        }
      }

      // Handle reload after clear
      if (result.success && payload.settings.behavior.reloadAfterClear && currentTab?.id && currentTab?.url) {
        reloadTab(currentTab.id, currentTab.url, payload.settings.behavior.cleanUrlOnReload);
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
        settings.whitelist.push(domain);
        await storage.set(settings);
      }
      sendResponse({ success: true });
      break;
    }

    case 'REMOVE_FROM_WHITELIST': {
      const domain = message.payload as string;
      const settings = await storage.get();
      settings.whitelist = settings.whitelist.filter(d => d !== domain);
      await storage.set(settings);
      sendResponse({ success: true });
      break;
    }

    case 'GET_STATISTICS': {
      const settings = await storage.get();
      sendResponse(settings.statistics);
      break;
    }

    case 'EXPORT_SETTINGS': {
      const settings = await storage.get();
      sendResponse(settings);
      break;
    }

    case 'IMPORT_SETTINGS': {
      const newSettings = message.payload as Settings;
      await storage.set(newSettings);
      updateContextMenu(newSettings);
      updateScheduledCleaning(newSettings);
      sendResponse({ success: true });
      break;
    }

    case 'DISABLE_FLOATING_BUTTON': {
      const settings = await storage.get();
      settings.behavior.floatingButtonEnabled = false;
      await storage.set(settings);
      sendResponse({ success: true });
      break;
    }

    case 'APPLY_PROFILE': {
      const profileId = message.payload as string;
      const settings = await storage.get();
      const profile = settings.profiles.find(p => p.id === profileId);
      
      if (profile) {
        // Reset all data types to false first
        Object.keys(settings.dataTypes).forEach(key => {
          settings.dataTypes[key as keyof typeof settings.dataTypes] = false;
        });
        // Apply profile data types
        Object.entries(profile.dataTypes).forEach(([key, value]) => {
          settings.dataTypes[key as keyof typeof settings.dataTypes] = value as boolean;
        });
        settings.activeProfile = profileId;
        await storage.set(settings);
        updateContextMenu(settings);
      }
      sendResponse({ success: true });
      break;
    }

    case 'TOGGLE_DATA_TYPE': {
      const dataType = message.payload as string;
      const settings = await storage.get();
      settings.dataTypes[dataType as keyof typeof settings.dataTypes] = 
        !settings.dataTypes[dataType as keyof typeof settings.dataTypes];
      settings.activeProfile = ''; // Clear active profile when manually changing
      await storage.set(settings);
      updateContextMenu(settings);
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
    const clearPromises: Promise<unknown>[] = [
      clearBrowsingData(currentUrl, settings)
    ];
    
    if (settings.dataTypes.sessionStorage) {
      clearPromises.push(clearSessionStorage(tabId, currentUrl));
    }
    
    const [result] = await Promise.all(clearPromises) as [Awaited<ReturnType<typeof clearBrowsingData>>];

    // Notify content script that clear completed
    chrome.tabs.sendMessage(tabId, { action: 'KEYBOARD_CLEAR_COMPLETE', payload: { success: result.success } }).catch(() => {
      // Content script may not be ready
    });

    // Handle successful clear
    if (result.success) {
      // Update statistics
      await updateStatistics(currentUrl, result.clearedTypes);
      
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
  
  // Initialize all features
  initializeFeatures(settings);
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

chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    const settings = await storage.get();
    if (settings.behavior.showBadge) {
      updateBadge();
    }
    
    // Auto-clear for blacklisted sites
    if (tab.url && isScriptableUrl(tab.url)) {
      const domain = getDomain(tab.url);
      if (domain && settings.blacklist.includes(domain)) {
        console.log(`[Clear Cache] Auto-clearing blacklisted site: ${domain}`);
        const result = await clearBrowsingData(tab.url, settings);
        if (result.success && settings.behavior.showNotification) {
          showNotification([`🚫 Auto-cleared blacklisted: ${domain}`, ...result.clearedTypes]);
        }
      }
    }
  }
});

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
      await updateStatistics(tab.url, result.clearedTypes);
      
      if (settings.behavior.showNotification) {
        showNotification(result.clearedTypes);
      }
      
      if (settings.behavior.reloadAfterClear && tab.id) {
        reloadTab(tab.id, tab.url, settings.behavior.cleanUrlOnReload);
      }
    }
  } else if (menuId.startsWith('clear-')) {
    // Clear specific data type
    const dataType = menuId.replace('clear-', '');
    const modifiedSettings = JSON.parse(JSON.stringify(settings));
    
    // Disable all, enable only selected
    Object.keys(modifiedSettings.dataTypes).forEach(key => {
      modifiedSettings.dataTypes[key] = (key === dataType);
    });
    
    const result = await clearBrowsingData(tab.url, modifiedSettings);
    
    if (result.success) {
      await updateStatistics(tab.url, result.clearedTypes);
      
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
      settings.whitelist.push(domain);
      // Remove from blacklist if present
      settings.blacklist = settings.blacklist.filter(d => d !== domain);
      await storage.set(settings);
      showNotification([`Added ${domain} to whitelist`]);
    }
  } else if (menuId === 'add-to-blacklist') {
    const domain = getDomain(tab.url);
    if (domain && !settings.blacklist.includes(domain)) {
      settings.blacklist.push(domain);
      // Remove from whitelist if present
      settings.whitelist = settings.whitelist.filter(d => d !== domain);
      await storage.set(settings);
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
        // Update last run time
        settings.schedule.lastRun = Date.now();
        await storage.set(settings);
        
        await updateStatistics(currentTab.url, result.clearedTypes);
        
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

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url && changeInfo.status === 'complete') {
    tabUrls.set(tabId, tab.url);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  const settings = await storage.get();
  const tabUrl = tabUrls.get(tabId);
  tabUrls.delete(tabId); // Clean up
  
  if (settings.behavior.clearOnTabClose && !removeInfo.isWindowClosing && tabUrl) {
    // Only clear if it was a scriptable URL
    if (isScriptableUrl(tabUrl)) {
      const result = await clearBrowsingData(tabUrl, settings);
      if (result.success) {
        await updateStatistics(tabUrl, result.clearedTypes);
      }
    }
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

async function updateStatistics(url: string, clearedTypes: string[]): Promise<void> {
  // Always get fresh settings from storage to avoid overwriting user settings
  const currentSettings = await storage.get();
  const domain = getDomain(url);
  const stats = currentSettings.statistics;
  
  stats.totalClears++;
  stats.lastClearTime = Date.now();
  
  if (clearedTypes.includes('Cookies')) {
    stats.cookiesCleared += 10; // Approximate
  }
  if (clearedTypes.includes('Cache') || clearedTypes.includes('Cache Storage')) {
    stats.cacheCleared += 5; // Approximate MB
  }
  
  // Keep last 10 sites
  if (domain) {
    stats.sitesCleared = [domain, ...stats.sitesCleared.filter(s => s !== domain)].slice(0, 10);
  }
  
  currentSettings.statistics = stats;
  await storage.set(currentSettings);
}
