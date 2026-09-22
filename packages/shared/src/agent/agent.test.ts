import { describe, expect, it } from 'vitest';
import {
  isCovered,
  PERMISSIONS,
  PERMISSION_CLASSES,
  requiresPrompt,
  type PermissionGrant,
} from './permissions.js';
import {
  assertExecutable,
  implementedTools,
  listTools,
  parseToolInput,
  TOOLS,
  ToolNotExecutableError,
} from './tools.js';

/**
 * Agent foundation tests.
 *
 * Two properties matter most, and both are about honesty:
 *
 *   A tool that is not built cannot be executed, however convincing its
 *   schema looks. Otherwise "the contract exists" becomes "the tool works"
 *   and an agent reports having read a website it never opened.
 *
 *   Submitting work on a student's behalf is not a high-risk action behind a
 *   bigger dialog. It is absent, and refused if anything asks for it.
 */

const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const past = new Date(Date.now() - 60 * 1000).toISOString();

describe('tool registry', () => {
  it('declares a permission for every tool', () => {
    for (const tool of listTools()) {
      expect(PERMISSION_CLASSES).toContain(tool.permission);
    }
  });

  it('declares an input schema for every tool', () => {
    for (const tool of listTools()) {
      expect(tool.input).toBeDefined();
      expect(() => tool.input.safeParse({})).not.toThrow();
    }
  });

  it('names every tool consistently with its key', () => {
    for (const [key, tool] of Object.entries(TOOLS)) {
      expect(tool.name).toBe(key);
    }
  });

  it('marks mutating tools as mutating', () => {
    expect(TOOLS['calendar.create'].mutates).toBe(true);
    expect(TOOLS['calendar.delete'].mutates).toBe(true);
    expect(TOOLS['classroom.search'].mutates).toBe(false);
  });

  it('has something implemented and something planned', () => {
    const implemented = implementedTools();
    expect(implemented.length).toBeGreaterThan(0);
    expect(implemented.length).toBeLessThan(listTools().length);
  });
});

describe('unimplemented tools cannot be executed', () => {
  it('refuses a planned tool', () => {
    expect(() => assertExecutable('browser.readPage')).toThrow(ToolNotExecutableError);
  });

  it('reports not_implemented rather than a generic failure', () => {
    try {
      assertExecutable('docs.write');
      throw new Error('should have refused');
    } catch (error) {
      expect(error).toBeInstanceOf(ToolNotExecutableError);
      expect((error as ToolNotExecutableError).code).toBe('not_implemented');
    }
  });

  it('refuses every planned tool in the registry', () => {
    for (const tool of listTools()) {
      if (tool.status === 'implemented') continue;
      expect(() => assertExecutable(tool.name), tool.name).toThrow(ToolNotExecutableError);
    }
  });

  it('allows every implemented tool', () => {
    for (const tool of implementedTools()) {
      expect(() => assertExecutable(tool.name), tool.name).not.toThrow();
    }
  });

  it('refuses a tool that does not exist', () => {
    try {
      assertExecutable('classroom.deleteEverything');
      throw new Error('should have refused');
    } catch (error) {
      expect((error as ToolNotExecutableError).code).toBe('unknown_tool');
    }
  });

  it('tells the caller to say so rather than inventing a result', () => {
    try {
      assertExecutable('browser.open');
      throw new Error('should have refused');
    } catch (error) {
      expect((error as Error).message).toMatch(/not built yet/i);
    }
  });
});

describe('submitting work is not a tool', () => {
  it('no tool claims the submit permission', () => {
    const submitters = listTools().filter(
      (tool) => tool.permission === 'SUBMIT_EXTERNAL_ACTION',
    );
    expect(submitters).toEqual([]);
  });

  it('the permission is marked forbidden', () => {
    expect(PERMISSIONS.SUBMIT_EXTERNAL_ACTION.consent).toBe('forbidden');
  });

  it('a forbidden permission can never be covered by a grant', () => {
    const grant: PermissionGrant = {
      permission: 'SUBMIT_EXTERNAL_ACTION',
      expiresAt: future,
      grantedFor: 'anything',
    };
    expect(
      isCovered({ permission: 'SUBMIT_EXTERNAL_ACTION', reason: 'x' }, [grant]),
    ).toBe(false);
  });
});

describe('tool input validation', () => {
  it('accepts a well-formed call', () => {
    expect(() =>
      parseToolInput('calendar.create', {
        title: 'Revise',
        startAt: '2026-09-22T15:00:00.000Z',
      }),
    ).not.toThrow();
  });

  it('rejects a call missing a required field', () => {
    expect(() => parseToolInput('calendar.create', { title: 'Revise' })).toThrow();
  });

  it('rejects an out-of-range limit', () => {
    expect(() => parseToolInput('classroom.search', { limit: 10_000 })).toThrow();
  });

  it('rejects a non-URL where a URL is required', () => {
    expect(() => parseToolInput('browser.open', { url: 'not a url' })).toThrow();
  });
});

describe('permission model', () => {
  it('does not prompt for reading what is already synced', () => {
    expect(requiresPrompt('READ_LOCAL_CONTEXT')).toBe(false);
    expect(requiresPrompt('READ_CLASSROOM')).toBe(false);
  });

  it('prompts before reaching outside Coursen', () => {
    expect(requiresPrompt('OPEN_EXTERNAL_SITE')).toBe(true);
    expect(requiresPrompt('READ_EXTERNAL_SITE')).toBe(true);
    expect(requiresPrompt('INTERACT_EXTERNAL_SITE')).toBe(true);
    expect(requiresPrompt('RESCAN_CLASSROOM')).toBe(true);
    expect(requiresPrompt('EDIT_EXTERNAL_CALENDAR')).toBe(true);
    expect(requiresPrompt('EDIT_DOCUMENT')).toBe(true);
  });

  it('marks every externally-mutating permission as such', () => {
    expect(PERMISSIONS.EDIT_EXTERNAL_CALENDAR.mutatesExternalState).toBe(true);
    expect(PERMISSIONS.EDIT_DOCUMENT.mutatesExternalState).toBe(true);
    expect(PERMISSIONS.INTERACT_EXTERNAL_SITE.mutatesExternalState).toBe(true);
    // Coursen's own calendar is not external state.
    expect(PERMISSIONS.EDIT_CALENDAR.mutatesExternalState).toBe(false);
  });

  it('gives every permission a student-facing explanation', () => {
    for (const permission of PERMISSION_CLASSES) {
      const definition = PERMISSIONS[permission];
      expect(definition.title.length).toBeGreaterThan(0);
      expect(definition.explains.length).toBeGreaterThan(10);
    }
  });
});

describe('grants', () => {
  it('covers an implicit permission with no grant at all', () => {
    expect(isCovered({ permission: 'READ_LOCAL_CONTEXT', reason: 'x' }, [])).toBe(true);
  });

  it('covers a per-origin request for exactly that origin', () => {
    const grant: PermissionGrant = {
      permission: 'READ_EXTERNAL_SITE',
      origin: 'https://example.edu',
      expiresAt: future,
      grantedFor: 'AP History reading',
    };
    expect(
      isCovered(
        { permission: 'READ_EXTERNAL_SITE', reason: 'x', origin: 'https://example.edu' },
        [grant],
      ),
    ).toBe(true);
  });

  it('does not let one origin stand in for another', () => {
    const grant: PermissionGrant = {
      permission: 'READ_EXTERNAL_SITE',
      origin: 'https://example.edu',
      expiresAt: future,
      grantedFor: 'AP History reading',
    };
    for (const other of [
      'https://evil.example.edu',
      'https://example.edu.attacker.com',
      'http://example.edu',
      'https://example.com',
    ]) {
      expect(
        isCovered(
          { permission: 'READ_EXTERNAL_SITE', reason: 'x', origin: other },
          [grant],
        ),
        other,
      ).toBe(false);
    }
  });

  it('treats an expired grant as no grant', () => {
    const grant: PermissionGrant = {
      permission: 'READ_EXTERNAL_SITE',
      origin: 'https://example.edu',
      expiresAt: past,
      grantedFor: 'x',
    };
    expect(
      isCovered(
        { permission: 'READ_EXTERNAL_SITE', reason: 'x', origin: 'https://example.edu' },
        [grant],
      ),
    ).toBe(false);
  });

  it('never covers a per-action permission in advance', () => {
    const grant: PermissionGrant = {
      permission: 'RESCAN_CLASSROOM',
      expiresAt: future,
      grantedFor: 'earlier rescan',
    };
    // Asking once must not authorise every future rescan.
    expect(isCovered({ permission: 'RESCAN_CLASSROOM', reason: 'x' }, [grant])).toBe(false);
  });

  it('covers a session permission for the rest of the session', () => {
    const grant: PermissionGrant = {
      permission: 'EDIT_CALENDAR',
      expiresAt: future,
      grantedFor: 'adding study blocks',
    };
    expect(isCovered({ permission: 'EDIT_CALENDAR', reason: 'x' }, [grant])).toBe(true);
  });

  it('does not let a grant for one permission cover another', () => {
    const grant: PermissionGrant = {
      permission: 'READ_EXTERNAL_SITE',
      origin: 'https://example.edu',
      expiresAt: future,
      grantedFor: 'reading',
    };
    expect(
      isCovered(
        { permission: 'INTERACT_EXTERNAL_SITE', reason: 'x', origin: 'https://example.edu' },
        [grant],
      ),
    ).toBe(false);
  });
});
