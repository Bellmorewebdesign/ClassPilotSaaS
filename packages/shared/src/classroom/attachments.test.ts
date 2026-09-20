import { describe, expect, it } from 'vitest';
import { classifyAttachment } from './attachments.js';

describe('classifyAttachment', () => {
  it('identifies Google editor files by their docs.google.com path', () => {
    expect(
      classifyAttachment('https://docs.google.com/document/d/1abc/edit'),
    ).toMatchObject({ attachmentType: 'google_doc', provider: 'google_docs' });

    expect(
      classifyAttachment('https://docs.google.com/presentation/d/1abc/edit'),
    ).toMatchObject({ attachmentType: 'google_slides' });

    expect(
      classifyAttachment('https://docs.google.com/spreadsheets/d/1abc/edit'),
    ).toMatchObject({ attachmentType: 'google_sheet' });

    expect(
      classifyAttachment('https://docs.google.com/forms/d/e/1abc/viewform'),
    ).toMatchObject({ attachmentType: 'google_form' });
  });

  it('identifies short Google Form links', () => {
    expect(classifyAttachment('https://forms.gle/abc123')).toMatchObject({
      attachmentType: 'google_form',
    });
  });

  it('uses the filename to refine a Drive link', () => {
    expect(
      classifyAttachment('https://drive.google.com/file/d/1abc/view', 'Syllabus.pdf'),
    ).toMatchObject({
      attachmentType: 'pdf',
      provider: 'google_drive',
      mimeType: 'application/pdf',
    });
  });

  it('falls back to a generic Drive file when the name gives nothing', () => {
    expect(
      classifyAttachment('https://drive.google.com/file/d/1abc/view'),
    ).toMatchObject({ attachmentType: 'google_drive_file', provider: 'google_drive' });
  });

  it('identifies YouTube on both hostnames', () => {
    expect(classifyAttachment('https://youtu.be/abc')).toMatchObject({
      attachmentType: 'youtube',
    });
    expect(
      classifyAttachment('https://www.youtube.com/watch?v=abc'),
    ).toMatchObject({ attachmentType: 'youtube', provider: 'youtube' });
  });

  it('identifies external files by extension', () => {
    expect(
      classifyAttachment('https://school.example/handouts/limits.pdf'),
    ).toMatchObject({ attachmentType: 'pdf', provider: 'external' });

    expect(classifyAttachment('https://school.example/img/diagram.png')).toMatchObject(
      { attachmentType: 'image', mimeType: 'image/png' },
    );
  });

  it('falls back to a plain link for an ordinary web page', () => {
    expect(classifyAttachment('https://en.wikipedia.org/wiki/Limit')).toMatchObject({
      attachmentType: 'link',
      provider: 'external',
      mimeType: null,
    });
  });

  it('returns unknown (not link) when there is no usable URL at all', () => {
    expect(classifyAttachment(null)).toMatchObject({
      attachmentType: 'unknown',
      provider: 'unknown',
    });
    expect(classifyAttachment('not-a-url')).toMatchObject({
      attachmentType: 'unknown',
    });
  });

  it('is not fooled by a lookalike hostname', () => {
    expect(
      classifyAttachment('https://docs.google.com.evil.example/document/d/1'),
    ).toMatchObject({ provider: 'external' });
  });
});
