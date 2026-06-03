// Content script for floating button
(function() {
  'use strict';

  let floatingButton = null;
  // Cached settings for the display paths (tooltip / right-click menu). Refreshed
  // via the SETTINGS_UPDATED broadcast, so hovering no longer wakes the service
  // worker on every mouseenter. Clear *operations* still fetch fresh settings.
  let cachedSettings = null;

  function getSettingsCached(callback) {
    if (cachedSettings) {
      callback(cachedSettings);
      return;
    }
    safeSendMessage({ action: 'GET_SETTINGS' }, (settings) => {
      if (settings) cachedSettings = settings;
      callback(settings);
    });
  }

  // Invalidate the display cache whenever settings change anywhere — including a
  // sync from another device, which never produces a SETTINGS_UPDATED message.
  try {
    if (chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync' && changes.settings) {
          cachedSettings = null;
        }
      });
    }
  } catch {
    // Extension context invalidated — ignore.
  }

  // Check if extension context is valid
  function isExtensionValid() {
    try {
      return chrome.runtime && chrome.runtime.id;
    } catch {
      return false;
    }
  }

  // Safe sendMessage wrapper
  function safeSendMessage(message, callback) {
    if (!isExtensionValid()) return;
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          // Extension context invalidated - ignore silently
          return;
        }
        if (callback) callback(response);
      });
    } catch {
      // Extension context invalidated - ignore silently
    }
  }

  // Initialize
  async function init() {
    if (!isExtensionValid()) return;

    getSettingsCached((settings) => {
      if (settings && settings.behavior && settings.behavior.floatingButtonEnabled) {
        createFloatingButton();
      }
    });
  }

  // Drag state
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let buttonStartX = 0;
  let buttonStartY = 0;
  let hasMoved = false;

  // Create floating button
  function createFloatingButton() {
    if (floatingButton) return;
    if (!document.body) return; // Wait for body

    floatingButton = document.createElement('div');
    floatingButton.id = 'clear-cache-floating-btn';
    // SVG with viewBox 0 0 50 50, elements grouped for animation
    floatingButton.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Bubbles Group -->
        <g class="broom-bubbles">
            <path fill="#FFCC4E" d="M 4 8C1.792969 8 0 9.792969 0 12C0 14.207031 1.792969 16 4 16C6.207031 16 8 14.207031 8 12C8 9.792969 6.207031 8 4 8 Z M 13 11C11.894531 11 11 11.894531 11 13C11 14.105469 11.894531 15 13 15C14.105469 15 15 14.105469 15 13C15 11.894531 14.105469 11 13 11 Z M 11.5 18C8.46875 18 6 20.46875 6 23.5C6 26.53125 8.46875 29 11.5 29C14.53125 29 17 26.53125 17 23.5C17 20.46875 14.53125 18 11.5 18 Z"/>
        </g>
        
        <!-- Broom Body Group (Handle, Bristles, Bandage) -->
        <g class="broom-body" style="transform-origin: 40px 10px;">
            <!-- Handle -->
            <path fill="#C2694F" d="M46.4375 0.03125C45.539063 0.0390625 44.695313 0.398438 44.21875 1.125L36.625 15.40625C37.1875 15.601563 38.453125 16.164063 42.65625 18.0625L42.71875 18.09375C43.445313 18.421875 44 18.65625 44.21875 18.75C44.292969 18.785156 44.363281 18.839844 44.4375 18.875L49.96875 3.5625C50.316406 2.351563 49.449219 0.957031 48.0625 0.40625C47.546875 0.148438 46.976563 0.0273438 46.4375 0.03125 Z"/>
            <!-- Bristles -->
            <path fill="#FFCC4E" d="M 32.15625 16.625C30.222656 16.769531 28.539063 17.730469 27.34375 19.40625C28.097656 20.675781 29.417969 22.226563 31.28125 22.1875C31.773438 22.167969 32.1875 22.523438 32.28125 23C32.660156 23.589844 34.988281 24.636719 35.65625 24.375C35.9375 24.265625 36.238281 24.289063 36.5 24.4375C36.761719 24.585938 36.949219 24.828125 37 25.125C37.039063 25.289063 37.476563 25.863281 38.375 26.28125C39.082031 26.609375 39.769531 26.691406 40.15625 26.5C40.40625 26.375 40.679688 26.371094 40.9375 26.46875C41.199219 26.566406 41.425781 26.773438 41.53125 27.03125C42.207031 28.679688 45.292969 28.800781 47.40625 28.625C47.714844 27.285156 47.632813 25.890625 47.15625 24.59375C46.496094 22.808594 45.1875 21.398438 43.40625 20.59375C43.21875 20.511719 42.613281 20.222656 41.84375 19.875C38.28125 18.265625 36.269531 17.390625 35.875 17.28125C34.570313 16.765625 33.316406 16.539063 32.15625 16.625 Z"/>
            <path fill="#FFCC4E" d="M 24 25.46875C17.800781 34.082031 7.214844 33.828125 7.09375 33.8125C6.699219 33.777344 6.3125 33.988281 6.125 34.34375C5.9375 34.699219 5.964844 35.125 6.21875 35.4375C8.003906 37.640625 9.921875 39.503906 11.875 41.09375C12.796875 41.277344 18.597656 42.097656 24.34375 35.4375C24.703125 35.019531 25.332031 34.984375 25.75 35.34375C26.167969 35.703125 26.203125 36.332031 25.84375 36.75C21.835938 41.394531 17.609375 42.847656 14.65625 43.15625C17.125 44.820313 19.613281 46.078125 21.9375 47.03125C23.414063 46.722656 28.367188 45.242188 32.75 38.5625C33.054688 38.101563 33.695313 37.945313 34.15625 38.25C34.617188 38.554688 34.742188 39.195313 34.4375 39.65625C31.132813 44.691406 27.515625 47.054688 24.96875 48.15625C30.167969 49.839844 34.046875 49.988281 34.375 50L34.40625 50C34.59375 50 34.777344 49.945313 34.9375 49.84375C35.21875 49.667969 41.007813 45.886719 45.25 35.25C45.085938 35.253906 44.917969 35.28125 44.75 35.28125C42.5625 35.28125 40.035156 34.839844 38.65625 33.125C37.6875 33.242188 36.578125 33.019531 35.5625 32.5C34.734375 32.074219 34.078125 31.503906 33.65625 30.84375C32.59375 30.933594 31.445313 30.550781 30.65625 30.125C29.84375 29.683594 29.207031 29.128906 28.84375 28.5C26.542969 28.621094 24.945313 27.054688 24 25.46875Z"/>
            <!-- Bandage -->
            <path fill="#56ACEE" d="M 26.28125 21.40625C25.96875 22.148438 25.613281 22.84375 25.25 23.5C25.679688 24.546875 26.949219 26.972656 29.28125 26.4375C29.550781 26.375 29.835938 26.410156 30.0625 26.5625C30.292969 26.714844 30.421875 26.949219 30.46875 27.21875C30.535156 27.59375 30.976563 28.039063 31.59375 28.375C32.46875 28.847656 33.414063 28.953125 33.8125 28.78125C34.074219 28.667969 34.367188 28.660156 34.625 28.78125C34.882813 28.902344 35.078125 29.132813 35.15625 29.40625C35.296875 29.882813 35.789063 30.371094 36.46875 30.71875C37.269531 31.125 38.183594 31.273438 38.78125 31.0625C39.242188 30.902344 39.734375 31.097656 39.96875 31.53125C40.851563 33.167969 43.75 33.34375 46 33.1875C46.285156 32.375 46.550781 31.539063 46.8125 30.65625C46.542969 30.671875 46.261719 30.6875 45.96875 30.6875C43.875 30.6875 41.371094 30.273438 40.125 28.5625C39.28125 28.675781 38.3125 28.492188 37.34375 28C36.640625 27.640625 35.867188 27.089844 35.40625 26.40625C34.132813 26.40625 32.667969 25.699219 31.9375 25.25C31.371094 24.902344 30.929688 24.558594 30.65625 24.1875C28.671875 24.003906 27.253906 22.710938 26.28125 21.40625 Z"/>
        </g>
      </svg>
      <span class="close-btn" id="clear-cache-close-btn">×</span>
    `;

    // Load saved position and clamp to viewport
    const savedPos = localStorage.getItem('clearCacheButtonPos');
    if (savedPos) {
      try {
        const pos = JSON.parse(savedPos);
        const btnSize = 40;
        const padding = 5;
        const x = Math.max(padding, Math.min(window.innerWidth - btnSize - padding, pos.x));
        const y = Math.max(padding, Math.min(window.innerHeight - btnSize - padding, pos.y));
        floatingButton.style.left = x + 'px';
        floatingButton.style.bottom = 'auto';
        floatingButton.style.top = y + 'px';
        floatingButton.style.right = 'auto';
      } catch (e) {}
    }
    
    // Keep button in viewport on resize (rAF-throttled to avoid layout thrash)
    let resizeRaf = null;
    window.addEventListener('resize', () => {
      if (resizeRaf) return;
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null;
        if (!floatingButton) return;
        const rect = floatingButton.getBoundingClientRect();
        const btnSize = 40;
        const padding = 5;
        let x = rect.left;
        let y = rect.top;
        x = Math.max(padding, Math.min(window.innerWidth - btnSize - padding, x));
        y = Math.max(padding, Math.min(window.innerHeight - btnSize - padding, y));
        floatingButton.style.left = x + 'px';
        floatingButton.style.top = y + 'px';
        floatingButton.style.right = 'auto';
        floatingButton.style.bottom = 'auto';
        // Close menu on resize
        closeContextMenu();
        hideTooltip();
      });
    });

    // Drag triggers on the button. The document-level move/up listeners are
    // attached only while a drag is in progress (handleDragStart) and removed
    // on release (handleDragEnd) — not always-on for every page.
    floatingButton.addEventListener('mousedown', handleDragStart);
    floatingButton.addEventListener('contextmenu', handleRightClick);
    floatingButton.addEventListener('touchstart', handleDragStart, { passive: false });

    // Close button
    const closeBtn = floatingButton.querySelector('#clear-cache-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeFloatingButton();
        // Save preference
        safeSendMessage({ action: 'DISABLE_FLOATING_BUTTON' });
      });
    }

    // Hover tooltip for floating button
    floatingButton.addEventListener('mouseenter', showFloatingButtonTooltip);
    floatingButton.addEventListener('mouseleave', hideFloatingButtonTooltip);

    document.body.appendChild(floatingButton);
    console.log('[Clear Cache] Floating button created');
  }

  // Floating button tooltip
  let floatingButtonTooltip = null;

  function showFloatingButtonTooltip() {
    if (!floatingButton || contextMenu) return; // Don't show if menu is open

    getSettingsCached((settings) => {
      if (!settings || !floatingButton || contextMenu) return;
      
      // Get active data types in dataTypeItems order with checkmarks
      const activeTypes = dataTypeItems
        .filter(item => settings.dataTypes[item.key])
        .map(item => `<span class="fbt-item"><span class="fbt-check">✓</span>${item.icon} ${item.label}</span>`);
      
      // Create tooltip
      floatingButtonTooltip = document.createElement('div');
      floatingButtonTooltip.className = 'floating-btn-tooltip';
      
      if (activeTypes.length === 0) {
        floatingButtonTooltip.innerHTML = `
          <div class="fbt-title">⚠️ No items selected</div>
          <div class="fbt-hint">Right-click to select data types</div>
        `;
      } else {
        floatingButtonTooltip.innerHTML = `
          <div class="fbt-title">🧹 Will be cleared:</div>
          <div class="fbt-list">${activeTypes.join('')}</div>
          <div class="fbt-hint">Right-click for more options</div>
        `;
      }
      
      document.body.appendChild(floatingButtonTooltip);
      
      // Position tooltip
      const btnRect = floatingButton.getBoundingClientRect();
      const tooltipRect = floatingButtonTooltip.getBoundingClientRect();
      const gap = 12;
      
      let left = btnRect.left - tooltipRect.width - gap;
      let top = btnRect.top + (btnRect.height - tooltipRect.height) / 2;
      
      // If not enough space on left, show on right
      if (left < 10) {
        left = btnRect.right + gap;
      }
      
      // Keep in viewport
      top = Math.max(10, Math.min(window.innerHeight - tooltipRect.height - 10, top));
      left = Math.max(10, Math.min(window.innerWidth - tooltipRect.width - 10, left));
      
      floatingButtonTooltip.style.left = left + 'px';
      floatingButtonTooltip.style.top = top + 'px';
    });
  }

  function hideFloatingButtonTooltip() {
    if (floatingButtonTooltip) {
      floatingButtonTooltip.remove();
      floatingButtonTooltip = null;
    }
  }

  // Context menu
  let contextMenu = null;

  const dataTypeItems = [
    // Basic
    { key: 'cache', label: 'Cache', icon: '🗂️', 
      title: 'Browser Cache (HTTP Cache)',
      what: 'The HTTP cache stores copies of web resources (HTML pages, CSS stylesheets, JavaScript files, images, fonts) locally on your device. When you revisit a page, the browser serves these files from cache instead of downloading them again, following HTTP caching headers like Cache-Control and ETag.',
      why: 'Websites use caching to dramatically improve load times and reduce bandwidth usage. A typical website can load 50-80% faster on repeat visits thanks to cached resources. This also reduces server load and saves data on metered connections.',
      when: 'Clear when: pages display outdated content or broken layouts, CSS/JS changes aren\'t reflected, images show old versions, or you\'re developing a website and need to see fresh changes.' },
    { key: 'cacheStorage', label: 'Cache Storage', icon: '💾',
      title: 'Cache Storage API (Service Worker Cache)', 
      what: 'The Cache Storage API is a modern browser storage system that allows Service Workers to cache network requests and responses programmatically. Unlike HTTP cache, developers have full control over what gets cached, how long it stays, and when it\'s updated. Storage limit is typically 50% of available disk space.',
      why: 'Essential for Progressive Web Apps (PWAs) to work offline. Apps like Twitter, Spotify Web, and Google Docs use this to cache app shells, API responses, and assets. It enables features like offline reading, background sync, and instant loading.',
      when: 'Clear if: a PWA shows stale data, offline mode behaves unexpectedly, or an app seems to ignore your login state. Also useful when an app takes up too much storage space.' },
    { key: 'cookies', label: 'Cookies', icon: '🍪',
      title: 'HTTP Cookies',
      what: 'Cookies are small text files (max 4KB each, up to ~180 cookies per domain) sent between your browser and web servers via HTTP headers. They contain key-value pairs with optional attributes like expiration date, domain scope, Secure flag, and HttpOnly flag. First-party cookies come from the site you\'re visiting; third-party cookies come from other domains.',
      why: 'Cookies are the primary mechanism for maintaining user sessions and authentication on the web. They store session tokens for keeping you logged in, remember shopping cart contents, save language/currency preferences, and enable analytics tracking. Third-party cookies are commonly used for cross-site advertising and tracking.',
      when: 'Clear to: log out of all websites at once, stop targeted advertising, fix login issues, remove tracking cookies, or troubleshoot authentication problems. Note: clearing cookies will sign you out everywhere.' },
    { key: 'localStorage', label: 'Local Storage', icon: '📦',
      title: 'Web Storage API: localStorage',
      what: 'localStorage is part of the Web Storage API (defined in HTML5 spec) providing synchronous key-value storage that persists indefinitely until explicitly cleared. Each origin (protocol + domain + port) gets up to 5-10MB of storage. Data is stored as strings only - objects must be JSON serialized. Unlike cookies, localStorage data is never sent to the server automatically.',
      why: 'Websites use localStorage for persistent client-side data that doesn\'t need to go to the server: user preferences (dark mode, font size), draft content (unsaved form data), feature flags, cached API responses, offline data, authentication tokens (JWTs), and application state. Popular frameworks like React and Vue store app state here.',
      when: 'Clear if: a website behaves incorrectly or shows outdated UI, an app won\'t let you re-do onboarding, you want to reset a site completely, or you\'re troubleshooting JavaScript errors. Also consider clearing if a site is using excessive storage.' },
    { key: 'sessionStorage', label: 'Session Storage', icon: '⏱️',
      title: 'Web Storage API: sessionStorage',
      what: 'sessionStorage is the temporary counterpart to localStorage, also part of the Web Storage API. It stores data for only one session - data is cleared when the browser tab or window is closed. Each tab has its own isolated sessionStorage, even for the same site. Limit is also 5-10MB per origin.',
      why: 'Used for sensitive temporary data that shouldn\'t persist: multi-step form wizards, shopping cart during checkout, temporary authentication states, scroll positions, filter/sort settings, and undo history. Because it\'s tab-isolated, opening the same site in two tabs won\'t share sessionStorage.',
      when: 'Clear to: reset a multi-step process without refreshing, fix a stuck checkout flow, clear temporary form data, or troubleshoot tab-specific issues. Less commonly needed than localStorage since it auto-clears on tab close.' },
    // Advanced
    { key: 'fileSystems', label: 'File Systems', icon: '📁',
      title: 'Origin Private File System (OPFS)',
      what: 'The File System Access API provides a sandboxed file system where websites can create, read, write, and organize files and directories. The Origin Private File System (OPFS) is private to each origin and not visible to users in their regular file explorer. It supports fast, synchronous access for high-performance file operations.',
      why: 'Essential for web applications that work with files: code editors (VS Code Web), image/video editors (Photopea, Clipchamp), document processors (Google Docs offline), and games with save files. OPFS allows near-native file performance without exposing user\'s real file system.',
      when: 'Clear to: remove files created by web applications, free up significant disk space used by file-heavy apps, or reset apps that store project files locally.' },
    { key: 'indexedDB', label: 'IndexedDB', icon: '🗄️',
      title: 'IndexedDB (Client-Side NoSQL Database)',
      what: 'IndexedDB is a low-level, transactional, NoSQL database built into browsers (W3C standard). It can store significant amounts of structured data including files and blobs - storage limit is typically 50% of free disk space, potentially gigabytes. It supports indexes for efficient querying, transactions for data integrity, and asynchronous operations for performance.',
      why: 'The go-to solution for complex client-side data storage: email clients (Outlook Web) cache thousands of messages, note-taking apps store entire notebooks, mapping apps cache tiles, and productivity apps store full document databases. Any app needing offline capability with complex data uses IndexedDB.',
      when: 'Clear if: an app is consuming too much disk space, database corruption causes app crashes, you want to force a full re-sync with the server, or offline data is severely outdated. Warning: clearing may result in data loss for apps without cloud backup.' },
    { key: 'serviceWorkers', label: 'Service Workers', icon: '⚙️',
      title: 'Service Workers (Background Scripts)',
      what: 'Service Workers are JavaScript files that run in the background, separate from web pages, acting as a programmable proxy between the browser and network. They can intercept and modify network requests, manage cache strategies, handle push notifications, and enable background sync. Once registered, they persist until explicitly unregistered.',
      why: 'The backbone of Progressive Web Apps: they enable offline functionality, push notifications (even when the site isn\'t open), background data synchronization, and sophisticated caching strategies. Sites like Twitter, Pinterest, and Starbucks use Service Workers for app-like experiences.',
      when: 'Clear if: push notifications aren\'t working, the site loads an old cached version even after updates, offline mode behaves unexpectedly, or you\'re debugging PWA issues. Clearing forces the Service Worker to reinstall fresh.' },
    { key: 'webSQL', label: 'WebSQL', icon: '🗃️',
      title: 'WebSQL Database (Deprecated)',
      what: 'WebSQL was an early attempt to bring SQL databases to the browser, allowing websites to create and query SQLite databases using standard SQL syntax. It was never standardized by W3C and has been officially deprecated since 2010, though Chrome still supports it for backward compatibility. Maximum storage was typically 5MB.',
      why: 'Legacy web applications built before IndexedDB became widely supported may still use WebSQL for storing structured relational data. Some older enterprise apps, games, and offline-capable websites rely on it.',
      when: 'Clear to: remove data from legacy web applications, troubleshoot older websites, or as part of a complete browser data cleanup. Most modern sites have migrated to IndexedDB.' },
    // New types
    { key: 'history', label: 'Browsing History', icon: '📜',
      title: 'Browsing History',
      what: 'Your browsing history is a detailed log of every webpage you visit, including: full URLs, page titles, visit timestamps, visit counts, and how you got there (typed, clicked link, bookmark). Chrome syncs this across devices if signed in. History also powers the back/forward buttons and address bar autocomplete.',
      why: 'Browsing history serves multiple purposes: enables back/forward navigation, provides URL suggestions as you type, helps you find previously visited pages, and creates a personal web activity record. Some employers or parental controls may monitor this.',
      when: 'Clear for privacy: remove traces of sensitive sites visited, prevent others from seeing your browsing habits, clean up address bar suggestions. Note: this doesn\'t clear history on Google\'s servers if you\'re signed in - manage that separately in Google Account settings.' },
    { key: 'downloads', label: 'Download History', icon: '📥',
      title: 'Download History',
      what: 'Download history is a log of files you\'ve downloaded through the browser, including: filename, download URL, file size, download date/time, and file location on disk. This is separate from the actual downloaded files - clearing the history doesn\'t delete the files themselves.',
      why: 'The browser maintains this list so you can: quickly access recently downloaded files, re-download files from the same URL, see download progress and completion status, and verify where files were saved.',
      when: 'Clear to: remove the record of what you\'ve downloaded for privacy, clean up a cluttered downloads list, or hide download activity from other users of the computer. Remember: the actual files remain in your Downloads folder.' },
    { key: 'formData', label: 'Form Data', icon: '📝',
      title: 'Form Autofill Data',
      what: 'Form autofill data includes text you\'ve typed into form fields that Chrome remembers for future use: names, email addresses, phone numbers, street addresses, company names, and any other text inputs. This is separate from saved passwords and payment methods. Chrome may also store form field associations to know which data goes where.',
      why: 'Autofill dramatically speeds up form completion - studies show it can save 30% of time spent on forms. It\'s especially helpful for: shipping addresses, contact forms, job applications, and any repetitive data entry.',
      when: 'Clear to: remove outdated personal information (old addresses, former names), clean up incorrect autofill suggestions, protect privacy after using a shared computer, or start fresh with autofill data.' },
    { key: 'passwords', label: 'Passwords ⚠️', icon: '🔑',
      title: 'Saved Passwords & Passkeys',
      what: '⚠️ CRITICAL: This includes all login credentials saved in Chrome\'s password manager: usernames, passwords, and passkeys (WebAuthn credentials). Passwords are encrypted using your operating system\'s secure storage. If signed into Chrome, these sync across all your devices via Google Password Manager.',
      why: 'The built-in password manager provides: secure encrypted storage for credentials, automatic login to saved sites, password generation for new accounts, breach detection alerts, and cross-device synchronization.',
      when: '⚠️ EXTREME CAUTION: Only clear if you\'re certain - this action will delete ALL saved passwords and cannot be undone locally. You\'ll need to re-enter passwords for every site. If synced to Google, passwords remain in your Google Account and will re-sync unless you clear there too.' },
    { key: 'pluginData', label: 'Plugin Data', icon: '🔌',
      title: 'Plugin & Extension Data',
      what: 'Data stored by browser plugins (like PDF viewers) and content plugins (historically Flash, Silverlight, Java applets). This includes plugin-specific preferences, cached content, authentication tokens, and locally saved files. Modern browsers have largely phased out plugins in favor of native web technologies.',
      why: 'Plugins needed local storage for: saving preferences and settings, caching content for performance, maintaining login states, and storing application data. Flash games, for example, saved progress this way.',
      when: 'Clear to: fix plugin-related issues, remove legacy plugin data, free up space from old Flash content, or as part of complete privacy cleanup. Less relevant for modern browsing since Flash was discontinued in 2020.' },
    { key: 'siteSettings', label: 'Site Settings', icon: '🔧',
      title: 'Site-Specific Permissions & Settings',
      what: 'Per-site configurations you\'ve set including: camera/microphone access, location sharing, notification permissions, pop-up blocking, JavaScript enabled/disabled, zoom level, autoplay settings, USB/Bluetooth device access, clipboard access, and content settings like cookies per-site.',
      why: 'These settings let you customize browser behavior for each website: allow video calls on meet.google.com, block notifications from news sites, enable location for maps, set custom zoom for accessibility, and control privacy on a site-by-site basis.',
      when: 'Clear to: reset a site\'s permissions (especially if you accidentally blocked something), fix permission-related issues, revoke access granted to sites you no longer trust, or troubleshoot when a site can\'t access your camera/mic.' },
    { key: 'hostedAppData', label: 'App Data', icon: '📱',
      title: 'Installed Web App Data (PWA)',
      what: 'Data specifically associated with Progressive Web Apps (PWAs) you\'ve installed to your device. This includes the app\'s cached shell, offline data, notification settings, and any app-specific storage. Installing a PWA creates a separate data container from the regular website.',
      why: 'Installed web apps maintain separate data for: faster launching (pre-cached app shell), offline functionality, app-specific preferences, and isolated storage that doesn\'t mix with browser tabs. Apps like Twitter Lite, Spotify, and Starbucks use this.',
      when: 'Clear to: reset an installed web app to its fresh state, fix issues with a specific PWA, reduce storage used by installed apps, or before uninstalling a PWA to ensure complete removal.' },
  ];

  let lastMouseEvent = null;
  let menuTooltip = null;

  function showTooltip(item, target, isActive) {
    hideTooltip();
    
    menuTooltip = document.createElement('div');
    menuTooltip.id = 'clear-cache-menu-tooltip';
    menuTooltip.innerHTML = `
      <div class="tip-title">${item.title}</div>
      <div class="tip-section">
        <div class="tip-label">WHAT IS IT?</div>
        <div class="tip-text">${item.what}</div>
      </div>
      <div class="tip-section">
        <div class="tip-label">WHY DO SITES USE IT?</div>
        <div class="tip-text">${item.why}</div>
      </div>
      <div class="tip-section">
        <div class="tip-label">WHEN TO CLEAR?</div>
        <div class="tip-text">${item.when}</div>
      </div>
      <div class="tip-status ${isActive ? 'active' : ''}">${isActive ? '✓ Will be cleared' : '○ Will not be cleared'}</div>
    `;
    document.body.appendChild(menuTooltip);
    
    const rect = target.getBoundingClientRect();
    const tooltipRect = menuTooltip.getBoundingClientRect();
    
    // Calculate position
    let top = rect.top + rect.height / 2 - tooltipRect.height / 2;
    let left = rect.left - tooltipRect.width - 12;
    
    // Keep tooltip on screen
    if (left < 10) {
      // Show on right side if no space on left
      left = rect.right + 12;
    }
    if (top < 10) {
      top = 10;
    }
    if (top + tooltipRect.height > window.innerHeight - 10) {
      top = window.innerHeight - tooltipRect.height - 10;
    }
    
    menuTooltip.style.top = top + 'px';
    menuTooltip.style.left = left + 'px';
    
    requestAnimationFrame(() => {
      menuTooltip.classList.add('visible');
    });
  }

  function hideTooltip() {
    if (menuTooltip) {
      menuTooltip.remove();
      menuTooltip = null;
    }
  }

  function updateSelectedCount() {
    if (!contextMenu) return;
    const activeRows = contextMenu.querySelectorAll('.menu-row.active');
    const count = activeRows.length;
    const clearBtn = contextMenu.querySelector('.menu-clear-all');
    if (clearBtn) {
      if (count === 0) {
        clearBtn.innerHTML = `<span>Select items to clear</span>`;
        clearBtn.disabled = true;
        clearBtn.classList.add('disabled');
      } else {
        clearBtn.innerHTML = `<span>Clear <span class="count">${count}</span> Selected</span>`;
        clearBtn.disabled = false;
        clearBtn.classList.remove('disabled');
      }
    }
  }

  function buildMenuContent(settings) {
    const activeTypes = settings.dataTypes || {};
    
    contextMenu.innerHTML = '';
    
    // Data types list
    const list = document.createElement('div');
    list.className = 'menu-list';
    
    dataTypeItems.forEach(item => {
      const isActive = activeTypes[item.key];
      const row = document.createElement('div');
      row.className = 'menu-row' + (isActive ? ' active' : '');
      row.innerHTML = `
        <span class="row-icon">${item.icon}</span>
        <span class="row-label">${item.label}</span>
        <button class="row-clear" title="Clear ${item.label} only"></button>
      `;
      
      // Add broom SVG icon
      const clearBtn = row.querySelector('.row-clear');
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('width', '14');
      svg.setAttribute('height', '14');
      svg.setAttribute('viewBox', '0 0 50 50');
      svg.setAttribute('fill', 'none');
      
      // Handle
      const p1 = document.createElementNS(svgNS, 'path');
      p1.setAttribute('fill', '#C2694F');
      p1.setAttribute('d', 'M46.4375 0.03125C45.539063 0.0390625 44.695313 0.398438 44.21875 1.125L36.625 15.40625C37.1875 15.601563 38.453125 16.164063 42.65625 18.0625L42.71875 18.09375C43.445313 18.421875 44 18.65625 44.21875 18.75C44.292969 18.785156 44.363281 18.839844 44.4375 18.875L49.96875 3.5625C50.316406 2.351563 49.449219 0.957031 48.0625 0.40625C47.546875 0.148438 46.976563 0.0273438 46.4375 0.03125Z');
      
      // Top bristles
      const p2 = document.createElementNS(svgNS, 'path');
      p2.setAttribute('fill', '#FFCC4E');
      p2.setAttribute('d', 'M32.15625 16.625C30.222656 16.769531 28.539063 17.730469 27.34375 19.40625C28.097656 20.675781 29.417969 22.226563 31.28125 22.1875C31.773438 22.167969 32.1875 22.523438 32.28125 23C32.660156 23.589844 34.988281 24.636719 35.65625 24.375C35.9375 24.265625 36.238281 24.289063 36.5 24.4375C36.761719 24.585938 36.949219 24.828125 37 25.125C37.039063 25.289063 37.476563 25.863281 38.375 26.28125C39.082031 26.609375 39.769531 26.691406 40.15625 26.5C40.40625 26.375 40.679688 26.371094 40.9375 26.46875C41.199219 26.566406 41.425781 26.773438 41.53125 27.03125C42.207031 28.679688 45.292969 28.800781 47.40625 28.625C47.714844 27.285156 47.632813 25.890625 47.15625 24.59375C46.496094 22.808594 45.1875 21.398438 43.40625 20.59375C43.21875 20.511719 42.613281 20.222656 41.84375 19.875C38.28125 18.265625 36.269531 17.390625 35.875 17.28125C34.570313 16.765625 33.316406 16.539063 32.15625 16.625Z');
      
      // Bottom bristles
      const p3 = document.createElementNS(svgNS, 'path');
      p3.setAttribute('fill', '#FFCC4E');
      p3.setAttribute('d', 'M24 25.46875C17.800781 34.082031 7.214844 33.828125 7.09375 33.8125C6.699219 33.777344 6.3125 33.988281 6.125 34.34375C5.9375 34.699219 5.964844 35.125 6.21875 35.4375C8.003906 37.640625 9.921875 39.503906 11.875 41.09375C12.796875 41.277344 18.597656 42.097656 24.34375 35.4375C24.703125 35.019531 25.332031 34.984375 25.75 35.34375C26.167969 35.703125 26.203125 36.332031 25.84375 36.75C21.835938 41.394531 17.609375 42.847656 14.65625 43.15625C17.125 44.820313 19.613281 46.078125 21.9375 47.03125C23.414063 46.722656 28.367188 45.242188 32.75 38.5625C33.054688 38.101563 33.695313 37.945313 34.15625 38.25C34.617188 38.554688 34.742188 39.195313 34.4375 39.65625C31.132813 44.691406 27.515625 47.054688 24.96875 48.15625C30.167969 49.839844 34.046875 49.988281 34.375 50L34.40625 50C34.59375 50 34.777344 49.945313 34.9375 49.84375C35.21875 49.667969 41.007813 45.886719 45.25 35.25C45.085938 35.253906 44.917969 35.28125 44.75 35.28125C42.5625 35.28125 40.035156 34.839844 38.65625 33.125C37.6875 33.242188 36.578125 33.019531 35.5625 32.5C34.734375 32.074219 34.078125 31.503906 33.65625 30.84375C32.59375 30.933594 31.445313 30.550781 30.65625 30.125C29.84375 29.683594 29.207031 29.128906 28.84375 28.5C26.542969 28.621094 24.945313 27.054688 24 25.46875Z');
      
      // Bandage
      const p4 = document.createElementNS(svgNS, 'path');
      p4.setAttribute('fill', '#56ACEE');
      p4.setAttribute('d', 'M26.28125 21.40625C25.96875 22.148438 25.613281 22.84375 25.25 23.5C25.679688 24.546875 26.949219 26.972656 29.28125 26.4375C29.550781 26.375 29.835938 26.410156 30.0625 26.5625C30.292969 26.714844 30.421875 26.949219 30.46875 27.21875C30.535156 27.59375 30.976563 28.039063 31.59375 28.375C32.46875 28.847656 33.414063 28.953125 33.8125 28.78125C34.074219 28.667969 34.367188 28.660156 34.625 28.78125C34.882813 28.902344 35.078125 29.132813 35.15625 29.40625C35.296875 29.882813 35.789063 30.371094 36.46875 30.71875C37.269531 31.125 38.183594 31.273438 38.78125 31.0625C39.242188 30.902344 39.734375 31.097656 39.96875 31.53125C40.851563 33.167969 43.75 33.34375 46 33.1875C46.285156 32.375 46.550781 31.539063 46.8125 30.65625C46.542969 30.671875 46.261719 30.6875 45.96875 30.6875C43.875 30.6875 41.371094 30.273438 40.125 28.5625C39.28125 28.675781 38.3125 28.492188 37.34375 28C36.640625 27.640625 35.867188 27.089844 35.40625 26.40625C34.132813 26.40625 32.667969 25.699219 31.9375 25.25C31.371094 24.902344 30.929688 24.558594 30.65625 24.1875C28.671875 24.003906 27.253906 22.710938 26.28125 21.40625Z');
      
      // Bubbles
      const p5 = document.createElementNS(svgNS, 'path');
      p5.setAttribute('fill', '#FFAC33');
      p5.setAttribute('d', 'M4 8C1.792969 8 0 9.792969 0 12C0 14.207031 1.792969 16 4 16C6.207031 16 8 14.207031 8 12C8 9.792969 6.207031 8 4 8ZM13 11C11.894531 11 11 11.894531 11 13C11 14.105469 11.894531 15 13 15C14.105469 15 15 14.105469 15 13C15 11.894531 14.105469 11 13 11ZM11.5 18C8.46875 18 6 20.46875 6 23.5C6 26.53125 8.46875 29 11.5 29C14.53125 29 17 26.53125 17 23.5C17 20.46875 14.53125 18 11.5 18Z');
      
      svg.appendChild(p1);
      svg.appendChild(p2);
      svg.appendChild(p3);
      svg.appendChild(p4);
      svg.appendChild(p5);
      clearBtn.appendChild(svg);
      
      // Tooltip on row hover
      row.addEventListener('mouseenter', () => {
        showTooltip(item, row, row.classList.contains('active'));
      });
      row.addEventListener('mouseleave', hideTooltip);
      
      // Toggle on click
      row.addEventListener('click', (ev) => {
        if (ev.target.classList.contains('row-clear')) return;
        ev.stopPropagation();
        safeSendMessage({ action: 'TOGGLE_DATA_TYPE', payload: item.key });
        row.classList.toggle('active');
        // Update selected count
        updateSelectedCount();
        // Update tooltip if visible
        if (menuTooltip) {
          showTooltip(item, row, row.classList.contains('active'));
        }
      });
      
      // Clear single type
      row.querySelector('.row-clear').addEventListener('click', (ev) => {
        ev.stopPropagation();
        clearSpecificType(item.key, false);
      });
      
      list.appendChild(row);
    });
    contextMenu.appendChild(list);
    
    // Clear all button
    const clearBtn = document.createElement('button');
    clearBtn.className = 'menu-clear-all';
    const count = Object.values(activeTypes).filter(Boolean).length;
    if (count === 0) {
      clearBtn.innerHTML = `<span>Select items to clear</span>`;
      clearBtn.disabled = true;
      clearBtn.classList.add('disabled');
    } else {
      clearBtn.innerHTML = `<span>Clear <span class="count">${count}</span> Selected</span>`;
    }
    clearBtn.addEventListener('click', () => {
      if (clearBtn.disabled) return;
      clearSpecificType('all', true);
      closeContextMenu();
    });
    contextMenu.appendChild(clearBtn);
  }

  function handleRightClick(e) {
    e.preventDefault();
    e.stopPropagation();
    lastMouseEvent = e;
    
    if (contextMenu) {
      contextMenu.remove();
    }

    getSettingsCached((settings) => {
      if (!settings) return;

      contextMenu = document.createElement('div');
      contextMenu.id = 'clear-cache-context-menu';
      
      buildMenuContent(settings);
      positionAndShowMenu(e);
    });
  }

  function positionAndShowMenu(e) {
    if (!contextMenu || !floatingButton) return;

    // Position menu
    const rect = floatingButton.getBoundingClientRect();
    contextMenu.style.visibility = 'hidden';
    document.body.appendChild(contextMenu);
    const menuRect = contextMenu.getBoundingClientRect();
    
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const menuW = menuRect.width;
    const menuH = menuRect.height;
    
    // Decide which side to show menu - prefer left side
    let menuX, menuY;
    const gap = 32; // Gap between menu and button
    
    if (rect.left - menuW - gap >= 0) {
      // Show on left (preferred)
      menuX = rect.left - menuW - gap;
    } else if (rect.right + menuW + gap <= winW) {
      // Show on right
      menuX = rect.right + gap;
    } else {
      // Center horizontally
      menuX = Math.max(10, Math.min(winW - menuW - 10, (winW - menuW) / 2));
    }
    
    // Vertical position - try to align with button, but stay on screen
    menuY = rect.top;
    
    // Clamp to viewport
    menuX = Math.max(10, Math.min(menuX, winW - menuW - 10));
    menuY = Math.max(10, Math.min(menuY, winH - menuH - 10));

    contextMenu.style.left = menuX + 'px';
    contextMenu.style.top = menuY + 'px';
    contextMenu.style.visibility = 'visible';
    
    // Hide tooltips while menu is open
    hideFloatingButtonTooltip();
    if (floatingButton) {
      floatingButton.classList.add('menu-open');
    }

    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', closeContextMenu, { once: true });
    }, 10);
  }

  function closeContextMenu() {
    if (contextMenu) {
      contextMenu.remove();
      contextMenu = null;
    }
    // Show tooltip again
    if (floatingButton) {
      floatingButton.classList.remove('menu-open');
    }
  }

  function clearSpecificType(type, isAll) {
    if (!isExtensionValid()) return;
    
    if (floatingButton) {
      floatingButton.classList.add('loading');
    }

    safeSendMessage({ action: 'GET_SETTINGS' }, (settings) => {
      if (!settings) {
        if (floatingButton) floatingButton.classList.remove('loading');
        return;
      }

      // Create modified settings for specific type (structuredClone avoids the
      // JSON serialize/parse round-trip).
      const modifiedSettings = structuredClone(settings);
      
      if (!isAll) {
        // Clear only the selected type
        Object.keys(modifiedSettings.dataTypes).forEach(key => {
          modifiedSettings.dataTypes[key] = (key === type);
        });
      }

      safeSendMessage({
        action: 'CLEAR_DATA',
        payload: {
          url: window.location.href,
          settings: modifiedSettings
        }
      }, () => {
        if (floatingButton) {
          floatingButton.classList.remove('loading');
        }
      });
    });
  }

  // Drag listeners live on document/window only while a drag is in progress.
  // touchcancel + window blur guarantee cleanup even if the pointer is released
  // off-window or the OS cancels the touch — otherwise they'd leak.
  function attachDragListeners() {
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    document.addEventListener('touchmove', handleDragMove, { passive: false });
    document.addEventListener('touchend', handleDragEnd);
    document.addEventListener('touchcancel', handleDragEnd);
    window.addEventListener('blur', handleDragEnd);
  }

  function detachDragListeners() {
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
    document.removeEventListener('touchmove', handleDragMove);
    document.removeEventListener('touchend', handleDragEnd);
    document.removeEventListener('touchcancel', handleDragEnd);
    window.removeEventListener('blur', handleDragEnd);
  }

  function handleDragStart(e) {
    // Ignore right-click
    if (e.button === 2) return;
    
    // Ignore clicks on close button
    if (e.target.closest('.close-btn')) return;
    
    if (e.type === 'touchstart') {
      e.preventDefault();
      dragStartX = e.touches[0].clientX;
      dragStartY = e.touches[0].clientY;
    } else {
      dragStartX = e.clientX;
      dragStartY = e.clientY;
    }
    
    const rect = floatingButton.getBoundingClientRect();
    buttonStartX = rect.left;
    buttonStartY = rect.top;
    isDragging = true;
    hasMoved = false;
    floatingButton.classList.add('dragging');

    // Attach move/end listeners only for the duration of this drag.
    attachDragListeners();
  }

  function handleDragMove(e) {
    if (!isDragging) return;
    
    let clientX, clientY;
    if (e.type === 'touchmove') {
      e.preventDefault();
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const deltaX = clientX - dragStartX;
    const deltaY = clientY - dragStartY;
    
    // Only count as moved if dragged more than 5px
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      hasMoved = true;
    }

    let newX = buttonStartX + deltaX;
    let newY = buttonStartY + deltaY;

    // Keep within viewport with padding
    const btnSize = 40;
    const padding = 5;
    newX = Math.max(padding, Math.min(window.innerWidth - btnSize - padding, newX));
    newY = Math.max(padding, Math.min(window.innerHeight - btnSize - padding, newY));

    floatingButton.style.left = newX + 'px';
    floatingButton.style.top = newY + 'px';
    floatingButton.style.bottom = 'auto';
    floatingButton.style.right = 'auto';
  }

  function handleDragEnd() {
    if (!isDragging) return;
    isDragging = false;
    detachDragListeners();

    // The button may have been removed mid-drag (settings disabled it, etc.).
    if (!floatingButton) return;

    floatingButton.classList.remove('dragging');

    // Save position
    const rect = floatingButton.getBoundingClientRect();
    localStorage.setItem('clearCacheButtonPos', JSON.stringify({ x: rect.left, y: rect.top }));

    // If not moved, trigger click
    if (!hasMoved) {
      handleClick();
    }
  }

  // Remove floating button
  function removeFloatingButton() {
    if (floatingButton) {
      isDragging = false; // ensure a mid-drag removal doesn't leave us "dragging"
      floatingButton.removeEventListener('mousedown', handleDragStart);
      floatingButton.removeEventListener('touchstart', handleDragStart);
      detachDragListeners();
      floatingButton.remove();
      floatingButton = null;
    }
  }

  // Handle click
  async function handleClick() {
    if (!isExtensionValid()) return;
    
    if (floatingButton) {
      floatingButton.classList.add('loading');
    }

    // Get settings and clear data
    safeSendMessage({ action: 'GET_SETTINGS' }, (settings) => {
      if (!settings) {
        if (floatingButton) floatingButton.classList.remove('loading');
        return;
      }
      
      safeSendMessage({
        action: 'CLEAR_DATA',
        payload: {
          url: window.location.href,
          settings: settings
        }
      }, () => {
        if (floatingButton) {
          floatingButton.classList.remove('loading');
        }
      });
    });
  }

  // Listen for messages from background
  if (!isExtensionValid()) return;
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isExtensionValid()) {
      sendResponse({ received: false });
      return;
    }
    if (message.action === 'SETTINGS_UPDATED') {
      const settings = message.payload;
      cachedSettings = settings; // keep the display cache fresh
      if (settings && settings.behavior && settings.behavior.floatingButtonEnabled) {
        createFloatingButton();
      } else {
        removeFloatingButton();
      }
    }

    if (message.action === 'TOGGLE_FLOATING_BUTTON') {
      if (floatingButton) {
        removeFloatingButton();
      } else {
        createFloatingButton();
      }
    }

    // Keyboard shortcut triggered - show working animation
    if (message.action === 'KEYBOARD_CLEAR_START') {
      if (floatingButton) {
        floatingButton.classList.remove('success');
        floatingButton.classList.add('working');
      }
    }

    // Keyboard shortcut completed - back to normal
    if (message.action === 'KEYBOARD_CLEAR_COMPLETE') {
      if (floatingButton) {
        floatingButton.classList.remove('working');
      }
    }

    sendResponse({ received: true });
    return true;
  });

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
