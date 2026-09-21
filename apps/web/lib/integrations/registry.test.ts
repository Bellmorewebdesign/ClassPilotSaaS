import { describe, expect, it } from 'vitest';
import {
  INTEGRATIONS,
  STATE_PRESENTATION,
  getIntegration,
  resolveState,
  type IntegrationState,
} from './registry';

/**
 * The honesty guarantee.
 *
 * The product deliberately ships UI for integrations that do not exist yet.
 * The one rule that keeps that from being a lie is `resolveState`: an
 * integration whose backend is not implemented can never display as
 * connected, syncing, or anything other than "coming soon".
 *
 * This is exactly the kind of rule that rots silently - someone adds a state,
 * or flips a flag while wiring up a demo - so it is pinned here.
 */

const EVERY_STATE: IntegrationState[] = [
  'coming_soon',
  'available',
  'not_connected',
  'connecting',
  'connected',
  'syncing',
  'error',
];

describe('resolveState', () => {
  it('forces every unimplemented integration to "coming soon", whatever is requested', () => {
    const unimplemented = INTEGRATIONS.filter((i) => !i.implemented);
    expect(unimplemented.length).toBeGreaterThan(0);

    for (const definition of unimplemented) {
      for (const requested of EVERY_STATE) {
        expect(resolveState(definition, requested)).toBe('coming_soon');
      }
    }
  });

  it('lets an implemented integration take any state it is given', () => {
    const classroom = getIntegration('classroom');
    expect(classroom.implemented).toBe(true);

    for (const requested of EVERY_STATE) {
      expect(resolveState(classroom, requested)).toBe(requested);
    }
  });

  it('never reports an unimplemented integration as positive or busy', () => {
    for (const definition of INTEGRATIONS.filter((i) => !i.implemented)) {
      const presentation = STATE_PRESENTATION[resolveState(definition, 'connected')];
      expect(presentation.tone).toBe('neutral');
      expect(presentation.busy).toBe(false);
    }
  });
});

describe('registry contents', () => {
  it('covers the four sources the product story promises', () => {
    expect(INTEGRATIONS.map((i) => i.id)).toEqual([
      'classroom',
      'calendar',
      'drive',
      'docs',
    ]);
  });

  it('marks only Classroom as implemented today', () => {
    // If this changes, the marketing copy and the integrations page need to
    // change with it - hence the explicit assertion rather than a loose check.
    expect(INTEGRATIONS.filter((i) => i.implemented).map((i) => i.id)).toEqual([
      'classroom',
    ]);
  });

  it('gives every integration copy a student can act on', () => {
    for (const definition of INTEGRATIONS) {
      expect(definition.summary.length).toBeGreaterThan(10);
      expect(definition.capabilities.length).toBeGreaterThanOrEqual(3);
      expect(definition.method.length).toBeGreaterThan(10);
    }
  });

  it('has a presentation for every state in the union', () => {
    for (const state of EVERY_STATE) {
      expect(STATE_PRESENTATION[state]).toBeDefined();
      expect(STATE_PRESENTATION[state].label.length).toBeGreaterThan(0);
    }
  });

  it('throws on an unknown integration rather than returning undefined', () => {
    // @ts-expect-error - deliberately passing an id outside the union.
    expect(() => getIntegration('notion')).toThrow(/Unknown integration/);
  });
});
