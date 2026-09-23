/**
 * @classpilot/shared
 *
 * The single source of truth for everything that crosses a boundary between
 * the Chrome extension, the API and the web app: vocabularies, Classroom URL
 * grammar, normalizers, the Zod wire contract, and the API DTOs.
 *
 * Rule of thumb: if two of the three apps need to agree on it, it lives here.
 */

export * from './classroom/enums.js';
export * from './classroom/urls.js';
export * from './calendar/types.js';
export * from './calendar/schemas.js';
export * from './agent/permissions.js';
export * from './agent/tools.js';
export * from './classroom/attachments.js';
export * from './classroom/candidates.js';

export * from './normalize/text.js';
export * from './normalize/dates.js';

export * from './sync/schemas.js';
export * from './sync/hash.js';

export * from './api/types.js';
export * from './brand.js';
