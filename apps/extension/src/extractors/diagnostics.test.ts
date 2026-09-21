import { describe, expect, it } from 'vitest';
import { loadFixture } from '../__tests__/helpers/loadFixture.js';
import { captureStructure } from './diagnostics.js';

const ASSIGNMENT_URL =
  'https://classroom.google.com/c/Njk5MjMxMjM/a/NTQzMjE5OA/details';
const HOME_URL = 'https://classroom.google.com/h';

/** Content that must never appear in a diagnostic report. */
const PRIVATE_STRINGS = [
  'Limits Worksheet',
  'Complete problems 1 through 20',
  'Unit 1: Limits',
  'AP Calculus AB',
  'Miguel Rivera',
  'Dana Okafor',
  'Limits Review Slides',
];

describe('captureStructure privacy guarantee', () => {
  it('leaks no page content by default', () => {
    const context = loadFixture('assignment-page.html', ASSIGNMENT_URL);
    const serialized = JSON.stringify(
      captureStructure(context.document, context.url),
    );

    for (const secret of PRIVATE_STRINGS) {
      expect(serialized).not.toContain(secret);
    }
  });

  it('leaks no class or teacher names from the home page', () => {
    const context = loadFixture('classroom-home.html', HOME_URL);
    const serialized = JSON.stringify(
      captureStructure(context.document, context.url),
    );

    for (const secret of PRIVATE_STRINGS) {
      expect(serialized).not.toContain(secret);
    }
  });

  it('reduces Classroom URLs to their grammar, discarding the ids', () => {
    const context = loadFixture('classwork-page.html', HOME_URL);
    const report = captureStructure(context.document, context.url);
    const patterns = report.linkPatterns.map((entry) => entry.pattern);

    expect(patterns).toContain(
      'classroom.google.com/c/<courseId>/a/<workId>/details',
    );
    expect(JSON.stringify(report.linkPatterns)).not.toContain('NTQzMjE5OA');
  });

  it('reports third-party links by host only, never by path', () => {
    const context = loadFixture('assignment-page.html', ASSIGNMENT_URL);
    const report = captureStructure(context.document, context.url);
    const patterns = report.linkPatterns.map((entry) => entry.pattern);

    expect(patterns).toContain('drive.google.com');
    expect(JSON.stringify(report.linkPatterns)).not.toContain('1abcdefg');
  });

  it('reports heading and text-block sizes instead of their text', () => {
    const context = loadFixture('assignment-page.html', ASSIGNMENT_URL);
    const report = captureStructure(context.document, context.url);

    // Derived rather than hardcoded, so the assertion tracks the fixture.
    const h1Text = context.document.querySelector('h1')!.textContent!.trim();
    expect(report.headings[0]).toMatchObject({
      level: 'h1',
      textLength: h1Text.length,
    });
    expect(h1Text.length).toBeGreaterThan(0);
    expect(report.textBlocks[0]?.length).toBeGreaterThan(50);
    expect(report.textBlocks[0]?.sample).toBeNull();
  });

  it('only reports aria-labels that are generic UI words', () => {
    const context = loadFixture('assignment-page.html', ASSIGNMENT_URL);
    const report = captureStructure(context.document, context.url);
    const labels = report.ariaLabels
      .map((entry) => entry.label)
      .filter((label): label is string => label !== null);

    // "Attachments" is generic UI; the assignment title is not.
    expect(labels.every((label) => !PRIVATE_STRINGS.includes(label))).toBe(true);
    // Content-bearing labels still contribute their length, so we can see
    // that a label exists without reading it.
    expect(report.ariaLabels.some((entry) => entry.label === null)).toBe(true);
  });

  it('tells us which extraction strategies would currently match', () => {
    const context = loadFixture('assignment-page.html', ASSIGNMENT_URL);
    const report = captureStructure(context.document, context.url);
    const byStrategy = new Map(
      report.strategyProbes.map((probe) => [probe.strategy, probe]),
    );

    expect(byStrategy.get('assignmentPage:main-first-heading')?.wouldMatch).toBe(true);
    expect(byStrategy.get('assignmentPage:aria-label-due')?.wouldMatch).toBe(true);
    expect(byStrategy.get('assignmentPage:text-n-points')?.wouldMatch).toBe(true);
    expect(byStrategy.get('assignmentPage:attachments')?.wouldMatch).toBe(true);
    expect(byStrategy.get('dom:main-landmark')?.wouldMatch).toBe(true);
  });

  it('reports a strategy that does NOT match, which is how we spot a break', () => {
    const context = loadFixture('classroom-signed-out.html', HOME_URL);
    const report = captureStructure(context.document, context.url);
    const byStrategy = new Map(
      report.strategyProbes.map((probe) => [probe.strategy, probe]),
    );

    expect(byStrategy.get('classroomHome:url-class-anchors')?.wouldMatch).toBe(false);
    expect(byStrategy.get('classroomHome:url-class-anchors')?.detail).toContain('0 anchors');
  });

  it('includes text only when a developer explicitly opts in', () => {
    const context = loadFixture('assignment-page.html', ASSIGNMENT_URL);
    const report = captureStructure(context.document, context.url, {
      includeText: true,
    });
    expect(report.textBlocks.some((block) => block.sample !== null)).toBe(true);
  });
});
