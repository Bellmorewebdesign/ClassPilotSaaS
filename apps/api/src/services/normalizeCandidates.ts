import { createHash } from 'node:crypto';
import {
  ASSIGNMENT_STATUSES,
  ASSIGNMENT_TYPES,
  ATTACHMENT_PROVIDERS,
  ATTACHMENT_TYPES,
  assignmentHashInput,
  classHashInput,
  classifyAttachment,
  normalizeEnum,
  normalizeIsoDate,
  normalizeLongText,
  normalizePoints,
  normalizeText,
  normalizeUrl,
  parseClassroomUrl,
  parseDueLabel,
  type ParsedAssignmentCandidate,
  type ParsedClassCandidate,
} from '@classpilot/shared';
import type {
  AssignmentAttachmentAttrs,
  AssignmentGradeAttrs,
} from '../models/index.js';

/**
 * Turning extension output into trusted, storable records.
 *
 * Zod has already checked the *shape* of the payload by the time we get here.
 * This layer does the second half of "never trust extension data blindly": it
 * re-normalizes every value, re-derives everything it can from the URL rather
 * than believing the extractor, and drops anything it cannot vouch for.
 *
 * A normalization failure is never fatal — the record is rejected with a
 * reason, and the rest of the sync continues.
 */

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export interface NormalizedClass {
  sourceId: string | null;
  canonicalUrl: string | null;
  name: string;
  section: string | null;
  teacherName: string | null;
  room: string | null;
  description: string | null;
  contentHash: string;
}

export interface NormalizedAssignment {
  sourceId: string | null;
  canonicalUrl: string | null;
  classSourceId: string | null;
  classCanonicalUrl: string | null;
  title: string;
  instructions: string | null;
  assignmentType: (typeof ASSIGNMENT_TYPES)[number];
  topic: string | null;
  dueAt: Date | null;
  dueLabel: string | null;
  pointsPossible: number | null;
  status: (typeof ASSIGNMENT_STATUSES)[number];
  grade: AssignmentGradeAttrs | null;
  attachments: AssignmentAttachmentAttrs[];
  contentHash: string;
}

export type NormalizeResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string; url: string | null };

/**
 * Normalize a class candidate.
 * Rejects only when there is no name at all — a class we cannot label is not
 * something we can usefully show the student.
 */
export function normalizeClassCandidate(
  candidate: ParsedClassCandidate,
): NormalizeResult<NormalizedClass> {
  const canonicalUrl = normalizeUrl(candidate.canonicalUrl);
  const parsedUrl = parseClassroomUrl(canonicalUrl);

  // Prefer the id we can derive ourselves over the one we were handed.
  const sourceId = parsedUrl.courseId ?? normalizeText(candidate.sourceId, 128);

  const name = normalizeText(candidate.name);
  if (!name) {
    return { ok: false, reason: 'class_missing_name', url: canonicalUrl };
  }

  const value: NormalizedClass = {
    sourceId,
    canonicalUrl: parsedUrl.canonicalUrl ?? canonicalUrl,
    name,
    section: normalizeText(candidate.section),
    teacherName: normalizeText(candidate.teacherName),
    room: normalizeText(candidate.room),
    description: normalizeLongText(candidate.description),
    contentHash: '',
  };

  value.contentHash = sha256(classHashInput(value));
  return { ok: true, value };
}

/**
 * Normalize an assignment candidate.
 *
 * Due-date handling: an ISO instant from the extension is preferred, but it
 * is re-validated. When it is absent or implausible we fall back to parsing
 * the raw label server-side. If neither works we store `null` and keep the
 * label, so nothing is fabricated and a human can still see what we read.
 */
export function normalizeAssignmentCandidate(
  candidate: ParsedAssignmentCandidate,
  now: Date = new Date(),
): NormalizeResult<NormalizedAssignment> {
  const canonicalUrl = normalizeUrl(candidate.canonicalUrl);
  const parsedUrl = parseClassroomUrl(canonicalUrl);

  const title = normalizeText(candidate.title);
  if (!title) {
    return { ok: false, reason: 'assignment_missing_title', url: canonicalUrl };
  }

  const classCanonicalUrl = normalizeUrl(candidate.classCanonicalUrl);
  const dueLabel = normalizeText(candidate.dueLabel);

  let dueAt = normalizeIsoDate(candidate.dueAtIso, now);
  if (!dueAt && dueLabel) {
    dueAt = parseDueLabel(dueLabel, now).dueAt;
  }

  const value: NormalizedAssignment = {
    sourceId: parsedUrl.courseWorkId ?? normalizeText(candidate.sourceId, 128),
    canonicalUrl: parsedUrl.canonicalUrl ?? canonicalUrl,
    classSourceId:
      parsedUrl.courseId ??
      parseClassroomUrl(classCanonicalUrl).courseId ??
      normalizeText(candidate.classSourceId, 128),
    classCanonicalUrl,
    title,
    instructions: normalizeLongText(candidate.instructions),
    assignmentType: normalizeEnum(candidate.assignmentType, ASSIGNMENT_TYPES, 'unknown'),
    topic: normalizeText(candidate.topic),
    dueAt,
    dueLabel,
    pointsPossible: normalizePoints(candidate.pointsPossible),
    status: normalizeEnum(candidate.status, ASSIGNMENT_STATUSES, 'unknown'),
    grade: normalizeGrade(candidate.grade),
    attachments: normalizeAttachments(candidate.attachments),
    contentHash: '',
  };

  value.contentHash = sha256(assignmentHashInput(value));
  return { ok: true, value };
}

function normalizeGrade(
  grade: ParsedAssignmentCandidate['grade'],
): AssignmentGradeAttrs | null {
  if (!grade) return null;
  const raw = normalizeText(grade.raw, 64);
  const earned = normalizePoints(grade.earned);
  const possible = normalizePoints(grade.possible);
  // A grade object with nothing in it is the same as no grade.
  if (raw === null && earned === null && possible === null) return null;
  return { raw, earned, possible };
}

/**
 * Normalize attachments.
 *
 * The classification the extension sent is treated as a hint only — we
 * re-classify from the URL, which is the signal we actually trust. Duplicate
 * URLs are collapsed so a re-render of the same chip cannot inflate the list.
 */
function normalizeAttachments(
  attachments: ParsedAssignmentCandidate['attachments'],
): AssignmentAttachmentAttrs[] {
  const seen = new Set<string>();
  const output: AssignmentAttachmentAttrs[] = [];

  for (const attachment of attachments) {
    const url = normalizeUrl(attachment.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);

    const name = normalizeText(attachment.name);
    const classified = classifyAttachment(url, name);

    output.push({
      name,
      url,
      // Trust our own classifier's MIME type; fall back to the client's hint.
      mimeType: classified.mimeType ?? normalizeText(attachment.mimeType, 255),
      provider:
        classified.provider !== 'unknown'
          ? classified.provider
          : normalizeEnum(attachment.provider, ATTACHMENT_PROVIDERS, 'unknown'),
      attachmentType:
        classified.attachmentType !== 'unknown'
          ? classified.attachmentType
          : normalizeEnum(attachment.attachmentType, ATTACHMENT_TYPES, 'unknown'),
    });
  }

  return output;
}
