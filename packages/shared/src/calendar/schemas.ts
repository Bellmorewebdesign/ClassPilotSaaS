import { z } from 'zod';
import { CALENDAR_ITEM_TYPES } from './types.js';

/**
 * Wire validation for calendar writes.
 *
 * Same discipline as the sync schemas: every bound is a real defence, and the
 * API trusts nothing a client sends.
 */

const isoDateTime = z
  .string()
  .trim()
  .max(40)
  .refine((value) => !Number.isNaN(Date.parse(value)), 'must be an ISO date-time');

/**
 * IANA zone name. Validated by asking Intl rather than against a list, so it
 * stays correct as the tz database changes.
 */
const timezone = z
  .string()
  .trim()
  .max(64)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'must be an IANA time zone');

const objectId = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'must be an id');

export const calendarEventCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    description: z.string().trim().max(5000).nullable().default(null),
    type: z.enum(CALENDAR_ITEM_TYPES).default('event'),
    startAt: isoDateTime,
    endAt: isoDateTime.nullable().default(null),
    allDay: z.boolean().default(false),
    timezone: timezone.default('UTC'),
    classId: objectId.nullable().default(null),
    assignmentId: objectId.nullable().default(null),
  })
  .refine(
    (value) => value.endAt === null || Date.parse(value.endAt) >= Date.parse(value.startAt),
    { message: 'endAt must not be before startAt', path: ['endAt'] },
  );

/** Every field optional, but the same bounds apply to whatever is sent. */
export const calendarEventUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(300).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    type: z.enum(CALENDAR_ITEM_TYPES).optional(),
    startAt: isoDateTime.optional(),
    endAt: isoDateTime.nullable().optional(),
    allDay: z.boolean().optional(),
    timezone: timezone.optional(),
    classId: objectId.nullable().optional(),
    assignmentId: objectId.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'no fields to update',
  });

export const calendarRangeSchema = z
  .object({
    from: isoDateTime,
    to: isoDateTime,
    /** Cap the window so one request cannot ask for a decade. */
  })
  .refine((value) => Date.parse(value.to) > Date.parse(value.from), {
    message: 'to must be after from',
    path: ['to'],
  })
  .refine(
    (value) => Date.parse(value.to) - Date.parse(value.from) <= 400 * 24 * 60 * 60 * 1000,
    { message: 'range must be 400 days or less', path: ['to'] },
  );

export type CalendarEventCreate = z.infer<typeof calendarEventCreateSchema>;
export type CalendarEventUpdate = z.infer<typeof calendarEventUpdateSchema>;
