import { describe, expect, it } from 'vitest';
import {
  LONG_TEXT_MAX,
  SHORT_TEXT_MAX,
  normalizeEnum,
  normalizeLongText,
  normalizePoints,
  normalizeText,
  normalizeUrl,
} from './text.js';

describe('normalizeText', () => {
  it('collapses runs of whitespace', () => {
    expect(normalizeText('  AP   Calculus \t AB  ')).toBe('AP Calculus AB');
  });

  it('strips zero-width characters Classroom sometimes emits', () => {
    expect(normalizeText('Unit​ 3﻿')).toBe('Unit 3');
  });

  it('converts non-breaking spaces to ordinary spaces', () => {
    expect(normalizeText('Due Friday')).toBe('Due Friday');
  });

  it('keeps paragraph breaks but collapses excessive ones', () => {
    expect(normalizeText('a\n\n\n\nb', LONG_TEXT_MAX)).toBe('a\n\nb');
  });

  it('returns null for values that normalize to empty', () => {
    expect(normalizeText('   ')).toBeNull();
    expect(normalizeText('​')).toBeNull();
    expect(normalizeText(null)).toBeNull();
    expect(normalizeText(42)).toBeNull();
    expect(normalizeText({})).toBeNull();
  });

  it('truncates to the short-field budget', () => {
    const long = 'x'.repeat(SHORT_TEXT_MAX + 100);
    expect(normalizeText(long)?.length).toBe(SHORT_TEXT_MAX);
  });

  it('is idempotent — running it twice changes nothing', () => {
    const once = normalizeText('  Hello   world  ');
    expect(normalizeText(once)).toBe(once);
  });
});

describe('normalizeLongText', () => {
  it('allows far more characters than a short field', () => {
    const text = 'y'.repeat(SHORT_TEXT_MAX + 50);
    expect(normalizeLongText(text)?.length).toBe(SHORT_TEXT_MAX + 50);
  });

  it('still truncates at the long budget', () => {
    expect(normalizeLongText('z'.repeat(LONG_TEXT_MAX + 10))?.length).toBe(
      LONG_TEXT_MAX,
    );
  });
});

describe('normalizeUrl', () => {
  it('accepts absolute http(s) URLs', () => {
    expect(normalizeUrl('https://docs.google.com/document/d/1/edit')).toBe(
      'https://docs.google.com/document/d/1/edit',
    );
  });

  it('rejects dangerous schemes so they can never reach an href', () => {
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeUrl('data:text/html,<script>')).toBeNull();
    expect(normalizeUrl('file:///etc/passwd')).toBeNull();
  });

  it('rejects relative URLs and junk', () => {
    expect(normalizeUrl('/c/ABC')).toBeNull();
    expect(normalizeUrl('')).toBeNull();
    expect(normalizeUrl(undefined)).toBeNull();
  });

  it('rejects absurdly long URLs', () => {
    expect(normalizeUrl(`https://e.com/${'a'.repeat(3000)}`)).toBeNull();
  });
});

describe('normalizePoints', () => {
  it('reads a bare number', () => {
    expect(normalizePoints(100)).toBe(100);
  });

  it('reads points out of Classroom-style labels', () => {
    expect(normalizePoints('100 points')).toBe(100);
    expect(normalizePoints('/50')).toBe(50);
    expect(normalizePoints('12.5 pts')).toBe(12.5);
  });

  it('returns null for ungraded / missing / nonsense', () => {
    expect(normalizePoints('Ungraded')).toBeNull();
    expect(normalizePoints(null)).toBeNull();
    expect(normalizePoints(-5)).toBeNull();
    expect(normalizePoints(1e9)).toBeNull();
    expect(normalizePoints(Number.NaN)).toBeNull();
  });
});

describe('normalizeEnum', () => {
  const allowed = ['assignment', 'quiz', 'unknown'] as const;

  it('matches case-insensitively and normalizes separators', () => {
    expect(normalizeEnum('Assignment', allowed, 'unknown')).toBe('assignment');
    expect(normalizeEnum('  QUIZ ', allowed, 'unknown')).toBe('quiz');
  });

  it('falls back rather than inventing a member', () => {
    expect(normalizeEnum('exam', allowed, 'unknown')).toBe('unknown');
    expect(normalizeEnum(null, allowed, 'unknown')).toBe('unknown');
    expect(normalizeEnum({ toString: () => 'quiz' }, allowed, 'unknown')).toBe(
      'unknown',
    );
  });
});
