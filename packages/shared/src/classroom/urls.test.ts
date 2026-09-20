import { describe, expect, it } from 'vitest';
import {
  assignmentDetailUrl,
  classStreamUrl,
  classworkUrl,
  isClassroomUrl,
  parseClassroomUrl,
  toAbsoluteClassroomUrl,
} from './urls.js';

describe('parseClassroomUrl', () => {
  it('recognises the class list home page', () => {
    const parsed = parseClassroomUrl('https://classroom.google.com/h');
    expect(parsed.isClassroom).toBe(true);
    expect(parsed.kind).toBe('home');
    expect(parsed.courseId).toBeNull();
  });

  it('strips the /u/<n> multi-account prefix from the canonical URL', () => {
    const parsed = parseClassroomUrl('https://classroom.google.com/u/2/c/ABC123xyz');
    expect(parsed.canonicalUrl).toBe('https://classroom.google.com/c/ABC123xyz');
    expect(parsed.courseId).toBe('ABC123xyz');
    expect(parsed.kind).toBe('class_stream');
  });

  it('extracts course id from a classwork URL', () => {
    const parsed = parseClassroomUrl('https://classroom.google.com/w/NjE2/t/all');
    expect(parsed.kind).toBe('class_classwork');
    expect(parsed.courseId).toBe('NjE2');
  });

  it('extracts both ids from an assignment detail URL', () => {
    const parsed = parseClassroomUrl(
      'https://classroom.google.com/c/Njk5MjM/a/NTQzMjE/details',
    );
    expect(parsed.kind).toBe('assignment_detail');
    expect(parsed.courseId).toBe('Njk5MjM');
    expect(parsed.courseWorkId).toBe('NTQzMjE');
  });

  it('distinguishes material pages from assignment pages', () => {
    const parsed = parseClassroomUrl(
      'https://classroom.google.com/c/Njk5MjM/m/NTQzMjE/details',
    );
    expect(parsed.kind).toBe('material_detail');
    expect(parsed.courseWorkId).toBe('NTQzMjE');
  });

  it('drops query strings and fragments from the canonical URL', () => {
    const parsed = parseClassroomUrl(
      'https://classroom.google.com/c/ABC123xyz/?hl=en#top',
    );
    expect(parsed.canonicalUrl).toBe('https://classroom.google.com/c/ABC123xyz');
  });

  it('treats two spellings of the same class page as one canonical URL', () => {
    const a = parseClassroomUrl('https://classroom.google.com/u/0/c/ABC123xyz');
    const b = parseClassroomUrl('https://classroom.google.com/c/ABC123xyz/?x=1');
    expect(a.canonicalUrl).toBe(b.canonicalUrl);
  });

  it('rejects non-Classroom hosts', () => {
    expect(parseClassroomUrl('https://evil.example/c/ABC').isClassroom).toBe(false);
    expect(
      parseClassroomUrl('https://classroom.google.com.evil.example/c/ABC').isClassroom,
    ).toBe(false);
  });

  it('never throws on garbage input', () => {
    for (const bad of ['', '   ', 'not a url', null, undefined, 'javascript:x']) {
      expect(() => parseClassroomUrl(bad as string)).not.toThrow();
      expect(parseClassroomUrl(bad as string).isClassroom).toBe(false);
    }
  });
});

describe('toAbsoluteClassroomUrl', () => {
  it('resolves relative Classroom hrefs', () => {
    expect(toAbsoluteClassroomUrl('/c/ABC123xyz')).toBe(
      'https://classroom.google.com/c/ABC123xyz',
    );
  });

  it('refuses non-http(s) schemes', () => {
    expect(toAbsoluteClassroomUrl('javascript:alert(1)')).toBeNull();
    expect(toAbsoluteClassroomUrl('mailto:a@b.c')).toBeNull();
    expect(toAbsoluteClassroomUrl('#')).toBeNull();
    expect(toAbsoluteClassroomUrl('')).toBeNull();
  });
});

describe('canonical URL builders round-trip through the parser', () => {
  it('class stream', () => {
    expect(parseClassroomUrl(classStreamUrl('ABC123xyz')).courseId).toBe('ABC123xyz');
  });
  it('classwork', () => {
    expect(parseClassroomUrl(classworkUrl('ABC123xyz')).courseId).toBe('ABC123xyz');
  });
  it('assignment detail', () => {
    const parsed = parseClassroomUrl(assignmentDetailUrl('ABC123xyz', 'WORK456'));
    expect(parsed.courseId).toBe('ABC123xyz');
    expect(parsed.courseWorkId).toBe('WORK456');
  });
});

describe('isClassroomUrl', () => {
  it('is true only for classroom.google.com', () => {
    expect(isClassroomUrl('https://classroom.google.com/h')).toBe(true);
    expect(isClassroomUrl('https://drive.google.com/file/d/1')).toBe(false);
  });
});

describe('relative reference handling', () => {
  it('accepts root-relative refs but not bare text', () => {
    expect(parseClassroomUrl('/c/ABC123xyz').courseId).toBe('ABC123xyz');
    expect(parseClassroomUrl('not a url').isClassroom).toBe(false);
    expect(parseClassroomUrl('Due Sep 24').isClassroom).toBe(false);
    expect(toAbsoluteClassroomUrl('some link text')).toBeNull();
  });
});
