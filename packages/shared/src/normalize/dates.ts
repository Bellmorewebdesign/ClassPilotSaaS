/**
 * Due-date normalization.
 *
 * Classroom renders due dates as human text ("Due Sep 24", "Due Tomorrow,
 * 11:59 PM"). The extension captures both the raw label and, when it can, an
 * ISO timestamp. The API stores the ISO instant; the raw label is kept so a
 * human can audit what we read.
 *
 * Rule: we would rather store `null` than a wrong deadline. Every parser here
 * returns null when it is not confident.
 */

/** Dates further than this from "now" are almost certainly a parse error. */
const MAX_PAST_YEARS = 3;
const MAX_FUTURE_YEARS = 3;

const MONTHS: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

export interface NormalizedDueDate {
  /** UTC instant, or null when we could not determine one confidently. */
  dueAt: Date | null;
  /** The text we read it from, kept verbatim (normalized whitespace only). */
  rawLabel: string | null;
  /** True when the source only gave a date with no clock time. */
  allDay: boolean;
}

/**
 * Accept an ISO-8601 string (or Date) and return a sane Date.
 * Rejects timestamps implausibly far from now, which catches both bad parses
 * and obviously corrupt input.
 */
export function normalizeIsoDate(
  value: unknown,
  now: Date = new Date(),
): Date | null {
  if (value === null || value === undefined || value === '') return null;

  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'string' || typeof value === 'number') {
    date = new Date(value);
  } else {
    return null;
  }

  if (Number.isNaN(date.getTime())) return null;

  const years = (date.getTime() - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (years < -MAX_PAST_YEARS || years > MAX_FUTURE_YEARS) return null;

  return date;
}

/**
 * Parse a Classroom-style due label into an instant.
 *
 * Deliberately conservative: it handles the explicit forms Classroom actually
 * renders and gives up on anything else. Relative labels ("Tomorrow") are
 * resolved against `now`, which the caller supplies so this stays testable.
 *
 * Returns the instant in the *local* timezone of the runtime, because that is
 * the timezone the student's browser rendered the label in.
 */
export function parseDueLabel(
  rawLabel: string | null | undefined,
  now: Date = new Date(),
): NormalizedDueDate {
  const label = typeof rawLabel === 'string' ? rawLabel.replace(/\s+/g, ' ').trim() : '';
  const empty: NormalizedDueDate = { dueAt: null, rawLabel: label || null, allDay: false };
  if (label === '') return empty;

  const lower = label.toLowerCase();

  // "No due date" is a real, meaningful answer: there is no deadline.
  if (/\bno due date\b/.test(lower)) return empty;

  const time = parseClockTime(lower);

  // Relative day words.
  let base: Date | null = null;
  if (/\btoday\b/.test(lower)) {
    base = startOfDay(now);
  } else if (/\btomorrow\b/.test(lower)) {
    base = startOfDay(addDays(now, 1));
  } else if (/\byesterday\b/.test(lower)) {
    base = startOfDay(addDays(now, -1));
  }

  if (!base) base = parseMonthDay(lower, now);

  if (!base) return empty;

  if (time) {
    base.setHours(time.hours, time.minutes, 0, 0);
  }

  const checked = normalizeIsoDate(base, now);
  return {
    dueAt: checked,
    rawLabel: label,
    allDay: !time,
  };
}

interface ClockTime {
  hours: number;
  minutes: number;
}

/** Parse "11:59 pm", "9 am", "23:59" out of a label. */
function parseClockTime(lower: string): ClockTime | null {
  const twelveHour = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/.exec(lower);
  if (twelveHour) {
    let hours = Number(twelveHour[1]);
    const minutes = twelveHour[2] ? Number(twelveHour[2]) : 0;
    const meridiem = twelveHour[3];
    if (hours < 1 || hours > 12 || minutes > 59) return null;
    if (meridiem === 'pm' && hours !== 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    return { hours, minutes };
  }

  const twentyFour = /\b(\d{1,2}):(\d{2})\b/.exec(lower);
  if (twentyFour) {
    const hours = Number(twentyFour[1]);
    const minutes = Number(twentyFour[2]);
    if (hours > 23 || minutes > 59) return null;
    return { hours, minutes };
  }

  return null;
}

/**
 * Parse "Sep 24", "September 24, 2026", "24 Sep" out of a label.
 *
 * When no year is present Classroom means "the nearest sensible one", so we
 * pick the year that puts the date closest to `now` — this is what makes
 * "Due Jan 8" resolve forward across a December-to-January boundary instead
 * of backward by eleven months.
 */
function parseMonthDay(lower: string, now: Date): Date | null {
  const monthNames = Object.keys(MONTHS).join('|');

  const monthFirst = new RegExp(
    `\\b(${monthNames})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(\\d{4}))?\\b`,
  ).exec(lower);
  const dayFirst = new RegExp(
    `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthNames})\\.?(?:,?\\s*(\\d{4}))?\\b`,
  ).exec(lower);

  let monthKey: string | undefined;
  let dayRaw: string | undefined;
  let yearRaw: string | undefined;

  if (monthFirst) {
    [, monthKey, dayRaw, yearRaw] = monthFirst;
  } else if (dayFirst) {
    [, dayRaw, monthKey, yearRaw] = dayFirst;
  } else {
    return null;
  }

  if (!monthKey || !dayRaw) return null;
  const month = MONTHS[monthKey];
  const day = Number(dayRaw);
  if (month === undefined || day < 1 || day > 31) return null;

  if (yearRaw) {
    const date = buildDate(Number(yearRaw), month, day);
    return date;
  }

  // No year given: choose the candidate year closest to now.
  const candidates = [
    buildDate(now.getFullYear() - 1, month, day),
    buildDate(now.getFullYear(), month, day),
    buildDate(now.getFullYear() + 1, month, day),
  ].filter((d): d is Date => d !== null);

  if (candidates.length === 0) return null;

  return candidates.reduce((best, candidate) =>
    Math.abs(candidate.getTime() - now.getTime()) <
    Math.abs(best.getTime() - now.getTime())
      ? candidate
      : best,
  );
}

/** Build a local Date, rejecting impossible days like Feb 30. */
function buildDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month, day, 0, 0, 0, 0);
  if (date.getMonth() !== month || date.getDate() !== day) return null;
  return date;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date.getTime());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
}
