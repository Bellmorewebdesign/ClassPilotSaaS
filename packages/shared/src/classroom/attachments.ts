import type { AttachmentProvider, AttachmentType } from './enums.js';

/**
 * Attachment classification from URL + filename.
 *
 * V1 records what an attachment IS and WHERE it lives. It never opens it.
 * Classification is URL-first because Google's attachment URLs are far more
 * stable than the chips Classroom renders around them.
 */

export interface AttachmentClassification {
  attachmentType: AttachmentType;
  provider: AttachmentProvider;
  /** Best-effort MIME type. Null unless we can say so from the URL/extension. */
  mimeType: string | null;
}

const EXTENSION_MIME: Record<string, { type: AttachmentType; mime: string }> = {
  pdf: { type: 'pdf', mime: 'application/pdf' },
  png: { type: 'image', mime: 'image/png' },
  jpg: { type: 'image', mime: 'image/jpeg' },
  jpeg: { type: 'image', mime: 'image/jpeg' },
  gif: { type: 'image', mime: 'image/gif' },
  webp: { type: 'image', mime: 'image/webp' },
  svg: { type: 'image', mime: 'image/svg+xml' },
  mp4: { type: 'video', mime: 'video/mp4' },
  mov: { type: 'video', mime: 'video/quicktime' },
  doc: { type: 'unknown', mime: 'application/msword' },
  docx: {
    type: 'unknown',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  ppt: { type: 'unknown', mime: 'application/vnd.ms-powerpoint' },
  pptx: {
    type: 'unknown',
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  },
  xls: { type: 'unknown', mime: 'application/vnd.ms-excel' },
  xlsx: {
    type: 'unknown',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
};

/**
 * Classify an attachment. Falls back to `unknown`/`external` rather than
 * guessing, which keeps "we don't know" distinguishable from "it's a link".
 */
export function classifyAttachment(
  url: string | null | undefined,
  name?: string | null,
): AttachmentClassification {
  const unknown: AttachmentClassification = {
    attachmentType: 'unknown',
    provider: 'unknown',
    mimeType: null,
  };

  if (typeof url !== 'string' || url.trim() === '') {
    return unknown;
  }

  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return unknown;
  }

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();

  // --- Google first-party editors -------------------------------------
  if (host === 'docs.google.com') {
    if (path.startsWith('/document')) {
      return {
        attachmentType: 'google_doc',
        provider: 'google_docs',
        mimeType: 'application/vnd.google-apps.document',
      };
    }
    if (path.startsWith('/presentation')) {
      return {
        attachmentType: 'google_slides',
        provider: 'google_slides',
        mimeType: 'application/vnd.google-apps.presentation',
      };
    }
    if (path.startsWith('/spreadsheets')) {
      return {
        attachmentType: 'google_sheet',
        provider: 'google_sheets',
        mimeType: 'application/vnd.google-apps.spreadsheet',
      };
    }
    if (path.startsWith('/forms')) {
      return {
        attachmentType: 'google_form',
        provider: 'google_forms',
        mimeType: 'application/vnd.google-apps.form',
      };
    }
    // docs.google.com/file/... and other editor surfaces.
    return {
      attachmentType: 'google_drive_file',
      provider: 'google_drive',
      mimeType: null,
    };
  }

  if (host === 'forms.gle') {
    return {
      attachmentType: 'google_form',
      provider: 'google_forms',
      mimeType: 'application/vnd.google-apps.form',
    };
  }

  // --- Google Drive ----------------------------------------------------
  if (host === 'drive.google.com') {
    // A Drive link can still be a PDF; the filename is our only hint.
    const byName = classifyByFilename(name);
    return {
      attachmentType: byName?.type ?? 'google_drive_file',
      provider: 'google_drive',
      mimeType: byName?.mime ?? null,
    };
  }

  // --- YouTube ---------------------------------------------------------
  if (
    host === 'youtu.be' ||
    host === 'youtube.com' ||
    host.endsWith('.youtube.com')
  ) {
    return { attachmentType: 'youtube', provider: 'youtube', mimeType: null };
  }

  // --- Anything else: fall back to the file extension, then "link" -----
  const byExtension = classifyByPath(path) ?? classifyByFilename(name);
  if (byExtension) {
    return {
      attachmentType: byExtension.type === 'unknown' ? 'link' : byExtension.type,
      provider: 'external',
      mimeType: byExtension.mime,
    };
  }

  return { attachmentType: 'link', provider: 'external', mimeType: null };
}

function classifyByPath(
  pathname: string,
): { type: AttachmentType; mime: string } | null {
  const match = /\.([a-z0-9]{1,5})$/.exec(pathname);
  const ext = match?.[1];
  return ext ? (EXTENSION_MIME[ext] ?? null) : null;
}

function classifyByFilename(
  name: string | null | undefined,
): { type: AttachmentType; mime: string } | null {
  if (typeof name !== 'string') return null;
  const match = /\.([a-zA-Z0-9]{1,5})\s*$/.exec(name.trim());
  const ext = match?.[1]?.toLowerCase();
  return ext ? (EXTENSION_MIME[ext] ?? null) : null;
}
