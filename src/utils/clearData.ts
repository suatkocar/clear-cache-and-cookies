import type { Settings, ClearResult } from '../types/settings';
import { getDomain, getOrigin } from './storage';

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

  try {
    const { dataTypes } = settings;

    // Build removal options for chrome.browsingData
    const removalOptions: chrome.browsingData.RemovalOptions = {
      origins: [origin],
    };

    // Data types to remove via browsingData API
    const dataToRemove: chrome.browsingData.DataTypeSet = {};

    if (dataTypes.cache) {
      dataToRemove.cache = true;
      clearedTypes.push('Cache');
    }

    if (dataTypes.cacheStorage) {
      dataToRemove.cacheStorage = true;
      clearedTypes.push('Cache Storage');
    }

    if (dataTypes.cookies) {
      dataToRemove.cookies = true;
      clearedTypes.push('Cookies');
    }

    if (dataTypes.fileSystems) {
      dataToRemove.fileSystems = true;
      clearedTypes.push('File Systems');
    }

    if (dataTypes.indexedDB) {
      dataToRemove.indexedDB = true;
      clearedTypes.push('Indexed DB');
    }

    if (dataTypes.localStorage) {
      dataToRemove.localStorage = true;
      clearedTypes.push('Local Storage');
    }

    if (dataTypes.serviceWorkers) {
      dataToRemove.serviceWorkers = true;
      clearedTypes.push('Service Workers');
    }

    if (dataTypes.webSQL) {
      dataToRemove.webSQL = true;
      clearedTypes.push('WebSQL');
    }

    // Clear via browsingData API
    if (Object.keys(dataToRemove).length > 0) {
      await chrome.browsingData.remove(removalOptions, dataToRemove);
    }

    // Session storage needs to be cleared via content script
    // (handled separately in content script)

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
export async function clearSessionStorage(tabId: number): Promise<boolean> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        sessionStorage.clear();
      },
    });
    return true;
  } catch (error) {
    console.error('Error clearing session storage:', error);
    return false;
  }
}
