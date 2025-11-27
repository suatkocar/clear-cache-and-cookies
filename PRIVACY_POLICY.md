# Privacy Policy

**Clear Cache & Cookies**  
Last updated: November 27, 2025

## Overview

Clear Cache & Cookies is a browser extension that helps users clear browsing data for specific websites. This privacy policy explains how the extension handles user data.

## Data Collection

**This extension does not collect, store, or transmit any personal data.**

Specifically, we do not collect:
- Personal information (name, email, address)
- Browsing history
- Website content
- Cookies or cached data content
- Analytics or usage data
- Any form of user tracking

## Data Storage

The extension stores only user preferences (such as which data types to clear and behavior settings) using Chrome's built-in `chrome.storage.sync` API. This data:
- Is stored locally on your device
- Is synced across your Chrome browsers if you are signed into Chrome
- Never leaves your browser or Google's sync infrastructure
- Is not accessible to us or any third party

### Stored Preferences Include:
- Selected data types to clear (cache, cookies, localStorage, etc.)
- Behavior settings (auto-reload, auto-close, theme preference)
- Keyboard shortcut preferences

## Permissions

The extension requires the following permissions:

| Permission | Purpose |
|------------|---------|
| `browsingData` | To clear cache, cookies, and other browsing data |
| `storage` | To save user preferences |
| `tabs` | To reload the current tab after clearing data |
| `cookies` | To clear cookies for specific domains |
| `scripting` | To execute scripts for URL cleaning feature |
| `host_permissions` | To access and clear data for all websites |

These permissions are used solely for the extension's stated functionality and not for data collection.

## Third-Party Services

This extension does not use any third-party services, analytics, or tracking tools.

## Data Sharing

We do not share, sell, or transfer any user data to third parties. There is no data to share because we do not collect any.

## Children's Privacy

This extension does not knowingly collect any information from children under the age of 13.

## Changes to This Policy

We may update this privacy policy from time to time. Any changes will be reflected in the "Last updated" date at the top of this document.

## Open Source

This extension is open source. You can review the complete source code at:  
https://github.com/suatkocar/clear-cache-and-cookies

## Contact

If you have any questions about this privacy policy or the extension, please contact:

**Suat Kocar**  
Email: suatkocar.dev@gmail.com  
GitHub: https://github.com/suatkocar

## Compliance

This extension complies with:
- Chrome Web Store Developer Program Policies
- Chrome Web Store User Data Policy
- General Data Protection Regulation (GDPR)
- California Consumer Privacy Act (CCPA)

Since no personal data is collected, there is no data to request, modify, or delete under these regulations.
