/**
 * Content hashing.
 *
 * We hash a *canonical projection* of a record — only the fields whose change
 * means "this assignment actually changed". Timestamps like `lastSeenAt` are
 * deliberately excluded, otherwise every sync would look like an update and
 * the "4 new / 2 updated" counters would be meaningless.
 *
 * This module only builds the deterministic input string. The actual digest is
 * computed by the API with node:crypto, so there is exactly one hash
 * implementation in the system.
 */

/**
 * Deterministic JSON: object keys sorted, undefined dropped, arrays kept in
 * order (order is meaningful for attachments as Classroom renders them).
 */
export function stableStringify(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'null';

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(',')}}`;
  }

  if (typeof value === 'number' && !Number.isFinite(value)) return 'null';

  return JSON.stringify(value);
}

/** Fields whose change constitutes a meaningful assignment change. */
export interface AssignmentHashInput {
  title: string | null;
  instructions: string | null;
  assignmentType: string;
  topic: string | null;
  dueAt: Date | string | null;
  pointsPossible: number | null;
  status: string;
  grade: { raw: string | null; earned: number | null; possible: number | null } | null;
  attachments: Array<{
    name: string | null;
    url: string;
    attachmentType: string;
  }>;
}

export function assignmentHashInput(input: AssignmentHashInput): string {
  return stableStringify({
    title: input.title,
    instructions: input.instructions,
    assignmentType: input.assignmentType,
    topic: input.topic,
    dueAt: input.dueAt instanceof Date ? input.dueAt.toISOString() : input.dueAt,
    pointsPossible: input.pointsPossible,
    status: input.status,
    grade: input.grade,
    // Attachments are compared by the triple that identifies them.
    attachments: input.attachments.map((a) => ({
      name: a.name,
      url: a.url,
      attachmentType: a.attachmentType,
    })),
  });
}

/** Fields whose change constitutes a meaningful class change. */
export interface ClassHashInput {
  name: string | null;
  section: string | null;
  teacherName: string | null;
  room: string | null;
  description: string | null;
}

export function classHashInput(input: ClassHashInput): string {
  return stableStringify({
    name: input.name,
    section: input.section,
    teacherName: input.teacherName,
    room: input.room,
    description: input.description,
  });
}
