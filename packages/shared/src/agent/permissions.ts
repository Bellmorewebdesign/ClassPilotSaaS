/**
 * The permission broker.
 *
 * WHAT THIS IS FOR
 *
 * Coursen is meant to become an agent that can act on a student's school
 * life: open the article an assignment links to, read it, put a study block
 * on the calendar. Some of those actions are harmless and some are not, and
 * the difference has to be structural rather than a matter of remembering to
 * add a confirmation dialog.
 *
 * THE LINE THIS DRAWS
 *
 * Reading data Coursen has already synced is not a privileged act - the
 * student's own coursework, already on their own screen. Prompting for it
 * would train them to click through prompts, which is worse than not asking.
 *
 * Reaching OUT is different: fresh access to Classroom, opening a website,
 * interacting with a page, changing an external calendar, writing a
 * document. Those need the student to understand what is about to happen.
 *
 * And some things are never automated at all. Submitting graded work and
 * typing into a graded form are not "high risk actions that need a bigger
 * dialog" - a tool that does them does not exist here, because a student
 * turning in work has to be the student turning in work.
 */

export const PERMISSION_CLASSES = [
  /** Read what Coursen has already stored. No prompt. */
  'READ_LOCAL_CONTEXT',
  /** Read Classroom through the extension using existing synced state. */
  'READ_CLASSROOM',
  /** Open Classroom pages again to refresh context. Asks. */
  'RESCAN_CLASSROOM',
  /** Open a website in the student's browser. Asks, per origin. */
  'OPEN_EXTERNAL_SITE',
  /** Read the content of a permitted page. Asks, per origin. */
  'READ_EXTERNAL_SITE',
  /** Click or type on an external page. Asks, per task. Not implemented. */
  'INTERACT_EXTERNAL_SITE',
  /** Create or change events on Coursen's own calendar. */
  'EDIT_CALENDAR',
  /** Change a connected external calendar. Asks. Not implemented. */
  'EDIT_EXTERNAL_CALENDAR',
  /** Write into a permitted document. Asks. Not implemented. */
  'EDIT_DOCUMENT',
  /**
   * Submit something on the student's behalf.
   *
   * Present so the model can NAME the thing it must never do. No tool
   * declares it, and `assertExecutable` refuses any tool that tries.
   */
  'SUBMIT_EXTERNAL_ACTION',
] as const;

export type PermissionClass = (typeof PERMISSION_CLASSES)[number];

/**
 * How a permission is obtained.
 *
 *   implicit    granted by using the product. Never prompts.
 *   session     asked once, held for the current task.
 *   per_origin  asked per website, and remembered only for that origin.
 *   per_action  asked every single time, with the specifics shown.
 *   forbidden   not available to any tool.
 */
export type ConsentModel =
  | 'implicit'
  | 'session'
  | 'per_origin'
  | 'per_action'
  | 'forbidden';

export interface PermissionDefinition {
  readonly permission: PermissionClass;
  readonly consent: ConsentModel;
  /** Shown to the student when the prompt appears. */
  readonly title: string;
  /** One sentence in the student's terms, not the system's. */
  readonly explains: string;
  /** True when the action changes something outside Coursen. */
  readonly mutatesExternalState: boolean;
}

export const PERMISSIONS: Record<PermissionClass, PermissionDefinition> = {
  READ_LOCAL_CONTEXT: {
    permission: 'READ_LOCAL_CONTEXT',
    consent: 'implicit',
    title: 'Read your Coursen workspace',
    explains: 'Uses the classes and assignments already synced into Coursen.',
    mutatesExternalState: false,
  },
  READ_CLASSROOM: {
    permission: 'READ_CLASSROOM',
    consent: 'implicit',
    title: 'Read your synced Classroom data',
    explains: 'Uses what the last Classroom sync already brought across.',
    mutatesExternalState: false,
  },
  RESCAN_CLASSROOM: {
    permission: 'RESCAN_CLASSROOM',
    consent: 'per_action',
    title: 'Re-check Google Classroom',
    explains: 'Opens your Classroom pages again in a background tab to get fresher information.',
    mutatesExternalState: false,
  },
  OPEN_EXTERNAL_SITE: {
    permission: 'OPEN_EXTERNAL_SITE',
    consent: 'per_origin',
    title: 'Open a website',
    explains: 'Opens a page in your browser, using the session you are already signed into.',
    mutatesExternalState: false,
  },
  READ_EXTERNAL_SITE: {
    permission: 'READ_EXTERNAL_SITE',
    consent: 'per_origin',
    title: 'Read a website',
    explains: 'Reads the visible text of a page so Coursen can work from it.',
    mutatesExternalState: false,
  },
  INTERACT_EXTERNAL_SITE: {
    permission: 'INTERACT_EXTERNAL_SITE',
    consent: 'per_action',
    title: 'Interact with a website',
    explains: 'Clicks or types on a page on your behalf. You approve each task.',
    mutatesExternalState: true,
  },
  EDIT_CALENDAR: {
    permission: 'EDIT_CALENDAR',
    consent: 'session',
    title: 'Change your Coursen calendar',
    explains: 'Adds, edits or removes events on your own Coursen calendar.',
    mutatesExternalState: false,
  },
  EDIT_EXTERNAL_CALENDAR: {
    permission: 'EDIT_EXTERNAL_CALENDAR',
    consent: 'per_action',
    title: 'Change your Google Calendar',
    explains: 'Writes an event to a calendar outside Coursen.',
    mutatesExternalState: true,
  },
  EDIT_DOCUMENT: {
    permission: 'EDIT_DOCUMENT',
    consent: 'per_action',
    title: 'Edit a document',
    explains: 'Writes into a document you have given Coursen access to.',
    mutatesExternalState: true,
  },
  SUBMIT_EXTERNAL_ACTION: {
    permission: 'SUBMIT_EXTERNAL_ACTION',
    consent: 'forbidden',
    title: 'Submit work on your behalf',
    explains: 'Coursen does not do this. Turning work in is yours to do.',
    mutatesExternalState: true,
  },
};

/** Does this permission ever show the student a prompt? */
export function requiresPrompt(permission: PermissionClass): boolean {
  const consent = PERMISSIONS[permission].consent;
  return consent !== 'implicit' && consent !== 'forbidden';
}

/** A grant the broker is holding. */
export interface PermissionGrant {
  permission: PermissionClass;
  /** Present for per_origin grants. An origin, never a full URL. */
  origin?: string;
  /** ISO 8601. A grant is never indefinite. */
  expiresAt: string;
  /** What the student was told they were approving. */
  grantedFor: string;
}

export interface PermissionRequest {
  permission: PermissionClass;
  /** The specific thing being asked for, shown verbatim to the student. */
  reason: string;
  origin?: string;
}

export type PermissionDecision =
  | { granted: true; grant: PermissionGrant }
  | { granted: false; reason: 'denied' | 'forbidden' | 'not_implemented' };

/**
 * Is this request already covered by a held grant?
 *
 * Deliberately strict:
 *   - a forbidden permission is never covered, by anything;
 *   - an expired grant is not a grant;
 *   - a per-origin grant covers exactly its own origin. Not subdomains, not
 *     "the same site", not a redirect target. A grant for one host is not a
 *     grant for another that happens to share a suffix.
 */
export function isCovered(
  request: PermissionRequest,
  grants: readonly PermissionGrant[],
  now: Date = new Date(),
): boolean {
  const definition = PERMISSIONS[request.permission];
  if (definition.consent === 'forbidden') return false;
  if (definition.consent === 'implicit') return true;

  return grants.some((grant) => {
    if (grant.permission !== request.permission) return false;
    if (Date.parse(grant.expiresAt) <= now.getTime()) return false;
    if (definition.consent === 'per_origin') {
      return grant.origin !== undefined && grant.origin === request.origin;
    }
    // A per_action permission is never covered in advance.
    return definition.consent === 'session';
  });
}
