import { describe, it, expect } from 'vitest';
import { isWhitelisted, isBlacklisted } from '../src/utils/clearData';

// Domain list matching must be exact-or-subdomain, NOT loose substring.
// The old `domain.includes(w) || w.includes(domain)` let unrelated hosts match.
describe('isWhitelisted — proper domain matching', () => {
  it('matches an exact domain', () => {
    expect(isWhitelisted('https://example.com/path', ['example.com'])).toBe(true);
  });

  it('matches a subdomain of a listed domain', () => {
    expect(isWhitelisted('https://app.example.com', ['example.com'])).toBe(true);
  });

  it('does NOT match an unrelated host that merely contains the string', () => {
    // 'notexample.com'.includes('example.com') === true under the old code (bug)
    expect(isWhitelisted('https://notexample.com', ['example.com'])).toBe(false);
  });

  it('does NOT match when the listed entry is a substring of the domain', () => {
    // 'example.com'.includes('ample.com') === true under the old code (bug)
    expect(isWhitelisted('https://example.com', ['ample.com'])).toBe(false);
  });

  it('does NOT match a suffix-injection host', () => {
    // 'example.com.evil.com'.includes('example.com') === true under the old code (bug)
    expect(isWhitelisted('https://example.com.evil.com', ['example.com'])).toBe(false);
  });

  it('does NOT treat a more specific entry as covering its parent domain', () => {
    // 'app.example.com'.includes('example.com') === true under the old code (bug)
    expect(isWhitelisted('https://example.com', ['app.example.com'])).toBe(false);
  });

  it('returns false for an empty list', () => {
    expect(isWhitelisted('https://example.com', [])).toBe(false);
  });

  it('returns false for an unparseable url', () => {
    expect(isWhitelisted('not a url', ['example.com'])).toBe(false);
  });
});

describe('isBlacklisted — proper domain matching (same semantics)', () => {
  it('matches exact and subdomain', () => {
    expect(isBlacklisted('https://tracker.io', ['tracker.io'])).toBe(true);
    expect(isBlacklisted('https://ads.tracker.io', ['tracker.io'])).toBe(true);
  });

  it('does NOT match unrelated substring host', () => {
    expect(isBlacklisted('https://mytracker.io.example.com', ['tracker.io'])).toBe(false);
  });
});
