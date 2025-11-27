import type { Settings } from '../types/settings';
import { DEFAULT_SETTINGS } from '../types/settings';

// Chrome storage wrapper for settings
export const storage = {
  async get(): Promise<Settings> {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['settings'], (result: { settings?: Settings }) => {
        if (result.settings) {
          // Merge with defaults to handle new settings added in updates
          resolve({ ...DEFAULT_SETTINGS, ...result.settings });
        } else {
          resolve(DEFAULT_SETTINGS);
        }
      });
    });
  },

  async set(settings: Settings): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ settings }, resolve);
    });
  },

  async update(partial: Partial<Settings>): Promise<Settings> {
    const current = await this.get();
    const updated = { ...current, ...partial };
    await this.set(updated);
    return updated;
  },
};

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
