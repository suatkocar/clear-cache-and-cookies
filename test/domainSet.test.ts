import { describe, it, expect } from 'vitest';
import { isDomainBlocked } from '../src/utils/clearData';

// O(number of dot-labels) suffix lookup against a Set — same exact-or-subdomain
// semantics as domainMatches, but independent of blacklist length.
describe('isDomainBlocked — O(labels) suffix-set membership', () => {
  it('matches exact domain', () => {
    expect(isDomainBlocked('tracker.io', new Set(['tracker.io']))).toBe(true);
  });

  it('matches a subdomain via parent suffix', () => {
    expect(isDomainBlocked('ads.x.tracker.io', new Set(['tracker.io']))).toBe(true);
  });

  it('does not match unrelated substring host', () => {
    expect(isDomainBlocked('mytracker.io', new Set(['tracker.io']))).toBe(false);
  });

  it('does not match suffix-injection host', () => {
    expect(isDomainBlocked('tracker.io.evil.com', new Set(['tracker.io']))).toBe(false);
  });

  it('returns false for empty set', () => {
    expect(isDomainBlocked('tracker.io', new Set())).toBe(false);
  });

  it('returns false for empty domain', () => {
    expect(isDomainBlocked('', new Set(['tracker.io']))).toBe(false);
  });
});
