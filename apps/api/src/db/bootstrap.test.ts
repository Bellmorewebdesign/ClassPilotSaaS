import { describe, expect, it } from 'vitest';
import { hashToken } from './bootstrap.js';

describe('hashToken', () => {
  it('produces a stable SHA-256 hex digest', () => {
    const hash = hashToken('correct-horse-battery-staple');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken('correct-horse-battery-staple')).toBe(hash);
  });

  it('never returns the token itself', () => {
    const token = 'a'.repeat(64);
    expect(hashToken(token)).not.toBe(token);
    expect(hashToken(token)).not.toContain(token);
  });

  it('is sensitive to a single character change', () => {
    expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
  });
});
