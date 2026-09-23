import { z } from 'zod';
import type { PermissionClass } from './permissions.js';

/**
 * Agent tool contracts.
 *
 * WHY A REGISTRY RATHER THAN FUNCTIONS IN A CHAT COMPONENT
 *
 * The reasoning layer is going to be swapped, reprompted and re-evaluated
 * many times. What must not move with it is the set of things Coursen can
 * actually do, the permission each one needs, and which of them are real.
 *
 * So tools are declared here as data: name, description, input schema,
 * permission, where they execute, and - the field that keeps this honest -
 * their implementation status.
 *
 * NOTHING HERE CALLS AN LLM. This milestone builds the contract; the model
 * that drives it comes later.
 *
 * ---------------------------------------------------------------------------
 * THE STATUS FIELD
 *
 * `implemented` means there is working code behind it today.
 * `planned` means the contract is agreed and the implementation is not
 * written. A planned tool is describable and MUST NOT be executable, which
 * `assertExecutable` enforces - so a future agent cannot be talked into
 * believing a tool works because it can see its schema.
 */

export type ToolStatus = 'implemented' | 'planned';

/**
 * Where a tool runs.
 *
 *   api        the Fastify server, against the database
 *   extension  the browser extension, against Classroom or a web page
 *   web        the Next app
 */
export type ToolTarget = 'api' | 'extension' | 'web';

export interface ToolDefinition<TInput extends z.ZodTypeAny = z.ZodTypeAny> {
  readonly name: string;
  /** Written for the model: what it does, and when to reach for it. */
  readonly description: string;
  readonly input: TInput;
  readonly permission: PermissionClass;
  readonly target: ToolTarget;
  readonly status: ToolStatus;
  /**
   * True when the tool changes state the student would notice. Used to
   * decide what needs showing before it runs, and what belongs in a log.
   */
  readonly mutates: boolean;
}

const classId = z.string().trim().min(1).max(128);

/** The tools Coursen can reason about. */
export const TOOLS = {
  // --- Classroom ----------------------------------------------------------

  'classroom.search': {
    name: 'classroom.search',
    description:
      'Search the coursework already synced into Coursen. Use this first for any question about assignments, due dates or classes - it is fast and needs no permission.',
    input: z.object({
      query: z.string().trim().max(200).optional(),
      classId: classId.optional(),
      dueAfter: z.string().datetime().optional(),
      dueBefore: z.string().datetime().optional(),
      status: z.enum(['assigned', 'turned_in', 'missing', 'graded', 'unknown']).optional(),
      limit: z.number().int().min(1).max(100).default(25),
    }),
    permission: 'READ_LOCAL_CONTEXT',
    target: 'api',
    status: 'implemented',
    mutates: false,
  },

  'classroom.getAssignment': {
    name: 'classroom.getAssignment',
    description:
      'Read one assignment in full, including instructions and attachments, from what Coursen has already synced.',
    input: z.object({ assignmentId: z.string().trim().min(1).max(64) }),
    permission: 'READ_LOCAL_CONTEXT',
    target: 'api',
    status: 'implemented',
    mutates: false,
  },

  'classroom.getAnnouncements': {
    name: 'classroom.getAnnouncements',
    description:
      'Read recent teacher announcements for a class. Use this when a student asks what a teacher said, or when an expected quiz or test does not appear as an assignment.',
    input: z.object({
      classId: classId.optional(),
      since: z.string().datetime().optional(),
      limit: z.number().int().min(1).max(50).default(20),
    }),
    permission: 'READ_LOCAL_CONTEXT',
    target: 'api',
    status: 'planned',
    mutates: false,
  },

  'classroom.requestRescan': {
    name: 'classroom.requestRescan',
    description:
      'Ask the student for permission to re-read Google Classroom for one class, when stored information may be stale. Check freshness before reaching for this: a rescan opens real pages and takes real time.',
    input: z.object({
      classId,
      reason: z.string().trim().min(1).max(200),
    }),
    permission: 'RESCAN_CLASSROOM',
    target: 'extension',
    status: 'planned',
    mutates: false,
  },

  // --- Calendar -----------------------------------------------------------

  'calendar.list': {
    name: 'calendar.list',
    description:
      "List events on the student's Coursen calendar in a date range, including due dates derived from synced assignments.",
    input: z.object({
      from: z.string().datetime(),
      to: z.string().datetime(),
    }),
    permission: 'READ_LOCAL_CONTEXT',
    target: 'api',
    status: 'implemented',
    mutates: false,
  },

  'calendar.create': {
    name: 'calendar.create',
    description:
      'Add an event to the Coursen calendar - a study block, a reminder, or a test a teacher mentioned. Tell the student what you are adding.',
    input: z.object({
      title: z.string().trim().min(1).max(300),
      type: z
        .enum(['assignment', 'quiz', 'test', 'event', 'study_block', 'reminder'])
        .default('event'),
      startAt: z.string().datetime(),
      endAt: z.string().datetime().optional(),
      allDay: z.boolean().default(false),
      classId: classId.optional(),
      description: z.string().trim().max(5000).optional(),
    }),
    permission: 'EDIT_CALENDAR',
    target: 'api',
    status: 'implemented',
    mutates: true,
  },

  'calendar.update': {
    name: 'calendar.update',
    description:
      'Change an event the student owns. Events derived from Classroom assignments cannot be changed here - their due date belongs to Classroom.',
    input: z.object({
      eventId: z.string().trim().min(1).max(64),
      title: z.string().trim().min(1).max(300).optional(),
      startAt: z.string().datetime().optional(),
      endAt: z.string().datetime().optional(),
    }),
    permission: 'EDIT_CALENDAR',
    target: 'api',
    status: 'implemented',
    mutates: true,
  },

  'calendar.delete': {
    name: 'calendar.delete',
    description: 'Remove an event the student owns from the Coursen calendar.',
    input: z.object({ eventId: z.string().trim().min(1).max(64) }),
    permission: 'EDIT_CALENDAR',
    target: 'api',
    status: 'implemented',
    mutates: true,
  },

  // --- Browser ------------------------------------------------------------

  'browser.requestAccess': {
    name: 'browser.requestAccess',
    description:
      'Ask the student to allow Coursen to read one website, naming the site and why it is needed. Always call this before browser.open or browser.readPage.',
    input: z.object({
      origin: z.string().trim().url(),
      reason: z.string().trim().min(1).max(200),
    }),
    permission: 'OPEN_EXTERNAL_SITE',
    target: 'extension',
    status: 'planned',
    mutates: false,
  },

  'browser.open': {
    name: 'browser.open',
    description:
      'Open an approved URL in a background tab. Requires an existing grant for that origin.',
    input: z.object({ url: z.string().trim().url() }),
    permission: 'OPEN_EXTERNAL_SITE',
    target: 'extension',
    status: 'planned',
    mutates: false,
  },

  'browser.readPage': {
    name: 'browser.readPage',
    description:
      'Read the main readable text, headings and links of an approved page. Returns structure, never credentials or hidden fields.',
    input: z.object({ url: z.string().trim().url() }),
    permission: 'READ_EXTERNAL_SITE',
    target: 'extension',
    status: 'planned',
    mutates: false,
  },

  // --- Future -------------------------------------------------------------

  'drive.search': {
    name: 'drive.search',
    description: 'Search Google Drive for documents the student has permitted.',
    input: z.object({ query: z.string().trim().min(1).max(200) }),
    permission: 'READ_EXTERNAL_SITE',
    target: 'extension',
    status: 'planned',
    mutates: false,
  },

  'docs.read': {
    name: 'docs.read',
    description: 'Read a permitted Google Doc.',
    input: z.object({ documentId: z.string().trim().min(1).max(128) }),
    permission: 'READ_EXTERNAL_SITE',
    target: 'extension',
    status: 'planned',
    mutates: false,
  },

  'docs.write': {
    name: 'docs.write',
    description:
      "Write into a permitted Google Doc. Drafts content for the student to review - it never submits anything.",
    input: z.object({
      documentId: z.string().trim().min(1).max(128),
      content: z.string().max(50_000),
    }),
    permission: 'EDIT_DOCUMENT',
    target: 'extension',
    status: 'planned',
    mutates: true,
  },
} as const satisfies Record<string, ToolDefinition>;

export type ToolName = keyof typeof TOOLS;

export function listTools(): ToolDefinition[] {
  return Object.values(TOOLS) as ToolDefinition[];
}

export function implementedTools(): ToolDefinition[] {
  return listTools().filter((tool) => tool.status === 'implemented');
}

export class ToolNotExecutableError extends Error {
  constructor(
    readonly tool: string,
    readonly code: 'unknown_tool' | 'not_implemented' | 'forbidden',
    message: string,
  ) {
    super(message);
    this.name = 'ToolNotExecutableError';
  }
}

/**
 * The gate every execution path must pass through.
 *
 * A planned tool is visible so the model can reason about what Coursen will
 * be able to do, and refusable so it can never act as though it already can.
 * Without this, "the schema exists" becomes "the tool works", and the agent
 * confidently reports having read a website it never opened.
 */
export function assertExecutable(name: string): ToolDefinition {
  const tool = (TOOLS as Record<string, ToolDefinition | undefined>)[name];
  if (!tool) {
    throw new ToolNotExecutableError(name, 'unknown_tool', `There is no tool called ${name}.`);
  }
  if (tool.permission === 'SUBMIT_EXTERNAL_ACTION') {
    throw new ToolNotExecutableError(
      name,
      'forbidden',
      'Coursen does not submit work on a student’s behalf.',
    );
  }
  if (tool.status !== 'implemented') {
    throw new ToolNotExecutableError(
      name,
      'not_implemented',
      `${name} is not built yet. Say so rather than describing what it would have returned.`,
    );
  }
  return tool;
}

/** Validate a tool call's arguments against its declared schema. */
export function parseToolInput(name: ToolName, input: unknown): unknown {
  return TOOLS[name].input.parse(input);
}
