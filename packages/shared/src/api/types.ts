import type {
  AssignmentStatus,
  AssignmentType,
  AttachmentProvider,
  AttachmentType,
  SyncRunStatus,
  SyncSource,
} from '../classroom/enums.js';

/**
 * DTOs the API returns and the web app consumes.
 *
 * All timestamps cross the wire as ISO-8601 strings; Mongo ObjectIds cross as
 * hex strings. The web app never imports Mongoose types.
 */

export interface AttachmentDto {
  name: string | null;
  url: string;
  mimeType: string | null;
  provider: AttachmentProvider;
  attachmentType: AttachmentType;
}

export interface ClassDto {
  id: string;
  source: SyncSource;
  sourceId: string | null;
  canonicalUrl: string | null;
  name: string;
  section: string | null;
  teacherName: string | null;
  room: string | null;
  description: string | null;
  assignmentCount: number;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentDto {
  id: string;
  classId: string;
  /** Denormalized for list views so the web app avoids an N+1 fetch. */
  className: string | null;
  source: SyncSource;
  sourceId: string | null;
  canonicalUrl: string | null;
  title: string;
  instructions: string | null;
  assignmentType: AssignmentType;
  topic: string | null;
  dueAt: string | null;
  dueLabel: string | null;
  pointsPossible: number | null;
  status: AssignmentStatus;
  grade: { raw: string | null; earned: number | null; possible: number | null } | null;
  attachments: AttachmentDto[];
  firstSeenAt: string;
  lastSeenAt: string;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncRunDto {
  id: string;
  syncId: string;
  status: SyncRunStatus;
  startedAt: string;
  finishedAt: string | null;
  classesSeen: number;
  assignmentsSeen: number;
  classesCreated: number;
  classesUpdated: number;
  assignmentsCreated: number;
  assignmentsUpdated: number;
  assignmentsUnchanged: number;
  warnings: Array<{ code: string; message: string; url: string | null }>;
  clientVersion: string | null;
}

/** Response of POST /api/v1/sync/classroom and .../batch. */
export interface SyncResultDto {
  syncId: string;
  status: SyncRunStatus;
  classesCreated: number;
  classesUpdated: number;
  assignmentsCreated: number;
  assignmentsUpdated: number;
  assignmentsUnchanged: number;
  /** Items the API refused to store, with the reason. Never fatal. */
  rejected: Array<{ kind: 'class' | 'assignment'; reason: string; url: string | null }>;
  totals: { classes: number; assignments: number };
}

/** Response of GET /api/v1/sync/status. */
export interface SyncStatusDto {
  lastSync: SyncRunDto | null;
  activeSync: SyncRunDto | null;
  totals: { classes: number; assignments: number };
}

/** Response of GET /api/v1/me — who the bearer token resolved to. */
export interface MeDto {
  id: string;
  email: string;
  displayName: string | null;
  authMode: 'dev' | 'production';
}

/** Uniform error envelope. Every non-2xx response has this shape. */
export interface ApiErrorDto {
  error: {
    code: string;
    message: string;
    /** Field-level validation detail, present on 400s. */
    details?: Array<{ path: string; message: string }>;
  };
}

export interface PaginatedDto<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
