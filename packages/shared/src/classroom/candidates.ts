import type {
  AssignmentStatus,
  AssignmentType,
  AttachmentProvider,
  AttachmentType,
} from './enums.js';

/**
 * "Candidate" types are what the *extension's extractors* produce.
 *
 * They are deliberately permissive — every field except the extraction report
 * is nullable, because a Classroom page may simply not show a given value and
 * we never fabricate one. The API's Zod layer is what turns a candidate into
 * a trusted, stored record.
 */

/** Which named strategy inside an extractor produced a field. */
export interface FieldProvenance {
  field: string;
  /** Name of the strategy that won, or null when every strategy missed. */
  strategy: string | null;
  found: boolean;
}

/**
 * Structured debugging output. This is what makes a DOM-scraping project
 * maintainable: when Google changes their markup we can see exactly which
 * strategy stopped matching without anyone pasting private schoolwork around.
 *
 * It contains NO assignment content — only names of things.
 */
export interface ExtractionReport {
  /** e.g. "classroomHome", "classworkPage", "assignmentPage". */
  extractor: string;
  /** Schema version of the extractor, bumped when selectors change. */
  version: string;
  /** The canonical page URL the extractor ran against. */
  pageUrl: string | null;
  /** Field-by-field record of which strategy won. */
  provenance: FieldProvenance[];
  /** Non-fatal problems, phrased without quoting page content. */
  warnings: string[];
  /** Wall-clock milliseconds the extractor took. */
  durationMs: number;
}

export interface AttachmentCandidate {
  /** Display name of the attachment as Classroom labelled it. */
  name: string | null;
  /**
   * Absolute URL. Non-nullable on purpose: an attachment we cannot link to is
   * useless, so extractors drop a chip whose href does not resolve rather
   * than emitting one with a null URL. This matches the wire schema, where
   * `url` is the one required field on an attachment.
   */
  url: string;
  mimeType: string | null;
  provider: AttachmentProvider;
  attachmentType: AttachmentType;
}

export interface GradeCandidate {
  /** The grade exactly as rendered, e.g. "92/100". */
  raw: string | null;
  earned: number | null;
  possible: number | null;
}

export interface ClassroomClassCandidate {
  /** Opaque Classroom course id parsed out of the URL. Our idempotency key. */
  sourceId: string | null;
  /** Canonical class URL (https://classroom.google.com/c/<id>). */
  canonicalUrl: string | null;
  name: string | null;
  section: string | null;
  teacherName: string | null;
  room: string | null;
  description: string | null;
  extraction: ExtractionReport;
}

export interface AssignmentCandidate {
  /** Opaque Classroom coursework id parsed out of the URL. */
  sourceId: string | null;
  /** Canonical assignment URL. */
  canonicalUrl: string | null;
  /** Course id this item belongs to — links it to a ClassroomClassCandidate. */
  classSourceId: string | null;
  classCanonicalUrl: string | null;

  title: string | null;
  instructions: string | null;
  assignmentType: AssignmentType;
  topic: string | null;

  /** ISO-8601 instant, when the extractor could resolve one confidently. */
  dueAtIso: string | null;
  /** The literal due text we read, for auditing what the parser saw. */
  dueLabel: string | null;

  pointsPossible: number | null;
  status: AssignmentStatus;
  grade: GradeCandidate | null;
  attachments: AttachmentCandidate[];

  extraction: ExtractionReport;
}

/** A non-fatal problem during a sync, safe to display to the user. */
export interface SyncWarning {
  /** Machine-readable reason, e.g. "assignment_page_timeout". */
  code: string;
  /** Short human sentence. Must not contain schoolwork content. */
  message: string;
  /** Classroom URL the problem happened on, when known. */
  url: string | null;
}
