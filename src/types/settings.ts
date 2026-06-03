// Data types that can be cleared
export interface DataTypeSettings {
  // Basic types
  cache: boolean;
  cacheStorage: boolean;
  cookies: boolean;
  localStorage: boolean;
  sessionStorage: boolean;
  // Advanced types
  fileSystems: boolean;
  indexedDB: boolean;
  serviceWorkers: boolean;
  webSQL: boolean;
  // New types
  history: boolean;           // Browsing history
  downloads: boolean;         // Download history
  formData: boolean;          // Form autofill data
  passwords: boolean;         // Saved passwords (dangerous!)
  pluginData: boolean;        // Plugin/extension data
  siteSettings: boolean;      // Site permissions, zoom levels
  hostedAppData: boolean;     // PWA/Hosted app data
}

// Time range options for clearing data
export type TimeRange = 'last15min' | 'lastHour' | 'last24Hours' | 'lastWeek' | 'allTime';

// Behavior settings
export interface BehaviorSettings {
  reloadAfterClear: boolean;
  autoClearOnActivate: boolean;
  closeAfterClear: boolean;
  floatingButtonEnabled: boolean;
  cleanUrlOnReload: boolean;
  // New features
  clearOnTabClose: boolean;       // Auto-clear when tab closes
  clearOnStartup: boolean;        // Clear on browser startup
  showNotification: boolean;      // Show notification after clear
  showBadge: boolean;             // Show cookie count badge on icon
  contextMenuEnabled: boolean;    // Right-click context menu
}

// Scheduled cleaning settings
export interface ScheduleSettings {
  enabled: boolean;
  intervalHours: number;          // 1, 6, 12, 24 hours
  lastRun: number;                // Timestamp of last scheduled run
}

// Statistics
export interface Statistics {
  totalClears: number;
  cookiesCleared: number;
  cacheCleared: number;           // Approximate MB
  lastClearTime: number;          // Timestamp
  sitesCleared: string[];         // Recent sites (max 10)
}

// Theme settings
export type Theme = 'light' | 'dark' | 'system';

// Cleaning profile presets
export type ProfileType = 'quick' | 'standard' | 'deep' | 'custom';

export interface CleaningProfile {
  id: string;
  name: string;
  type: ProfileType;
  dataTypes: Partial<DataTypeSettings>;
  isDefault?: boolean;
}

// Domain-specific rules
export interface DomainRule {
  domain: string;
  action: 'always_clear' | 'never_clear' | 'custom';
  dataTypes?: Partial<DataTypeSettings>;  // For custom action
  createdAt: number;
}

// Complete settings interface
export interface Settings {
  dataTypes: DataTypeSettings;
  behavior: BehaviorSettings;
  theme: Theme;
  timeRange: TimeRange;
  whitelist: string[];            // Domains to never clear
  blacklist: string[];            // Domains to always clear
  domainRules: DomainRule[];      // Domain-specific rules
  profiles: CleaningProfile[];    // Cleaning profiles
  activeProfile: string;          // Active profile ID
  schedule: ScheduleSettings;
  statistics: Statistics;
}

// Default cleaning profiles
export const DEFAULT_PROFILES: CleaningProfile[] = [
  {
    id: 'default',
    name: 'Default',
    type: 'standard',
    dataTypes: { cache: true, cacheStorage: true, cookies: true, localStorage: true, sessionStorage: true },
    isDefault: true,
  },
  {
    id: 'quick',
    name: 'Quick',
    type: 'quick',
    dataTypes: { cache: true, cookies: true, localStorage: true },
  },
  {
    id: 'deep',
    name: 'Deep',
    type: 'deep',
    dataTypes: {
      cache: true, cacheStorage: true, cookies: true, localStorage: true, sessionStorage: true,
      fileSystems: true, indexedDB: true, serviceWorkers: true, history: true, downloads: true, formData: true,
    },
  },
];

// Default settings
export const DEFAULT_SETTINGS: Settings = {
  dataTypes: {
    // Basic - enabled by default
    cache: true,
    cacheStorage: true,
    cookies: true,
    localStorage: true,
    sessionStorage: true,
    // Advanced - disabled by default
    fileSystems: false,
    indexedDB: false,
    serviceWorkers: false,
    webSQL: false,
    // New types - disabled by default (some are dangerous)
    history: false,
    downloads: false,
    formData: false,
    passwords: false,        // Very dangerous, always off by default
    pluginData: false,
    siteSettings: false,
    hostedAppData: false,
  },
  behavior: {
    reloadAfterClear: true,
    autoClearOnActivate: false,
    closeAfterClear: true,
    floatingButtonEnabled: true,
    cleanUrlOnReload: false,
    clearOnTabClose: false,
    clearOnStartup: false,
    showNotification: true,
    showBadge: false,
    contextMenuEnabled: true,
  },
  theme: 'dark',
  timeRange: 'allTime',
  whitelist: [],
  blacklist: [],
  domainRules: [],
  profiles: DEFAULT_PROFILES,
  activeProfile: 'default',
  schedule: {
    enabled: false,
    intervalHours: 24,
    lastRun: 0,
  },
  statistics: {
    totalClears: 0,
    cookiesCleared: 0,
    cacheCleared: 0,
    lastClearTime: 0,
    sitesCleared: [],
  },
};

// Message types for communication between scripts
export type MessageAction =
  | 'CLEAR_DATA'
  | 'GET_SETTINGS'
  | 'GET_INIT_DATA'
  | 'SAVE_SETTINGS'
  | 'GET_CURRENT_TAB'
  | 'GET_COOKIE_COUNT'
  | 'ADD_TO_WHITELIST'
  | 'REMOVE_FROM_WHITELIST'
  | 'APPLY_PROFILE'
  | 'UPDATE_SCHEDULE'
  | 'EXPORT_SETTINGS'
  | 'IMPORT_SETTINGS'
  | 'GET_STATISTICS'
  | 'DISABLE_FLOATING_BUTTON'
  | 'SETTINGS_UPDATED'
  | 'TOGGLE_FLOATING_BUTTON'
  | 'KEYBOARD_CLEAR_START'
  | 'KEYBOARD_CLEAR_COMPLETE'
  | 'TOGGLE_DATA_TYPE';

export interface Message {
  action: MessageAction;
  payload?: unknown;
}

export interface ClearDataPayload {
  url: string;
  settings: Settings;
  tabId?: number;   // popup supplies this so the SW can skip a tabs.query round-trip
}

export interface ClearResult {
  success: boolean;
  clearedTypes: string[];
  error?: string;
}
