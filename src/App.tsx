import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Settings, DataTypeSettings, BehaviorSettings, Theme, ClearResult } from './types/settings';
import { DEFAULT_SETTINGS } from './types/settings';
import './App.css';

const Icon = ({ children }: { children: React.ReactNode }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

const icons = {
  cache: (
    <Icon>
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </Icon>
  ),
  cacheStorage: (
    <Icon>
      <path d="M22 12H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      <line x1="6" y1="16" x2="6.01" y2="16" />
      <line x1="10" y1="16" x2="10.01" y2="16" />
    </Icon>
  ),
  cookies: (
    <Icon>
      <circle cx="12" cy="12" r="10" />
      <circle cx="8" cy="9" r="1.5" fill="currentColor" />
      <circle cx="15" cy="8" r="1" fill="currentColor" />
      <circle cx="10" cy="14" r="1.5" fill="currentColor" />
      <circle cx="16" cy="14" r="1" fill="currentColor" />
      <circle cx="13" cy="11" r="1" fill="currentColor" />
    </Icon>
  ),
  localStorage: (
    <Icon>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </Icon>
  ),
  sessionStorage: (
    <Icon>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </Icon>
  ),
  fileSystems: (
    <Icon>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </Icon>
  ),
  indexedDB: (
    <Icon>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </Icon>
  ),
  serviceWorkers: (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Icon>
  ),
  webSQL: (
    <Icon>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </Icon>
  ),
  protected: (
    <Icon>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Icon>
  ),
  reload: (
    <Icon>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </Icon>
  ),
  autoClear: (
    <Icon>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </Icon>
  ),
  close: (
    <Icon>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </Icon>
  ),
  floating: (
    <Icon>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  ),
  cleanUrl: (
    <Icon>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </Icon>
  ),
  keyboard: (
    <Icon>
      <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
      <path d="M6 8h.001" />
      <path d="M10 8h.001" />
      <path d="M14 8h.001" />
      <path d="M18 8h.001" />
      <path d="M8 12h.001" />
      <path d="M12 12h.001" />
      <path d="M16 12h.001" />
      <line x1="7" y1="16" x2="17" y2="16" />
    </Icon>
  ),
  sun: (
    <Icon>
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </Icon>
  ),
  moon: (
    <Icon>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </Icon>
  ),
  support: (
    <Icon>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </Icon>
  ),
  trash: (
    <Icon>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </Icon>
  ),
};

const dataTypeLabels: Record<keyof DataTypeSettings, { label: string; icon: React.ReactNode; tooltip: string }> = {
  cache: { label: 'Cache', icon: icons.cache, tooltip: 'Temporary storage for web pages and resources' },
  cacheStorage: { label: 'Cache Storage', icon: icons.cacheStorage, tooltip: 'Advanced caching for offline access' },
  cookies: { label: 'Cookies', icon: icons.cookies, tooltip: 'Small data stored by websites' },
  localStorage: { label: 'Local Storage', icon: icons.localStorage, tooltip: 'Persistent storage across sessions' },
  sessionStorage: { label: 'Session Storage', icon: icons.sessionStorage, tooltip: 'Storage for current session only' },
  fileSystems: { label: 'File Systems', icon: icons.fileSystems, tooltip: 'Browser file storage space' },
  indexedDB: { label: 'Indexed DB', icon: icons.indexedDB, tooltip: 'Structured database storage' },
  serviceWorkers: { label: 'Service Workers', icon: icons.serviceWorkers, tooltip: 'Background scripts for offline features' },
  webSQL: { label: 'WebSQL', icon: icons.webSQL, tooltip: 'Deprecated SQL-like database' },
};

function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isClearing, setIsClearing] = useState(false);
  const [clearResult, setClearResult] = useState<ClearResult | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string>('');

  useEffect(() => {
    chrome.runtime.sendMessage({ action: 'GET_SETTINGS' }, (response: Settings) => {
      if (response) {
        setSettings(response);
      }
    });

    chrome.runtime.sendMessage({ action: 'GET_CURRENT_TAB' }, (tab: chrome.tabs.Tab) => {
      if (tab?.url) {
        setCurrentUrl(tab.url);
      }
    });
  }, []);

  const saveSettings = useCallback((newSettings: Settings) => {
    setSettings(newSettings);
    chrome.runtime.sendMessage({ action: 'SAVE_SETTINGS', payload: newSettings });
  }, []);

  const handleClearData = useCallback(() => {
    if (!currentUrl || isClearing) return;

    setIsClearing(true);
    setClearResult(null);

    chrome.runtime.sendMessage(
      {
        action: 'CLEAR_DATA',
        payload: { url: currentUrl, settings },
      },
      (result: ClearResult) => {
        setIsClearing(false);
        setClearResult(result);

        if (result?.success && settings.behavior.closeAfterClear) {
          setTimeout(() => window.close(), 500);
        }
      }
    );
  }, [currentUrl, isClearing, settings]);

  const hasAutoClearedRef = useRef(false);
  useEffect(() => {
    if (settings.behavior.autoClearOnActivate && currentUrl && !hasAutoClearedRef.current) {
      hasAutoClearedRef.current = true;
      const timer = setTimeout(() => {
        handleClearData();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [settings.behavior.autoClearOnActivate, currentUrl, handleClearData]);

  const toggleDataType = (key: keyof DataTypeSettings) => {
    const newSettings = {
      ...settings,
      dataTypes: {
        ...settings.dataTypes,
        [key]: !settings.dataTypes[key],
      },
    };
    saveSettings(newSettings);
  };

  const toggleBehavior = (key: keyof BehaviorSettings) => {
    const newSettings = {
      ...settings,
      behavior: {
        ...settings.behavior,
        [key]: !settings.behavior[key],
      },
    };
    saveSettings(newSettings);
  };

  const toggleTheme = () => {
    const newTheme: Theme = settings.theme === 'dark' ? 'light' : 'dark';
    const newSettings = { ...settings, theme: newTheme };
    saveSettings(newSettings);
  };

  const openShortcuts = () => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  };

  const getDomain = (url: string): string => {
    try {
      return new URL(url).hostname;
    } catch {
      return 'Unknown site';
    }
  };

  return (
    <div className={`app ${settings.theme}`}>
      <header className="header">
        <div className="header-title">
          <span className="logo">{icons.reload}</span>
          <h1>Clear Cache & Cookies</h1>
        </div>
        <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
          {settings.theme === 'dark' ? icons.sun : icons.moon}
        </button>
      </header>

      <div className="current-site">
        <span className="site-label">Clearing data for:</span>
        <span className="site-domain">{getDomain(currentUrl)}</span>
      </div>

      <button
        className={`clear-button ${isClearing ? 'clearing' : ''} ${clearResult?.success ? 'success' : ''}`}
        onClick={handleClearData}
        disabled={isClearing || !currentUrl}
      >
        {isClearing ? 'Clearing...' : clearResult?.success ? '✓ Cleared!' : 'Clear Selected Data'}
      </button>

      <section className="section">
        <h2 className="section-title">Data to Remove</h2>
        <div className="options-grid">
          {(Object.keys(dataTypeLabels) as Array<keyof DataTypeSettings>).map((key) => (
            <label key={key} className="option-item" title={dataTypeLabels[key].tooltip}>
              <input
                type="checkbox"
                checked={settings.dataTypes[key]}
                onChange={() => toggleDataType(key)}
              />
              <span className="option-icon">{dataTypeLabels[key].icon}</span>
              <span className="option-label">{dataTypeLabels[key].label}</span>
              <span className="option-help">?</span>
            </label>
          ))}
          
          <label className="option-item" title="Clear protected data like session cookies">
            <input
              type="checkbox"
              checked={settings.behavior.clearProtectedData}
              onChange={() => toggleBehavior('clearProtectedData')}
            />
            <span className="option-icon">{icons.protected}</span>
            <span className="option-label">Clear protected data</span>
            <span className="option-help">?</span>
          </label>
        </div>
      </section>

      <section className="section behavior-section">
        <label className="behavior-item">
          <input
            type="checkbox"
            checked={settings.behavior.reloadAfterClear}
            onChange={() => toggleBehavior('reloadAfterClear')}
          />
          <span className="behavior-icon">{icons.reload}</span>
          <span className="behavior-text">Reload the page after clearing website data</span>
        </label>

        <label className="behavior-item">
          <input
            type="checkbox"
            checked={settings.behavior.cleanUrlOnReload}
            onChange={() => toggleBehavior('cleanUrlOnReload')}
            disabled={!settings.behavior.reloadAfterClear}
          />
          <span className="behavior-icon">{icons.cleanUrl}</span>
          <span className="behavior-text">
            Clean URL on reload (remove path & parameters)
            <br />
            <small>e.g., example.com/page?id=1 → example.com/</small>
          </span>
        </label>

        <label className="behavior-item">
          <input
            type="checkbox"
            checked={settings.behavior.autoClearOnActivate}
            onChange={() => toggleBehavior('autoClearOnActivate')}
          />
          <span className="behavior-icon">{icons.autoClear}</span>
          <span className="behavior-text">Auto-clear selected data when the extension is activated</span>
        </label>

        <label className="behavior-item">
          <input
            type="checkbox"
            checked={settings.behavior.closeAfterClear}
            onChange={() => toggleBehavior('closeAfterClear')}
          />
          <span className="behavior-icon">{icons.close}</span>
          <span className="behavior-text">Close extension after clearing</span>
        </label>

        <label className="behavior-item">
          <input
            type="checkbox"
            checked={settings.behavior.floatingButtonEnabled}
            onChange={() => toggleBehavior('floatingButtonEnabled')}
          />
          <span className="behavior-icon">{icons.floating}</span>
          <span className="behavior-text">
            Enable a floating element on every page
            <br />
            <small>(clicking on it will clear data for the current site)</small>
          </span>
        </label>
      </section>

      <section className="section keyboard-section">
        <div className="keyboard-row">
          <span className="keyboard-icon">{icons.keyboard}</span>
          <span className="keyboard-label">Keyboard shortcut</span>
          <span className="keyboard-shortcut">⌥⇧L</span>
          <button className="keyboard-configure" onClick={openShortcuts}>
            Configure
          </button>
        </div>
      </section>

      <footer className="footer">
        <a href="mailto:support@example.com" className="support-link">
          {icons.support} Support
        </a>
      </footer>
    </div>
  );
}

export default App;
