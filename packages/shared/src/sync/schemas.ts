import { z } from 'zod';
import {
  ASSIGNMENT_STATUSES,
  ASSIGNMENT_TYPES,
  ATTACHMENT_PROVIDERS,
  ATTACHMENT_TYPES,
} from '../classroom/enums.js';
import { LONG_TEXT_MAX, SHORT_TEXT_MAX } from '../normalize/text.js';

/**
 * The wire contract between the extension and the API.
 *
 * This is the ONLY place the payload shape is defined. The extension imports
 * these types to build payloads; the API imports the schemas to validate
 * them. There is no second copy to drift out of sync.
 *
 * Every bound here is a real defence: an extractor bug (or a hostile page)
 * must not be able to push unbounded data into our database.
 */

/** Hard caps so a single request can never be unbounded. */
export const SYNC_LIMITS = {
  maxClassesPerRequest: 200,
  maxAssignmentsPerRequest: 500,
  maxAttachmentsPerAssignment: 50,
  maxWarningsPerRequest: 200,
  maxProvenanceEntries: 60,
} as const;

const shortText = z.string().trim().min(1).max(SHORT_TEXT_MAX);
const longText = z.string().trim().min(1).max(LONG_TEXT_MAX);

/**
 * URLs must be absolute http(s). Zod's `.url()` alone would accept
 * `javascript:alert(1)` in some versions, so the protocol check is explicit.
 */
const httpUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'must be an absolute http(s) URL');

/** Opaque Classroom identifier. Kept as a bounded, charset-restricted token. */
const sourceId = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, 'must be a Classroom id token');

const nullableShortText = shortText.nullable().default(null);
const nullableHttpUrl = httpUrl.nullable().default(null);

export const fieldProvenanceSchema = z.object({
  field: z.string().trim().min(1).max(64),
  strategy: z.string().trim().max(64).nullable().default(null),
  found: z.boolean(),
});

export const extractionReportSchema = z.object({
  extractor: z.string().trim().min(1).max(64),
  version: z.string().trim().min(1).max(32),
  pageUrl: nullableHttpUrl,
  provenance: z
    .array(fieldProvenanceSchema)
    .max(SYNC_LIMITS.maxProvenanceEntries)
    .default([]),
  warnings: z.array(z.string().trim().max(300)).max(50).default([]),
  durationMs: z.number().int().min(0).max(600_000).default(0),
});

export const attachmentCandidateSchema = z.object({
  name: nullableShortText,
  // An attachment without a URL is useless to us, so the URL is required here
  // and the extension drops URL-less chips before sending.
  url: httpUrl,
  mimeType: z.string().trim().max(255).nullable().default(null),
  provider: z.enum(ATTACHMENT_PROVIDERS).default('unknown'),
  attachmentType: z.enum(ATTACHMENT_TYPES).default('unknown'),
});

export const gradeCandidateSchema = z.object({
  raw: z.string().trim().max(64).nullable().default(null),
  earned: z.number().min(0).max(100_000).nullable().default(null),
  possible: z.number().min(0).max(100_000).nullable().default(null),
});

export const classroomClassCandidateSchema = z.object({
  sourceId: sourceId.nullable().default(null),
  canonicalUrl: nullableHttpUrl,
  name: nullableShortText,
  section: nullableShortText,
  teacherName: nullableShortText,
  room: nullableShortText,
  description: longText.nullable().default(null),
  extraction: extractionReportSchema,
});

export const assignmentCandidateSchema = z.object({
  sourceId: sourceId.nullable().default(null),
  canonicalUrl: nullableHttpUrl,
  classSourceId: sourceId.nullable().default(null),
  classCanonicalUrl: nullableHttpUrl,

  title: nullableShortText,
  instructions: longText.nullable().default(null),
  assignmentType: z.enum(ASSIGNMENT_TYPES).default('unknown'),
  topic: nullableShortText,

  dueAtIso: z.iso.datetime({ offset: true }).nullable().default(null),
  dueLabel: nullableShortText,

  pointsPossible: z.number().min(0).max(100_000).nullable().default(null),
  status: z.enum(ASSIGNMENT_STATUSES).default('unknown'),
  grade: gradeCandidateSchema.nullable().default(null),
  attachments: z
    .array(attachmentCandidateSchema)
    .max(SYNC_LIMITS.maxAttachmentsPerAssignment)
    .default([]),

  extraction: extractionReportSchema,
});

export const syncWarningSchema = z.object({
  code: z.string().trim().min(1).max(64),
  message: z.string().trim().min(1).max(300),
  url: nullableHttpUrl,
});

/**
 * A client-generated sync run id. The extension mints one per "Sync Classroom"
 * click and reuses it across every batch of that run, which is what lets the
 * API stitch batches into one SyncRun record.
 */
const syncId = z
  .string()
  .trim()
  .min(8)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'must be a url-safe id');

/** Shared body of every sync request. */
const syncPayloadBase = z.object({
  syncId,
  /** When the extension started this run. Used only for reporting. */
  startedAt: z.iso.datetime({ offset: true }).nullable().default(null),
  classes: z
    .array(classroomClassCandidateSchema)
    .max(SYNC_LIMITS.maxClassesPerRequest)
    .default([]),
  assignments: z
    .array(assignmentCandidateSchema)
    .max(SYNC_LIMITS.maxAssignmentsPerRequest)
    .default([]),
  warnings: z
    .array(syncWarningSchema)
    .max(SYNC_LIMITS.maxWarningsPerRequest)
    .default([]),
  /** Extension version, for diagnosing "which build produced this". */
  clientVersion: z.string().trim().max(32).nullable().default(null),
});

/**
 * POST /api/v1/sync/classroom
 * A complete sync delivered in one request. Implicitly final.
 */
export const syncClassroomRequestSchema = syncPayloadBase;

/**
 * POST /api/v1/sync/classroom/batch
 * One chunk of a longer sync. The run stays open until `final` is true.
 */
export const syncClassroomBatchRequestSchema = syncPayloadBase.extend({
  batchIndex: z.number().int().min(0).max(10_000).default(0),
  final: z.boolean().default(false),
});

export type FieldProvenanceInput = z.input<typeof fieldProvenanceSchema>;
export type ExtractionReportInput = z.input<typeof extractionReportSchema>;
export type AttachmentCandidateInput = z.input<typeof attachmentCandidateSchema>;
export type ClassroomClassCandidateInput = z.input<
  typeof classroomClassCandidateSchema
>;
export type AssignmentCandidateInput = z.input<typeof assignmentCandidateSchema>;
export type SyncClassroomRequest = z.input<typeof syncClassroomRequestSchema>;
export type SyncClassroomBatchRequest = z.input<
  typeof syncClassroomBatchRequestSchema
>;

export type ParsedSyncClassroomRequest = z.output<
  typeof syncClassroomRequestSchema
>;
export type ParsedSyncClassroomBatchRequest = z.output<
  typeof syncClassroomBatchRequestSchema
>;
export type ParsedClassCandidate = z.output<typeof classroomClassCandidateSchema>;
export type ParsedAssignmentCandidate = z.output<
  typeof assignmentCandidateSchema
>;
