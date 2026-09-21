import { describe, expect, it } from 'vitest';
import { DEFAULT_API_URL, normalizeApiUrl, redactToken } from './settings.js';

describe('normalizeApiUrl', () => {
  it('keeps scheme, host and port', () => {
    expect(normalizeApiUrl('http://localhost:4000')).toBe('http://localhost:4000');
    expect(normalizeApiUrl('https://api.classpilot.example')).toBe(
      'https://api.classpilot.example',
    );
  });

  it('strips path, query, fragment and trailing slash', () => {
    expect(normalizeApiUrl('http://localhost:4000/')).toBe('http://localhost:4000');
    expect(normalizeApiUrl('http://localhost:4000/api/v1?x=1#y')).toBe(
      'http://localhost:4000',
    );
  });

  it('tolerates surrounding whitespace from a paste', () => {
    expect(normalizeApiUrl('  http://localhost:4000  ')).toBe('http://localhost:4000');
  });

  it('rejects anything that is not absolute http(s)', () => {
    expect(normalizeApiUrl('localhost:4000')).toBeNull();
    expect(normalizeApiUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeApiUrl('file:///etc/passwd')).toBeNull();
    expect(normalizeApiUrl('')).toBeNull();
    expect(normalizeApiUrl(null)).toBeNull();
  });

  it('is idempotent', () => {
    const once = normalizeApiUrl('http://localhost:4000/api/');
    expect(normalizeApiUrl(once)).toBe(once);
  });

  it('has a localhost default that is only a default, not a hardcoded endpoint', () => {
    expect(DEFAULT_API_URL).toBe('http://localhost:4000');
    expect(normalizeApiUrl('https://api.classpilot.example')).not.toBe(DEFAULT_API_URL);
  });
});

describe('redactToken', () => {
  it('shows only the last four characters', () => {
    expect(redactToken('abcdef123456')).toBe('****3456');
  });

  it('never reveals a short token', () => {
    expect(redactToken('abcd')).toBe('****');
    expect(redactToken('a')).toBe('****');
  });

  it('says so plainly when nothing is set', () => {
    expect(redactToken('')).toBe('not set');
  });

  it('never returns the token itself', () => {
    const token = 'x'.repeat(64);
    expect(redactToken(token)).not.toBe(token);
    expect(redactToken(token).length).toBeLessThan(token.length);
  });
});
