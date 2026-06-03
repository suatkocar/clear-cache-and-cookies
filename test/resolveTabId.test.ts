import { describe, it, expect } from 'vitest';
import { resolveClearTabId } from '../src/utils/clearData';

// The CLEAR_DATA handler avoids a chrome.tabs.query round-trip by taking the
// tab id straight from the popup payload (preferred) or the content-script
// sender. -1 is chrome.tabs.TAB_ID_NONE and must be treated as "no tab".
describe('resolveClearTabId', () => {
  it('prefers the payload tab id', () => {
    expect(resolveClearTabId(7, 9)).toBe(7);
  });

  it('falls back to the sender tab id when payload is undefined', () => {
    expect(resolveClearTabId(undefined, 9)).toBe(9);
  });

  it('returns undefined when neither is available', () => {
    expect(resolveClearTabId(undefined, undefined)).toBeUndefined();
  });

  it('treats TAB_ID_NONE (-1) as no tab', () => {
    expect(resolveClearTabId(-1, undefined)).toBeUndefined();
    expect(resolveClearTabId(undefined, -1)).toBeUndefined();
  });

  it('accepts tab id 0', () => {
    expect(resolveClearTabId(0, undefined)).toBe(0);
  });
});
