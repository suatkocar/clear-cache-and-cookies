// Data types that can be cleared
export interface DataTypeSettings {
  cache: boolean;
  cacheStorage: boolean;
  cookies: boolean;
  localStorage: boolean;
  sessionStorage: boolean;
  fileSystems: boolean;
  indexedDB: boolean;
  serviceWorkers: boolean;
  webSQL: boolean;
}

// Behavior settings
export interface BehaviorSettings {
  reloadAfterClear: boolean;
  autoClearOnActivate: boolean;
  closeAfterClear: boolean;
  floatingButtonEnabled: boolean;
  clearProtectedData: boolean;
  cleanUrlOnReload: boolean; // Strip path and query params, keep only domain
}

// Theme settings
export type Theme = 'light' | 'dark' | 'system';

// Complete settings interface
export interface Settings {
  dataTypes: DataTypeSettings;
  behavior: BehaviorSettings;
  theme: Theme;
}

// Default settings
export const DEFAULT_SETTINGS: Settings = {
  dataTypes: {
    cache: true,
    cacheStorage: true,
    cookies: true,
    localStorage: true,
    sessionStorage: true,
    fileSystems: false,
    indexedDB: false,
    serviceWorkers: false,
    webSQL: false,
  },
  behavior: {
    reloadAfterClear: true,
    autoClearOnActivate: true,
    closeAfterClear: true,
    floatingButtonEnabled: false,
    clearProtectedData: false,
    cleanUrlOnReload: true,
  },
  theme: 'dark',
};

// Message types for communication between scripts
export type MessageAction = 
  | 'CLEAR_DATA'
  | 'GET_SETTINGS'
  | 'SAVE_SETTINGS'
  | 'TOGGLE_FLOATING_BUTTON'
  | 'CLEAR_COMPLETE'
  | 'GET_CURRENT_TAB'
  | 'SETTINGS_UPDATED';

export interface Message {
  action: MessageAction;
  payload?: unknown;
}

export interface ClearDataPayload {
  url: string;
  settings: Settings;
}

export interface ClearResult {
  success: boolean;
  clearedTypes: string[];
  error?: string;
}
