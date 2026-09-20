import { describe, expect, it } from 'vitest';
import { assignmentHashInput, classHashInput, stableStringify } from './hash.js';

describe('stableStringify', () => {
  it('is key-order independent', () => {
    expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }));
  });

  it('treats undefined and null identically', () => {
    expect(stableStringify({ a: undefined })).toBe('{}');
    expect(stableStringify(undefined)).toBe('null');
  });

  it('preserves array order (attachment order is meaningful)', () => {
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });

  it('serializes dates as ISO instants', () => {
    expect(stableStringify(new Date('2026-09-24T23:59:00.000Z'))).toBe(
      '"2026-09-24T23:59:00.000Z"',
    );
  });

  it('does not emit NaN/Infinity, which are not valid JSON', () => {
    expect(stableStringify({ n: Number.NaN })).toBe('{"n":null}');
    expect(stableStringify({ n: Number.POSITIVE_INFINITY })).toBe('{"n":null}');
  });
});

const base = {
  title: 'Limits Worksheet',
  instructions: 'Complete problems 1-20.',
  assignmentType: 'assignment',
  topic: 'Unit 1',
  dueAt: new Date('2026-09-24T23:59:00.000Z'),
  pointsPossible: 100,
  status: 'assigned',
  grade: null,
  attachments: [
    { name: 'Worksheet.pdf', url: 'https://drive.google.com/file/d/1/view', attachmentType: 'pdf' },
  ],
};

describe('assignmentHashInput', () => {
  it('is stable across identical inputs', () => {
    expect(assignmentHashInput({ ...base })).toBe(assignmentHashInput({ ...base }));
  });

  it('accepts a Date or its ISO string interchangeably', () => {
    expect(assignmentHashInput({ ...base, dueAt: base.dueAt.toISOString() })).toBe(
      assignmentHashInput(base),
    );
  });

  it('changes when a meaningful field changes', () => {
    const original = assignmentHashInput(base);
    expect(assignmentHashInput({ ...base, title: 'Limits Worksheet v2' })).not.toBe(original);
    expect(assignmentHashInput({ ...base, pointsPossible: 50 })).not.toBe(original);
    expect(assignmentHashInput({ ...base, status: 'submitted' })).not.toBe(original);
    expect(
      assignmentHashInput({ ...base, dueAt: new Date('2026-09-25T23:59:00.000Z') }),
    ).not.toBe(original);
    expect(assignmentHashInput({ ...base, attachments: [] })).not.toBe(original);
  });

  it('ignores fields that are not part of the projection', () => {
    const withNoise = { ...base, lastSeenAt: new Date(), syncId: 'abc' } as never;
    expect(assignmentHashInput(withNoise)).toBe(assignmentHashInput(base));
  });
});

describe('classHashInput', () => {
  const klass = {
    name: 'AP Calculus AB',
    section: 'Period 3',
    teacherName: 'Mr. Rivera',
    room: '204',
    description: null,
  };

  it('is stable and change-sensitive', () => {
    expect(classHashInput(klass)).toBe(classHashInput({ ...klass }));
    expect(classHashInput({ ...klass, room: '205' })).not.toBe(classHashInput(klass));
  });
});
