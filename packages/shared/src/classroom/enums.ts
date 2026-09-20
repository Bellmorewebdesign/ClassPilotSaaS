/**
 * Closed vocabularies shared by the extension, API and web app.
 *
 * These are intentionally small and additive. When the extractor cannot
 * confidently determine a value it MUST emit the `"unknown"` member rather
 * than guessing — we never fabricate data we did not actually observe.
 */

/** Where a record came from. V1 only has one source. */
export const SYNC_SOURCES = ['google_classroom_browser'] as const;
export type SyncSource = (typeof SYNC_SOURCES)[number];

/**
 * Classroom "Classwork" items come in a handful of flavours. Google surfaces
 * these as distinct icons/labels on the Classwork page.
 */
export const ASSIGNMENT_TYPES = [
  'assignment',
  'quiz',
  'question',
  'material',
  'unknown',
] as const;
export type AssignmentType = (typeof ASSIGNMENT_TYPES)[number];

/**
 * Submission state as displayed to the student. `unknown` is the default —
 * Classroom does not always render a status chip.
 */
export const ASSIGNMENT_STATUSES = [
  'assigned',
  'submitted',
  'returned',
  'missing',
  'unknown',
] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

/**
 * Attachment classification. V1 only records *what* an attachment is and
 * where it lives — we deliberately do not read its contents.
 */
export const ATTACHMENT_TYPES = [
  'google_doc',
  'google_slides',
  'google_sheet',
  'google_form',
  'google_drive_file',
  'pdf',
  'image',
  'video',
  'youtube',
  'link',
  'unknown',
] as const;
export type AttachmentType = (typeof ATTACHMENT_TYPES)[number];

/** Who hosts the attachment. Useful for later deep-ingestion work. */
export const ATTACHMENT_PROVIDERS = [
  'google_drive',
  'google_docs',
  'google_slides',
  'google_sheets',
  'google_forms',
  'youtube',
  'external',
  'unknown',
] as const;
export type AttachmentProvider = (typeof ATTACHMENT_PROVIDERS)[number];

/** Lifecycle of a single sync run. */
export const SYNC_RUN_STATUSES = [
  'running',
  'completed',
  'completed_with_warnings',
  'failed',
] as const;
export type SyncRunStatus = (typeof SYNC_RUN_STATUSES)[number];
