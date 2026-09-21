/**
 * Display formatting.
 *
 * The rule throughout: a value we never captured shows as a clear placeholder
 * ("Not shown in Classroom"), never as a blank or a zero. The dashboard should
 * make it obvious what ClassPilot could and could not read.
 */

export function formatDateTime(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}

/** "in 3 days", "2 hours ago". Returns null when there is no timestamp. */
export function formatRelative(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const diffMs = date.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (abs < hour) return formatter.format(Math.round(diffMs / minute), 'minute');
  if (abs < day) return formatter.format(Math.round(diffMs / hour), 'hour');
  if (abs < 30 * day) return formatter.format(Math.round(diffMs / day), 'day');
  return formatter.format(Math.round(diffMs / (30 * day)), 'month');
}

/** True when a due date is in the past. */
export function isOverdue(iso: string | null): boolean {
  if (!iso) return false;
  const date = new Date(iso);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

/** True when a due date falls within the next seven days. */
export function isDueSoon(iso: string | null): boolean {
  if (!iso) return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  const diff = date.getTime() - Date.now();
  return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
}

const STATUS_LABELS: Record<string, string> = {
  assigned: 'Assigned',
  submitted: 'Turned in',
  returned: 'Returned',
  missing: 'Missing',
  unknown: 'Status not shown',
};

export function formatStatus(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

const TYPE_LABELS: Record<string, string> = {
  assignment: 'Assignment',
  quiz: 'Quiz',
  question: 'Question',
  material: 'Material',
  unknown: 'Classwork',
};

export function formatType(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

const ATTACHMENT_LABELS: Record<string, string> = {
  google_doc: 'Google Doc',
  google_slides: 'Google Slides',
  google_sheet: 'Google Sheet',
  google_form: 'Google Form',
  google_drive_file: 'Drive file',
  pdf: 'PDF',
  image: 'Image',
  video: 'Video',
  youtube: 'YouTube',
  link: 'Link',
  unknown: 'Attachment',
};

export function formatAttachmentType(type: string): string {
  return ATTACHMENT_LABELS[type] ?? type;
}

/** Placeholder for a value Classroom did not show us. */
export const NOT_CAPTURED = 'Not shown in Classroom';
