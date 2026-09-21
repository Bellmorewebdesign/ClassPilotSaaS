/**
 * Extension settings, persisted in chrome.storage.local.
 *
 * The API token lives here and NOWHERE else. It is never compiled into the
 * extension bundle, never logged, and never sent anywhere except as a Bearer
 * header to the configured API origin.
 *
 * chrome.storage.local is per-profile and not synced to the user's Google
 * account, which is what we want for a credential.
 */

export interface Settings {
  /** Base URL of the ClassPilot API, e.g. http://localhost:4000 */
  apiUrl: string;
  /** Bearer token. Empty string means "not configured". */
  apiToken: string;
}

const STORAGE_KEY = 'classpilot.settings';

/**
 * The default API URL for local development.
 *
 * This is a DEFAULT, not a hardcoded endpoint: the popup lets the user change
 * it, and the stored value always wins. Nothing else in the codebase assumes
 * localhost.
 */
export const DEFAULT_API_URL = 'http://localhost:4000';

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const value = stored[STORAGE_KEY] as Partial<Settings> | undefined;

  return {
    apiUrl: normalizeApiUrl(value?.apiUrl) ?? DEFAULT_API_URL,
    apiToken: typeof value?.apiToken === 'string' ? value.apiToken : '',
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  const apiUrl = normalizeApiUrl(settings.apiUrl);
  if (!apiUrl) {
    throw new Error('The API URL must be an absolute http(s) URL.');
  }
  await chrome.storage.local.set({
    [STORAGE_KEY]: { apiUrl, apiToken: settings.apiToken.trim() },
  });
}

/**
 * Normalize a user-entered API URL: require http(s), drop any path, query or
 * fragment, and strip the trailing slash. Returns null when unusable.
 */
export function normalizeApiUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  return `${url.protocol}//${url.host}`;
}

/**
 * Redact a token for display. Shows only the last four characters, which is
 * enough for a human to confirm they pasted the right one.
 */
export function redactToken(token: string): string {
  if (token === '') return 'not set';
  if (token.length <= 4) return '****';
  return `****${token.slice(-4)}`;
}
