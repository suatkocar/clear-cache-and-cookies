import { storage, getCleanUrl } from '../utils/storage';
import { clearBrowsingData, clearSessionStorage } from '../utils/clearData';
import type { Message, ClearDataPayload, Settings } from '../types/settings';

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
      notifyAllTabs({ action: 'SETTINGS_UPDATED', payload: settings });
      sendResponse({ success: true });
      break;
    }

    case 'CLEAR_DATA': {
      const payload = message.payload as ClearDataPayload;
      const result = await clearBrowsingData(payload.url, payload.settings);
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      if (payload.settings.dataTypes.sessionStorage && currentTab?.id) {
        await clearSessionStorage(currentTab.id);
        result.clearedTypes.push('Session Storage');
      }

      if (result.success && payload.settings.behavior.reloadAfterClear && currentTab?.id && currentTab?.url) {
        const tabId = currentTab.id;
        const currentUrl = currentTab.url;
        const shouldCleanUrl = payload.settings.behavior.cleanUrlOnReload;
        
        if (shouldCleanUrl) {
          const cleanUrl = getCleanUrl(currentUrl);
          setTimeout(async () => {
            try {
              await chrome.scripting.executeScript({
                target: { tabId },
                func: (url: string) => {
                  window.stop();
                  window.location.replace(url);
                },
                args: [cleanUrl]
              });
            } catch { /* ignore */ }
          }, 100);
        } else {
          setTimeout(() => {
            chrome.tabs.reload(tabId).catch(() => {});
          }, 100);
        }
      }

      sendResponse(result);
      break;
    }

    case 'GET_CURRENT_TAB': {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      sendResponse(tabs[0] || null);
      break;
    }

    default:
      sendResponse({ error: 'Unknown action' });
  }
}

async function notifyAllTabs(message: Message): Promise<void> {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id) {
      try {
        await chrome.tabs.sendMessage(tab.id, message);
      } catch { /* ignore */ }
    }
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'clear-data') {
    const settings = await storage.get();
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    
    if (currentTab?.url && currentTab?.id) {
      const tabId = currentTab.id;
      const currentUrl = currentTab.url;
      
      const result = await clearBrowsingData(currentUrl, settings);
      
      if (settings.dataTypes.sessionStorage) {
        await clearSessionStorage(tabId);
      }

      if (result.success && settings.behavior.reloadAfterClear) {
        if (settings.behavior.cleanUrlOnReload) {
          const cleanUrl = getCleanUrl(currentUrl);
          try {
            await chrome.scripting.executeScript({
              target: { tabId },
              func: (url: string) => {
                window.stop();
                window.location.replace(url);
              },
              args: [cleanUrl]
            });
          } catch {
            await chrome.tabs.update(tabId, { url: cleanUrl });
          }
        } else {
          await chrome.tabs.reload(tabId);
        }
      }
    }
  }
});

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    const settings = await storage.get();
    await storage.set(settings);
  }
});
