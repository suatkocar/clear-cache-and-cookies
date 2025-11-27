// Content script for floating button
(function() {
  'use strict';

  let floatingButton = null;

  // Initialize
  async function init() {
    // Get settings from background script
    chrome.runtime.sendMessage({ action: 'GET_SETTINGS' }, (settings) => {
      if (settings && settings.behavior && settings.behavior.floatingButtonEnabled) {
        createFloatingButton();
      }
    });
  }

  // Create floating button
  function createFloatingButton() {
    if (floatingButton) return;

    floatingButton = document.createElement('div');
    floatingButton.id = 'clear-cache-floating-btn';
    floatingButton.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 6H5H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;

    floatingButton.addEventListener('click', handleClick);
    document.body.appendChild(floatingButton);
  }

  // Remove floating button
  function removeFloatingButton() {
    if (floatingButton) {
      floatingButton.removeEventListener('click', handleClick);
      floatingButton.remove();
      floatingButton = null;
    }
  }

  // Handle click
  async function handleClick() {
    if (floatingButton) {
      floatingButton.classList.add('loading');
    }

    // Get settings and clear data
    chrome.runtime.sendMessage({ action: 'GET_SETTINGS' }, (settings) => {
      chrome.runtime.sendMessage({
        action: 'CLEAR_DATA',
        payload: {
          url: window.location.href,
          settings: settings
        }
      }, (response) => {
        if (floatingButton) {
          floatingButton.classList.remove('loading');
          if (response && response.success) {
            floatingButton.classList.add('success');
            setTimeout(() => {
              if (floatingButton) {
                floatingButton.classList.remove('success');
              }
            }, 1000);
          }
        }
      });
    });
  }

  // Listen for messages from background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'SETTINGS_UPDATED') {
      const settings = message.payload;
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
