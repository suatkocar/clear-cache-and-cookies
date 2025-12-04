import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Settings, DataTypeSettings, BehaviorSettings, Theme, ClearResult, TimeRange } from './types/settings';
import { DEFAULT_SETTINGS } from './types/settings';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/themes/light.css';
import 'tippy.js/animations/shift-away.css';
import './App.css';

// Detect if user is on macOS
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0 || 
              navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;

// Keyboard shortcut keys based on OS
const getShortcutKeys = () => {
  if (isMac) {
    return { modifier: '⌥', shift: '⇧', key: 'L' }; // Option + Shift + L
  }
  return { modifier: 'Alt', shift: 'Shift', key: 'L' }; // Alt + Shift + L
};

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
  clock: (
    <Icon>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </Icon>
  ),
  shield: (
    <Icon>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </Icon>
  ),
  bell: (
    <Icon>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Icon>
  ),
  badge: (
    <Icon>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="16" cy="8" r="3" fill="currentColor" />
    </Icon>
  ),
  menu: (
    <Icon>
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </Icon>
  ),
  download: (
    <Icon>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </Icon>
  ),
  upload: (
    <Icon>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </Icon>
  ),
  chart: (
    <Icon>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </Icon>
  ),
  plus: (
    <Icon>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </Icon>
  ),
  x: (
    <Icon>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </Icon>
  ),
  startup: (
    <Icon>
      <polygon points="5 3 19 12 5 21 5 3" />
    </Icon>
  ),
  tabClose: (
    <Icon>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="9" y1="9" x2="15" y2="15" />
      <line x1="15" y1="9" x2="9" y2="15" />
    </Icon>
  ),
  // New data type icons
  history: (
    <Icon>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 8 14" />
      <path d="M3 12h1" />
      <path d="M20 12h1" />
    </Icon>
  ),
  downloads: (
    <Icon>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </Icon>
  ),
  formData: (
    <Icon>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="7" y1="8" x2="17" y2="8" />
      <line x1="7" y1="12" x2="17" y2="12" />
      <line x1="7" y1="16" x2="12" y2="16" />
    </Icon>
  ),
  passwords: (
    <Icon>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      <circle cx="12" cy="16" r="1" fill="currentColor" />
    </Icon>
  ),
  pluginData: (
    <Icon>
      <path d="M12 2v4" />
      <path d="M12 18v4" />
      <path d="M4.93 4.93l2.83 2.83" />
      <path d="M16.24 16.24l2.83 2.83" />
      <path d="M2 12h4" />
      <path d="M18 12h4" />
      <path d="M4.93 19.07l2.83-2.83" />
      <path d="M16.24 7.76l2.83-2.83" />
    </Icon>
  ),
  siteSettings: (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2" />
      <path d="M12 21v2" />
      <path d="M4.22 4.22l1.42 1.42" />
      <path d="M18.36 18.36l1.42 1.42" />
      <path d="M1 12h2" />
      <path d="M21 12h2" />
      <path d="M4.22 19.78l1.42-1.42" />
      <path d="M18.36 5.64l1.42-1.42" />
    </Icon>
  ),
  hostedAppData: (
    <Icon>
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </Icon>
  ),
  blacklist: (
    <Icon>
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </Icon>
  ),
  profile: (
    <Icon>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </Icon>
  ),
  rules: (
    <Icon>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </Icon>
  ),
};

const timeRangeLabels: Record<TimeRange, string> = {
  last15min: 'Last 15 minutes',
  lastHour: 'Last hour',
  last24Hours: 'Last 24 hours',
  lastWeek: 'Last week',
  allTime: 'All time',
};

// Detailed tooltip content for each data type
const dataTypeTooltips: Record<keyof DataTypeSettings, { title: string; description: string; usage: string; whenToClear: string }> = {
  cache: {
    title: 'Browser Cache (HTTP Cache)',
    description: 'The HTTP cache stores copies of web resources (HTML pages, CSS stylesheets, JavaScript files, images, fonts) locally on your device. When you revisit a page, the browser serves these files from cache instead of downloading them again, following HTTP caching headers like Cache-Control and ETag.',
    usage: 'Websites use caching to dramatically improve load times and reduce bandwidth usage. A typical website can load 50-80% faster on repeat visits thanks to cached resources. This also reduces server load and saves data on metered connections.',
    whenToClear: 'Clear when: pages display outdated content or broken layouts, CSS/JS changes aren\'t reflected, images show old versions, or you\'re developing a website and need to see fresh changes.',
  },
  cacheStorage: {
    title: 'Cache Storage API (Service Worker Cache)',
    description: 'The Cache Storage API is a modern browser storage system that allows Service Workers to cache network requests and responses programmatically. Unlike HTTP cache, developers have full control over what gets cached, how long it stays, and when it\'s updated. Storage limit is typically 50% of available disk space.',
    usage: 'Essential for Progressive Web Apps (PWAs) to work offline. Apps like Twitter, Spotify Web, and Google Docs use this to cache app shells, API responses, and assets. It enables features like offline reading, background sync, and instant loading.',
    whenToClear: 'Clear if: a PWA shows stale data, offline mode behaves unexpectedly, or an app seems to ignore your login state. Also useful when an app takes up too much storage space.',
  },
  cookies: {
    title: 'HTTP Cookies',
    description: 'Cookies are small text files (max 4KB each, up to ~180 cookies per domain) sent between your browser and web servers via HTTP headers. They contain key-value pairs with optional attributes like expiration date, domain scope, Secure flag, and HttpOnly flag. First-party cookies come from the site you\'re visiting; third-party cookies come from other domains.',
    usage: 'Cookies are the primary mechanism for maintaining user sessions and authentication on the web. They store session tokens for keeping you logged in, remember shopping cart contents, save language/currency preferences, and enable analytics tracking. Third-party cookies are commonly used for cross-site advertising and tracking.',
    whenToClear: 'Clear to: log out of all websites at once, stop targeted advertising, fix login issues, remove tracking cookies, or troubleshoot authentication problems. Note: clearing cookies will sign you out everywhere.',
  },
  localStorage: {
    title: 'Web Storage API: localStorage',
    description: 'localStorage is part of the Web Storage API (defined in HTML5 spec) providing synchronous key-value storage that persists indefinitely until explicitly cleared. Each origin (protocol + domain + port) gets up to 5-10MB of storage. Data is stored as strings only - objects must be JSON serialized. Unlike cookies, localStorage data is never sent to the server automatically.',
    usage: 'Websites use localStorage for persistent client-side data that doesn\'t need to go to the server: user preferences (dark mode, font size), draft content (unsaved form data), feature flags, cached API responses, offline data, authentication tokens (JWTs), and application state. Popular frameworks like React and Vue store app state here.',
    whenToClear: 'Clear if: a website behaves incorrectly or shows outdated UI, an app won\'t let you re-do onboarding, you want to reset a site completely, or you\'re troubleshooting JavaScript errors. Also consider clearing if a site is using excessive storage.',
  },
  sessionStorage: {
    title: 'Web Storage API: sessionStorage',
    description: 'sessionStorage is the temporary counterpart to localStorage, also part of the Web Storage API. It stores data for only one session - data is cleared when the browser tab or window is closed. Each tab has its own isolated sessionStorage, even for the same site. Limit is also 5-10MB per origin.',
    usage: 'Used for sensitive temporary data that shouldn\'t persist: multi-step form wizards, shopping cart during checkout, temporary authentication states, scroll positions, filter/sort settings, and undo history. Because it\'s tab-isolated, opening the same site in two tabs won\'t share sessionStorage.',
    whenToClear: 'Clear to: reset a multi-step process without refreshing, fix a stuck checkout flow, clear temporary form data, or troubleshoot tab-specific issues. Less commonly needed than localStorage since it auto-clears on tab close.',
  },
  fileSystems: {
    title: 'Origin Private File System (OPFS)',
    description: 'The File System Access API provides a sandboxed file system where websites can create, read, write, and organize files and directories. The Origin Private File System (OPFS) is private to each origin and not visible to users in their regular file explorer. It supports fast, synchronous access for high-performance file operations.',
    usage: 'Essential for web applications that work with files: code editors (VS Code Web), image/video editors (Photopea, Clipchamp), document processors (Google Docs offline), and games with save files. OPFS allows near-native file performance without exposing user\'s real file system.',
    whenToClear: 'Clear to: remove files created by web applications, free up significant disk space used by file-heavy apps, or reset apps that store project files locally.',
  },
  indexedDB: {
    title: 'IndexedDB (Client-Side NoSQL Database)',
    description: 'IndexedDB is a low-level, transactional, NoSQL database built into browsers (W3C standard). It can store significant amounts of structured data including files and blobs - storage limit is typically 50% of free disk space, potentially gigabytes. It supports indexes for efficient querying, transactions for data integrity, and asynchronous operations for performance.',
    usage: 'The go-to solution for complex client-side data storage: email clients (Outlook Web) cache thousands of messages, note-taking apps store entire notebooks, mapping apps cache tiles, and productivity apps store full document databases. Any app needing offline capability with complex data uses IndexedDB.',
    whenToClear: 'Clear if: an app is consuming too much disk space, database corruption causes app crashes, you want to force a full re-sync with the server, or offline data is severely outdated. Warning: clearing may result in data loss for apps without cloud backup.',
  },
  serviceWorkers: {
    title: 'Service Workers (Background Scripts)',
    description: 'Service Workers are JavaScript files that run in the background, separate from web pages, acting as a programmable proxy between the browser and network. They can intercept and modify network requests, manage cache strategies, handle push notifications, and enable background sync. Once registered, they persist until explicitly unregistered.',
    usage: 'The backbone of Progressive Web Apps: they enable offline functionality, push notifications (even when the site isn\'t open), background data synchronization, and sophisticated caching strategies. Sites like Twitter, Pinterest, and Starbucks use Service Workers for app-like experiences.',
    whenToClear: 'Clear if: push notifications aren\'t working, the site loads an old cached version even after updates, offline mode behaves unexpectedly, or you\'re debugging PWA issues. Clearing forces the Service Worker to reinstall fresh.',
  },
  webSQL: {
    title: 'WebSQL Database (Deprecated)',
    description: 'WebSQL was an early attempt to bring SQL databases to the browser, allowing websites to create and query SQLite databases using standard SQL syntax. It was never standardized by W3C and has been officially deprecated since 2010, though Chrome still supports it for backward compatibility. Maximum storage was typically 5MB.',
    usage: 'Legacy web applications built before IndexedDB became widely supported may still use WebSQL for storing structured relational data. Some older enterprise apps, games, and offline-capable websites rely on it.',
    whenToClear: 'Clear to: remove data from legacy web applications, troubleshoot older websites, or as part of a complete browser data cleanup. Most modern sites have migrated to IndexedDB.',
  },
  // New data types
  history: {
    title: 'Browsing History',
    description: 'Your browsing history is a detailed log of every webpage you visit, including: full URLs, page titles, visit timestamps, visit counts, and how you got there (typed, clicked link, bookmark). Chrome syncs this across devices if signed in. History also powers the back/forward buttons and address bar autocomplete.',
    usage: 'Browsing history serves multiple purposes: enables back/forward navigation, provides URL suggestions as you type, helps you find previously visited pages, and creates a personal web activity record. Some employers or parental controls may monitor this.',
    whenToClear: 'Clear for privacy: remove traces of sensitive sites visited, prevent others from seeing your browsing habits, clean up address bar suggestions. Note: this doesn\'t clear history on Google\'s servers if you\'re signed in - manage that separately in Google Account settings.',
  },
  downloads: {
    title: 'Download History',
    description: 'Download history is a log of files you\'ve downloaded through the browser, including: filename, download URL, file size, download date/time, and file location on disk. This is separate from the actual downloaded files - clearing the history doesn\'t delete the files themselves.',
    usage: 'The browser maintains this list so you can: quickly access recently downloaded files, re-download files from the same URL, see download progress and completion status, and verify where files were saved.',
    whenToClear: 'Clear to: remove the record of what you\'ve downloaded for privacy, clean up a cluttered downloads list, or hide download activity from other users of the computer. Remember: the actual files remain in your Downloads folder.',
  },
  formData: {
    title: 'Form Autofill Data',
    description: 'Form autofill data includes text you\'ve typed into form fields that Chrome remembers for future use: names, email addresses, phone numbers, street addresses, company names, and any other text inputs. This is separate from saved passwords and payment methods. Chrome may also store form field associations to know which data goes where.',
    usage: 'Autofill dramatically speeds up form completion - studies show it can save 30% of time spent on forms. It\'s especially helpful for: shipping addresses, contact forms, job applications, and any repetitive data entry.',
    whenToClear: 'Clear to: remove outdated personal information (old addresses, former names), clean up incorrect autofill suggestions, protect privacy after using a shared computer, or start fresh with autofill data.',
  },
  passwords: {
    title: 'Saved Passwords & Passkeys',
    description: '⚠️ CRITICAL: This includes all login credentials saved in Chrome\'s password manager: usernames, passwords, and passkeys (WebAuthn credentials). Passwords are encrypted using your operating system\'s secure storage. If signed into Chrome, these sync across all your devices via Google Password Manager.',
    usage: 'The built-in password manager provides: secure encrypted storage for credentials, automatic login to saved sites, password generation for new accounts, breach detection alerts, and cross-device synchronization.',
    whenToClear: '⚠️ EXTREME CAUTION: Only clear if you\'re certain - this action will delete ALL saved passwords and cannot be undone locally. You\'ll need to re-enter passwords for every site. If synced to Google, passwords remain in your Google Account and will re-sync unless you clear there too.',
  },
  pluginData: {
    title: 'Plugin & Extension Data',
    description: 'Data stored by browser plugins (like PDF viewers) and content plugins (historically Flash, Silverlight, Java applets). This includes plugin-specific preferences, cached content, authentication tokens, and locally saved files. Modern browsers have largely phased out plugins in favor of native web technologies.',
    usage: 'Plugins needed local storage for: saving preferences and settings, caching content for performance, maintaining login states, and storing application data. Flash games, for example, saved progress this way.',
    whenToClear: 'Clear to: fix plugin-related issues, remove legacy plugin data, free up space from old Flash content, or as part of complete privacy cleanup. Less relevant for modern browsing since Flash was discontinued in 2020.',
  },
  siteSettings: {
    title: 'Site-Specific Permissions & Settings',
    description: 'Per-site configurations you\'ve set including: camera/microphone access, location sharing, notification permissions, pop-up blocking, JavaScript enabled/disabled, zoom level, autoplay settings, USB/Bluetooth device access, clipboard access, and content settings like cookies per-site.',
    usage: 'These settings let you customize browser behavior for each website: allow video calls on meet.google.com, block notifications from news sites, enable location for maps, set custom zoom for accessibility, and control privacy on a site-by-site basis.',
    whenToClear: 'Clear to: reset a site\'s permissions (especially if you accidentally blocked something), fix permission-related issues, revoke access granted to sites you no longer trust, or troubleshoot when a site can\'t access your camera/mic.',
  },
  hostedAppData: {
    title: 'Installed Web App Data (PWA)',
    description: 'Data specifically associated with Progressive Web Apps (PWAs) you\'ve installed to your device. This includes the app\'s cached shell, offline data, notification settings, and any app-specific storage. Installing a PWA creates a separate data container from the regular website.',
    usage: 'Installed web apps maintain separate data for: faster launching (pre-cached app shell), offline functionality, app-specific preferences, and isolated storage that doesn\'t mix with browser tabs. Apps like Twitter Lite, Spotify, and Starbucks use this.',
    whenToClear: 'Clear to: reset an installed web app to its fresh state, fix issues with a specific PWA, reduce storage used by installed apps, or before uninstalling a PWA to ensure complete removal.',
  },
};

const dataTypeLabels: Record<keyof DataTypeSettings, { label: string; icon: React.ReactNode }> = {
  // Basic types
  cache: { label: 'Cache', icon: icons.cache },
  cacheStorage: { label: 'Cache Storage', icon: icons.cacheStorage },
  cookies: { label: 'Cookies', icon: icons.cookies },
  localStorage: { label: 'Local Storage', icon: icons.localStorage },
  sessionStorage: { label: 'Session Storage', icon: icons.sessionStorage },
  // Advanced types
  fileSystems: { label: 'File Systems', icon: icons.fileSystems },
  indexedDB: { label: 'Indexed DB', icon: icons.indexedDB },
  serviceWorkers: { label: 'Service Workers', icon: icons.serviceWorkers },
  webSQL: { label: 'WebSQL', icon: icons.webSQL },
  // New types
  history: { label: 'Browsing History', icon: icons.history },
  downloads: { label: 'Download History', icon: icons.downloads },
  formData: { label: 'Form Data', icon: icons.formData },
  passwords: { label: 'Passwords ⚠️', icon: icons.passwords },
  pluginData: { label: 'Plugin Data', icon: icons.pluginData },
  siteSettings: { label: 'Site Settings', icon: icons.siteSettings },
  hostedAppData: { label: 'App Data', icon: icons.hostedAppData },
};

// Detailed tooltip content for behavior settings
const behaviorTooltips: Record<string, { title: string; description: string; tip: string }> = {
  reloadAfterClear: {
    title: 'Reload After Clear',
    description: 'Automatically refreshes the current page after clearing data to apply changes immediately.',
    tip: 'Recommended for seeing the effects of clearing cache and cookies right away.',
  },
  cleanUrlOnReload: {
    title: 'Clean URL on Reload',
    description: 'Removes query parameters (?id=123) and paths (/page/subpage) from the URL when reloading.',
    tip: 'Useful for resetting to a clean state, like going back to a homepage after logout.',
  },
  autoClearOnActivate: {
    title: 'Auto-Clear on Activate',
    description: 'Automatically clears selected data types the moment you open the extension popup.',
    tip: '⚠️ Use with caution - this clears data without confirmation!',
  },
  closeAfterClear: {
    title: 'Close After Clear',
    description: 'Automatically closes the extension popup after successfully clearing data.',
    tip: 'Streamlines the workflow if you just want a quick one-click clear.',
  },
  floatingButtonEnabled: {
    title: 'Floating Button',
    description: 'Adds a draggable floating button on every webpage. Left-click to clear selected data, right-click for detailed menu with data type toggles.',
    tip: 'Drag to reposition. Hover to see what will be cleared. Right-click for individual data type clearing.',
  },
  showBadge: {
    title: 'Cookie Count Badge',
    description: 'Shows the number of cookies for the current site on the extension icon in the toolbar.',
    tip: 'Quickly see how many cookies a site has stored without opening the extension.',
  },
  showNotification: {
    title: 'Show Notifications',
    description: 'Displays a desktop notification after data has been cleared, confirming what was removed.',
    tip: 'Useful for getting confirmation without keeping the extension popup open.',
  },
  contextMenuEnabled: {
    title: 'Context Menu',
    description: 'Adds clear options to the browser right-click menu. Includes all data types, Clear All, whitelist and blacklist options.',
    tip: 'Right-click anywhere on a page to clear specific data types or manage site lists.',
  },
};

function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isClearing, setIsClearing] = useState(false);
  const [clearResult, setClearResult] = useState<ClearResult | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'main' | 'settings' | 'advanced' | 'stats'>('main');
  const [newWhitelistDomain, setNewWhitelistDomain] = useState('');
  const [cookieCount, setCookieCount] = useState(0);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');

  useEffect(() => {
    chrome.runtime.sendMessage({ action: 'GET_SETTINGS' }, (response: Settings) => {
      if (response) {
        setSettings(response);
      }
    });

    chrome.runtime.sendMessage({ action: 'GET_CURRENT_TAB' }, (tab: chrome.tabs.Tab) => {
      if (tab?.url) {
        setCurrentUrl(tab.url);
        // Get cookie count for current site
        chrome.runtime.sendMessage({ action: 'GET_COOKIE_COUNT', payload: tab.url }, (response: { count: number }) => {
          if (response?.count !== undefined) {
            setCookieCount(response.count);
          }
        });
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
      activeProfile: '', // Clear active profile when manually changing
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

  const handleTimeRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSettings = { ...settings, timeRange: e.target.value as TimeRange };
    saveSettings(newSettings);
  };

  const addToWhitelist = () => {
    if (!newWhitelistDomain.trim()) return;
    const domain = newWhitelistDomain.trim().toLowerCase();
    if (!settings.whitelist.includes(domain)) {
      const newSettings = {
        ...settings,
        whitelist: [...settings.whitelist, domain],
      };
      saveSettings(newSettings);
    }
    setNewWhitelistDomain('');
  };

  const removeFromWhitelist = (domain: string) => {
    const newSettings = {
      ...settings,
      whitelist: settings.whitelist.filter((d) => d !== domain),
    };
    saveSettings(newSettings);
  };

  const exportSettings = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'clear-cache-settings.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const importSettings = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string) as Settings;
        saveSettings(imported);
      } catch {
        alert('Invalid settings file');
      }
    };
    reader.readAsText(file);
  };

  const formatDate = (timestamp: number): string => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleDateString();
  };

  // Blacklist functions
  const [newBlacklistDomain, setNewBlacklistDomain] = useState('');
  
  const addToBlacklist = () => {
    if (!newBlacklistDomain.trim()) return;
    const domain = newBlacklistDomain.trim().toLowerCase();
    if (!settings.blacklist.includes(domain)) {
      const newSettings = {
        ...settings,
        blacklist: [...settings.blacklist, domain],
      };
      saveSettings(newSettings);
    }
    setNewBlacklistDomain('');
  };

  const removeFromBlacklist = (domain: string) => {
    const newSettings = {
      ...settings,
      blacklist: settings.blacklist.filter((d) => d !== domain),
    };
    saveSettings(newSettings);
  };

  // Profile functions
  const applyProfile = (profileId: string) => {
    // Custom profile just marks it as custom, keeps current selections
    if (profileId === 'custom') {
      const newSettings = {
        ...settings,
        activeProfile: 'custom',
      };
      saveSettings(newSettings);
      return;
    }
    
    const profile = settings.profiles.find(p => p.id === profileId);
    if (profile) {
      const newDataTypes = { ...settings.dataTypes };
      // Reset all to false first for profile presets
      Object.keys(newDataTypes).forEach(key => {
        newDataTypes[key as keyof DataTypeSettings] = false;
      });
      // Apply profile data types
      Object.entries(profile.dataTypes).forEach(([key, value]) => {
        newDataTypes[key as keyof DataTypeSettings] = value as boolean;
      });
      const newSettings = {
        ...settings,
        dataTypes: newDataTypes,
        activeProfile: profileId,
      };
      saveSettings(newSettings);
    }
  };
  
  // Create custom profile - open modal
  const createCustomProfile = () => {
    setNewProfileName('');
    setShowProfileModal(true);
  };
  
  // Save the new profile
  const saveNewProfile = () => {
    if (!newProfileName.trim()) return;
    
    const newProfile = {
      id: `custom-${Date.now()}`,
      name: newProfileName.trim(),
      type: 'custom' as const,
      dataTypes: { ...settings.dataTypes },
    };
    
    const newSettings = {
      ...settings,
      profiles: [...settings.profiles, newProfile],
      activeProfile: newProfile.id,
    };
    saveSettings(newSettings);
    setShowProfileModal(false);
    setNewProfileName('');
  };
  
  // Delete custom profile
  const deleteProfile = (profileId: string) => {
    const profile = settings.profiles.find(p => p.id === profileId);
    if (profile?.isDefault) return; // Can't delete default profiles
    
    const newSettings = {
      ...settings,
      profiles: settings.profiles.filter(p => p.id !== profileId),
      activeProfile: settings.activeProfile === profileId ? 'custom' : settings.activeProfile,
    };
    saveSettings(newSettings);
  };

  return (
    <div className={`app ${settings.theme}`}>
      <header className="header">
        <div className="header-title centered">
          <span className="logo broom-logo">
            <svg width="24" height="24" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fill="#FFCC4E" d="M 4 8C1.792969 8 0 9.792969 0 12C0 14.207031 1.792969 16 4 16C6.207031 16 8 14.207031 8 12C8 9.792969 6.207031 8 4 8 Z M 13 11C11.894531 11 11 11.894531 11 13C11 14.105469 11.894531 15 13 15C14.105469 15 15 14.105469 15 13C15 11.894531 14.105469 11 13 11 Z M 11.5 18C8.46875 18 6 20.46875 6 23.5C6 26.53125 8.46875 29 11.5 29C14.53125 29 17 26.53125 17 23.5C17 20.46875 14.53125 18 11.5 18 Z"/>
              <path fill="#C2694F" d="M46.4375 0.03125C45.539063 0.0390625 44.695313 0.398438 44.21875 1.125L36.625 15.40625C37.1875 15.601563 38.453125 16.164063 42.65625 18.0625L42.71875 18.09375C43.445313 18.421875 44 18.65625 44.21875 18.75C44.292969 18.785156 44.363281 18.839844 44.4375 18.875L49.96875 3.5625C50.316406 2.351563 49.449219 0.957031 48.0625 0.40625C47.546875 0.148438 46.976563 0.0273438 46.4375 0.03125 Z"/>
              <path fill="#FFCC4E" d="M 32.15625 16.625C30.222656 16.769531 28.539063 17.730469 27.34375 19.40625C28.097656 20.675781 29.417969 22.226563 31.28125 22.1875C31.773438 22.167969 32.1875 22.523438 32.28125 23C32.660156 23.589844 34.988281 24.636719 35.65625 24.375C35.9375 24.265625 36.238281 24.289063 36.5 24.4375C36.761719 24.585938 36.949219 24.828125 37 25.125C37.039063 25.289063 37.476563 25.863281 38.375 26.28125C39.082031 26.609375 39.769531 26.691406 40.15625 26.5C40.40625 26.375 40.679688 26.371094 40.9375 26.46875C41.199219 26.566406 41.425781 26.773438 41.53125 27.03125C42.207031 28.679688 45.292969 28.800781 47.40625 28.625C47.714844 27.285156 47.632813 25.890625 47.15625 24.59375C46.496094 22.808594 45.1875 21.398438 43.40625 20.59375C43.21875 20.511719 42.613281 20.222656 41.84375 19.875C38.28125 18.265625 36.269531 17.390625 35.875 17.28125C34.570313 16.765625 33.316406 16.539063 32.15625 16.625 Z"/>
              <path fill="#FFCC4E" d="M 24 25.46875C17.800781 34.082031 7.214844 33.828125 7.09375 33.8125C6.699219 33.777344 6.3125 33.988281 6.125 34.34375C5.9375 34.699219 5.964844 35.125 6.21875 35.4375C8.003906 37.640625 9.921875 39.503906 11.875 41.09375C12.796875 41.277344 18.597656 42.097656 24.34375 35.4375C24.703125 35.019531 25.332031 34.984375 25.75 35.34375C26.167969 35.703125 26.203125 36.332031 25.84375 36.75C21.835938 41.394531 17.609375 42.847656 14.65625 43.15625C17.125 44.820313 19.613281 46.078125 21.9375 47.03125C23.414063 46.722656 28.367188 45.242188 32.75 38.5625C33.054688 38.101563 33.695313 37.945313 34.15625 38.25C34.617188 38.554688 34.742188 39.195313 34.4375 39.65625C31.132813 44.691406 27.515625 47.054688 24.96875 48.15625C30.167969 49.839844 34.046875 49.988281 34.375 50L34.40625 50C34.59375 50 34.777344 49.945313 34.9375 49.84375C35.21875 49.667969 41.007813 45.886719 45.25 35.25C45.085938 35.253906 44.917969 35.28125 44.75 35.28125C42.5625 35.28125 40.035156 34.839844 38.65625 33.125C37.6875 33.242188 36.578125 33.019531 35.5625 32.5C34.734375 32.074219 34.078125 31.503906 33.65625 30.84375C32.59375 30.933594 31.445313 30.550781 30.65625 30.125C29.84375 29.683594 29.207031 29.128906 28.84375 28.5C26.542969 28.621094 24.945313 27.054688 24 25.46875Z"/>
              <path fill="#56ACEE" d="M 26.28125 21.40625C25.96875 22.148438 25.613281 22.84375 25.25 23.5C25.679688 24.546875 26.949219 26.972656 29.28125 26.4375C29.550781 26.375 29.835938 26.410156 30.0625 26.5625C30.292969 26.714844 30.421875 26.949219 30.46875 27.21875C30.535156 27.59375 30.976563 28.039063 31.59375 28.375C32.46875 28.847656 33.414063 28.953125 33.8125 28.78125C34.074219 28.667969 34.367188 28.660156 34.625 28.78125C34.882813 28.902344 35.078125 29.132813 35.15625 29.40625C35.296875 29.882813 35.789063 30.371094 36.46875 30.71875C37.269531 31.125 38.183594 31.273438 38.78125 31.0625C39.242188 30.902344 39.734375 31.097656 39.96875 31.53125C40.851563 33.167969 43.75 33.34375 46 33.1875C46.285156 32.375 46.550781 31.539063 46.8125 30.65625C46.542969 30.671875 46.261719 30.6875 45.96875 30.6875C43.875 30.6875 41.371094 30.273438 40.125 28.5625C39.28125 28.675781 38.3125 28.492188 37.34375 28C36.640625 27.640625 35.867188 27.089844 35.40625 26.40625C34.132813 26.40625 32.667969 25.699219 31.9375 25.25C31.371094 24.902344 30.929688 24.558594 30.65625 24.1875C28.671875 24.003906 27.253906 22.710938 26.28125 21.40625 Z"/>
            </svg>
          </span>
          <h1>Clear Cache & Cookies</h1>
        </div>
        <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
          {settings.theme === 'dark' ? icons.sun : icons.moon}
        </button>
      </header>

      <div className="current-site">
        <span className="site-label">Clearing data for:</span>
        <span className="site-domain">{getDomain(currentUrl)}</span>
        {cookieCount > 0 && <span className="cookie-count">{cookieCount} cookies</span>}
      </div>

      {/* Tab Navigation */}
      <div className="tab-nav">
        <button className={`tab-btn ${activeTab === 'main' ? 'active' : ''}`} onClick={() => setActiveTab('main')}>
          Clear
        </button>
        <button className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
          Settings
        </button>
        <button className={`tab-btn ${activeTab === 'advanced' ? 'active' : ''}`} onClick={() => setActiveTab('advanced')}>
          Advanced
        </button>
        <button className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>
          Stats
        </button>
      </div>

      <div className="tab-content">
      {activeTab === 'main' && (
        <>
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
            <label key={key} className="option-item">
              <input
                type="checkbox"
                checked={settings.dataTypes[key]}
                onChange={() => toggleDataType(key)}
              />
              <span className="option-icon">{dataTypeLabels[key].icon}</span>
              <span className="option-label">{dataTypeLabels[key].label}</span>
              <Tippy
                content={
                  <div className="tooltip-content">
                    <div className="tooltip-title">{dataTypeTooltips[key].title}</div>
                    <div className="tooltip-section">
                      <strong>What is it?</strong>
                      <p>{dataTypeTooltips[key].description}</p>
                    </div>
                    <div className="tooltip-section">
                      <strong>Why do sites use it?</strong>
                      <p>{dataTypeTooltips[key].usage}</p>
                    </div>
                    <div className="tooltip-section">
                      <strong>When to clear?</strong>
                      <p>{dataTypeTooltips[key].whenToClear}</p>
                    </div>
                    <div className="tooltip-action">
                      {settings.dataTypes[key] ? '✓ Will be cleared' : '○ Not selected'}
                    </div>
                  </div>
                }
                theme={settings.theme === 'dark' ? 'dark-custom' : 'light-custom'}
                placement="left"
                animation="shift-away"
                interactive={true}
                maxWidth={280}
                delay={[200, 0]}
              >
                <span className="option-help">?</span>
              </Tippy>
            </label>
          ))}
          
        </div>
      </section>
        </>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <>
      <section className="section keyboard-section">
        <div className="keyboard-row">
          <span className="keyboard-icon">{icons.keyboard}</span>
          <span className="keyboard-label">Keyboard shortcut</span>
          <span className="keyboard-shortcut">
            {(() => {
              const keys = getShortcutKeys();
              return (
                <>
                  <kbd>{keys.modifier}</kbd>
                  <kbd>{keys.shift}</kbd>
                  <kbd>{keys.key}</kbd>
                </>
              );
            })()}
          </span>
          <button className="keyboard-configure" onClick={openShortcuts}>
            Configure
          </button>
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
          <Tippy
            content={
              <div className="tooltip-content">
                <div className="tooltip-title">{behaviorTooltips.reloadAfterClear.title}</div>
                <div className="tooltip-section">
                  <strong>What it does</strong>
                  <p>{behaviorTooltips.reloadAfterClear.description}</p>
                </div>
                <div className="tooltip-section">
                  <strong>💡 Tip</strong>
                  <p>{behaviorTooltips.reloadAfterClear.tip}</p>
                </div>
              </div>
            }
            theme={settings.theme === 'dark' ? 'dark-custom' : 'light-custom'}
            placement="left"
            animation="shift-away"
            interactive={true}
            maxWidth={260}
            delay={[200, 0]}
          >
            <span className="option-help">?</span>
          </Tippy>
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
          </span>
          <Tippy
            content={
              <div className="tooltip-content">
                <div className="tooltip-title">{behaviorTooltips.cleanUrlOnReload.title}</div>
                <div className="tooltip-section">
                  <strong>What it does</strong>
                  <p>{behaviorTooltips.cleanUrlOnReload.description}</p>
                </div>
                <div className="tooltip-section">
                  <strong>Example</strong>
                  <p>example.com/page?id=1 → example.com/</p>
                </div>
                <div className="tooltip-section">
                  <strong>💡 Tip</strong>
                  <p>{behaviorTooltips.cleanUrlOnReload.tip}</p>
                </div>
              </div>
            }
            theme={settings.theme === 'dark' ? 'dark-custom' : 'light-custom'}
            placement="left"
            animation="shift-away"
            interactive={true}
            maxWidth={260}
            delay={[200, 0]}
          >
            <span className="option-help">?</span>
          </Tippy>
        </label>

        <label className="behavior-item">
          <input
            type="checkbox"
            checked={settings.behavior.autoClearOnActivate}
            onChange={() => toggleBehavior('autoClearOnActivate')}
          />
          <span className="behavior-icon">{icons.autoClear}</span>
          <span className="behavior-text">Auto-clear selected data when activated</span>
          <Tippy
            content={
              <div className="tooltip-content">
                <div className="tooltip-title">{behaviorTooltips.autoClearOnActivate.title}</div>
                <div className="tooltip-section">
                  <strong>What it does</strong>
                  <p>{behaviorTooltips.autoClearOnActivate.description}</p>
                </div>
                <div className="tooltip-section">
                  <strong>⚠️ Warning</strong>
                  <p>{behaviorTooltips.autoClearOnActivate.tip}</p>
                </div>
              </div>
            }
            theme={settings.theme === 'dark' ? 'dark-custom' : 'light-custom'}
            placement="left"
            animation="shift-away"
            interactive={true}
            maxWidth={260}
            delay={[200, 0]}
          >
            <span className="option-help">?</span>
          </Tippy>
        </label>

        <label className="behavior-item">
          <input
            type="checkbox"
            checked={settings.behavior.closeAfterClear}
            onChange={() => toggleBehavior('closeAfterClear')}
          />
          <span className="behavior-icon">{icons.close}</span>
          <span className="behavior-text">Close extension after clearing</span>
          <Tippy
            content={
              <div className="tooltip-content">
                <div className="tooltip-title">{behaviorTooltips.closeAfterClear.title}</div>
                <div className="tooltip-section">
                  <strong>What it does</strong>
                  <p>{behaviorTooltips.closeAfterClear.description}</p>
                </div>
                <div className="tooltip-section">
                  <strong>💡 Tip</strong>
                  <p>{behaviorTooltips.closeAfterClear.tip}</p>
                </div>
              </div>
            }
            theme={settings.theme === 'dark' ? 'dark-custom' : 'light-custom'}
            placement="left"
            animation="shift-away"
            interactive={true}
            maxWidth={260}
            delay={[200, 0]}
          >
            <span className="option-help">?</span>
          </Tippy>
        </label>

        <label className="behavior-item">
          <input
            type="checkbox"
            checked={settings.behavior.floatingButtonEnabled}
            onChange={() => toggleBehavior('floatingButtonEnabled')}
          />
          <span className="behavior-icon">{icons.floating}</span>
          <span className="behavior-text">Enable floating button on pages</span>
          <Tippy
            content={
              <div className="tooltip-content">
                <div className="tooltip-title">{behaviorTooltips.floatingButtonEnabled.title}</div>
                <div className="tooltip-section">
                  <strong>What it does</strong>
                  <p>{behaviorTooltips.floatingButtonEnabled.description}</p>
                </div>
                <div className="tooltip-section">
                  <strong>💡 Tip</strong>
                  <p>{behaviorTooltips.floatingButtonEnabled.tip}</p>
                </div>
              </div>
            }
            theme={settings.theme === 'dark' ? 'dark-custom' : 'light-custom'}
            placement="left"
            animation="shift-away"
            interactive={true}
            maxWidth={260}
            delay={[200, 0]}
          >
            <span className="option-help">?</span>
          </Tippy>
        </label>

        <label className="behavior-item">
          <input
            type="checkbox"
            checked={settings.behavior.showBadge}
            onChange={() => toggleBehavior('showBadge')}
          />
          <span className="behavior-icon">{icons.badge}</span>
          <span className="behavior-text">Show cookie count on icon badge</span>
          <Tippy
            content={
              <div className="tooltip-content">
                <div className="tooltip-title">{behaviorTooltips.showBadge.title}</div>
                <div className="tooltip-section">
                  <strong>What it does</strong>
                  <p>{behaviorTooltips.showBadge.description}</p>
                </div>
                <div className="tooltip-section">
                  <strong>💡 Tip</strong>
                  <p>{behaviorTooltips.showBadge.tip}</p>
                </div>
              </div>
            }
            theme={settings.theme === 'dark' ? 'dark-custom' : 'light-custom'}
            placement="left"
            animation="shift-away"
            interactive={true}
            maxWidth={260}
            delay={[200, 0]}
          >
            <span className="option-help">?</span>
          </Tippy>
        </label>

        <label className="behavior-item">
          <input
            type="checkbox"
            checked={settings.behavior.showNotification}
            onChange={() => toggleBehavior('showNotification')}
          />
          <span className="behavior-icon">{icons.bell}</span>
          <span className="behavior-text">Show notification after clearing</span>
          <Tippy
            content={
              <div className="tooltip-content">
                <div className="tooltip-title">{behaviorTooltips.showNotification.title}</div>
                <div className="tooltip-section">
                  <strong>What it does</strong>
                  <p>{behaviorTooltips.showNotification.description}</p>
                </div>
                <div className="tooltip-section">
                  <strong>💡 Tip</strong>
                  <p>{behaviorTooltips.showNotification.tip}</p>
                </div>
              </div>
            }
            theme={settings.theme === 'dark' ? 'dark-custom' : 'light-custom'}
            placement="left"
            animation="shift-away"
            interactive={true}
            maxWidth={260}
            delay={[200, 0]}
          >
            <span className="option-help">?</span>
          </Tippy>
        </label>

        <label className="behavior-item">
          <input
            type="checkbox"
            checked={settings.behavior.contextMenuEnabled}
            onChange={() => toggleBehavior('contextMenuEnabled')}
          />
          <span className="behavior-icon">{icons.menu}</span>
          <span className="behavior-text">Enable right-click context menu</span>
          <Tippy
            content={
              <div className="tooltip-content">
                <div className="tooltip-title">{behaviorTooltips.contextMenuEnabled.title}</div>
                <div className="tooltip-section">
                  <strong>What it does</strong>
                  <p>{behaviorTooltips.contextMenuEnabled.description}</p>
                </div>
                <div className="tooltip-section">
                  <strong>💡 Tip</strong>
                  <p>{behaviorTooltips.contextMenuEnabled.tip}</p>
                </div>
              </div>
            }
            theme={settings.theme === 'dark' ? 'dark-custom' : 'light-custom'}
            placement="left"
            animation="shift-away"
            interactive={true}
            maxWidth={260}
            delay={[200, 0]}
          >
            <span className="option-help">?</span>
          </Tippy>
        </label>
      </section>
        </>
      )}

      {/* Advanced Tab */}
      {activeTab === 'advanced' && (
        <>
      {/* Time Range Section */}
      <section className="section time-range-section">
        <div className="time-range-row">
          <span className="time-range-icon">{icons.clock}</span>
          <span className="time-range-label">Clear data from</span>
          <select
            className="time-range-select"
            value={settings.timeRange}
            onChange={handleTimeRangeChange}
          >
            {(Object.keys(timeRangeLabels) as TimeRange[]).map((key) => (
              <option key={key} value={key}>{timeRangeLabels[key]}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Whitelist Section */}
      <section className="section whitelist-section">
        <h2 className="section-title">{icons.shield} Whitelist</h2>
        <p className="section-description">Sites that will never be cleared</p>
        
        <div className="whitelist-input-row">
          <input
            type="text"
            className="whitelist-input"
            placeholder="example.com"
            value={newWhitelistDomain}
            onChange={(e) => setNewWhitelistDomain(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addToWhitelist()}
          />
          <button className="whitelist-add-btn" onClick={addToWhitelist}>
            {icons.plus}
          </button>
        </div>
        
        {settings.whitelist.length > 0 && (
          <div className="whitelist-items">
            {settings.whitelist.map((domain) => (
              <div key={domain} className="whitelist-item">
                <span>{domain}</span>
                <button className="whitelist-remove-btn" onClick={() => removeFromWhitelist(domain)}>
                  {icons.x}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Blacklist Section */}
      <section className="section blacklist-section">
        <h2 className="section-title">{icons.blacklist} Blacklist</h2>
        <Tippy
          content={
            <div className="tooltip-content">
              <div className="tooltip-title">Blacklist (Always Clear)</div>
              <div className="tooltip-section">
                <strong>What it does</strong>
                <p>Sites added here will always have their data cleared when you use the extension, regardless of other settings.</p>
              </div>
              <div className="tooltip-section">
                <strong>💡 Use case</strong>
                <p>Add tracking sites, ad networks, or any site you want to always clear cookies from.</p>
              </div>
            </div>
          }
          theme={settings.theme === 'dark' ? 'dark-custom' : 'light-custom'}
          placement="top"
          animation="shift-away"
          interactive={true}
          maxWidth={260}
        >
          <span className="section-help">?</span>
        </Tippy>
        <p className="section-description">Sites that will always be cleared (auto-clear)</p>
        
        <div className="blacklist-input-row">
          <input
            type="text"
            className="blacklist-input"
            placeholder="tracking-site.com"
            value={newBlacklistDomain}
            onChange={(e) => setNewBlacklistDomain(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addToBlacklist()}
          />
          <button className="blacklist-add-btn" onClick={addToBlacklist}>
            {icons.plus}
          </button>
        </div>
        
        {settings.blacklist.length > 0 && (
          <div className="blacklist-items">
            {settings.blacklist.map((domain) => (
              <div key={domain} className="blacklist-item">
                <span>{domain}</span>
                <button className="blacklist-remove-btn" onClick={() => removeFromBlacklist(domain)}>
                  {icons.x}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Cleaning Profiles Section */}
      <section className="section profiles-section">
        <h2 className="section-title">{icons.profile} Quick Profiles</h2>
        <Tippy
          content={
            <div className="tooltip-content">
              <div className="tooltip-title">Cleaning Profiles</div>
              <div className="tooltip-section">
                <strong>What it does</strong>
                <p>Pre-configured cleaning presets for different situations. Click a profile to instantly apply its settings.</p>
              </div>
              <div className="tooltip-section">
                <strong>Profiles</strong>
                <p><strong>Default:</strong> All storage types<br/>
                   <strong>Quick:</strong> Cache, Cookies, Local Storage<br/>
                   <strong>Deep:</strong> Everything including history & form data<br/>
                   <strong>Privacy:</strong> Cookies, History, Form Data, Storage<br/>
                   <strong>Developer:</strong> Cache, Service Workers, IndexedDB</p>
                <p className="tooltip-tip">💡 Use "Save As Profile" to create your own!</p>
              </div>
            </div>
          }
          theme={settings.theme === 'dark' ? 'dark-custom' : 'light-custom'}
          placement="top"
          animation="shift-away"
          interactive={true}
          maxWidth={280}
        >
          <span className="section-help">?</span>
        </Tippy>
        <div className="profiles-grid">
          {settings.profiles.map((profile) => (
            <div key={profile.id} className="profile-item">
              <button
                className={`profile-btn ${settings.activeProfile === profile.id ? 'active' : ''} profile-${profile.type}`}
                onClick={() => applyProfile(profile.id)}
              >
                <span className="profile-name">{profile.name}</span>
                <span className="profile-count">
                  {Object.values(profile.dataTypes).filter(Boolean).length} items
                </span>
              </button>
              {!profile.isDefault && (
                <button 
                  className="profile-delete" 
                  onClick={(e) => { e.stopPropagation(); deleteProfile(profile.id); }}
                  title="Delete profile"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            className="profile-btn profile-add"
            onClick={createCustomProfile}
            title="Create a new profile with your current data type selections"
          >
            <span className="profile-name">+ New Profile</span>
            <span className="profile-count">From current settings</span>
          </button>
        </div>
        
        {/* Profile Name Modal */}
        {showProfileModal && (
          <div className="profile-modal">
            <input
              type="text"
              className="profile-input"
              placeholder="Enter profile name..."
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveNewProfile()}
              autoFocus
            />
            <div className="profile-modal-actions">
              <button className="modal-btn cancel" onClick={() => setShowProfileModal(false)}>
                Cancel
              </button>
              <button className="modal-btn save" onClick={saveNewProfile} disabled={!newProfileName.trim()}>
                Save
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Export/Import Section */}
      <section className="section export-section">
        <h2 className="section-title">Settings Backup</h2>
        <div className="export-buttons">
          <button className="export-btn" onClick={exportSettings}>
            {icons.download} Export
          </button>
          <label className="import-btn">
            {icons.upload} Import
            <input type="file" accept=".json" onChange={importSettings} hidden />
          </label>
        </div>
      </section>
        </>
      )}

      {/* Stats Tab */}
      {activeTab === 'stats' && (
        <>
      {/* Statistics Section */}
      <section className="section stats-section">
        <h2 className="section-title">{icons.chart} Statistics</h2>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-value">{settings.statistics.totalClears}</span>
            <span className="stat-label">Total clears</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{settings.statistics.cookiesCleared}</span>
            <span className="stat-label">Cookies cleared</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{settings.statistics.cacheCleared} MB</span>
            <span className="stat-label">Cache cleared</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{formatDate(settings.statistics.lastClearTime)}</span>
            <span className="stat-label">Last clear</span>
          </div>
        </div>
      </section>
        </>
      )}
      </div>

      <footer className="footer">
        <a href="mailto:support@example.com" className="support-link">
          {icons.support} Support
        </a>
      </footer>
    </div>
  );
}

export default App;
