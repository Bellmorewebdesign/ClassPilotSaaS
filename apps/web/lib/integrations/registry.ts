import { brand } from '@classpilot/shared';
import type { CoursenIconName } from '@/components/coursen-icon';

/**
 * The integration registry.
 *
 * One definition per integration, consumed by both the marketing showcase and
 * the in-app integrations centre. Adding Drive tomorrow means adding a
 * `capabilities` entry and flipping `implemented` - not designing a new card.
 *
 * The honesty rule is encoded in the types: an integration that is not
 * `implemented` can only ever resolve to the `coming_soon` state, so the UI
 * physically cannot show "Connected" for something that does not exist.
 */

/** Every state an integration can be in across its lifecycle. */
export type IntegrationState =
  | 'coming_soon'
  /**
   * The integration exists and can be connected, stated independently of any
   * particular person's account. Used on the marketing site, where saying
   * "Connected" would imply the visitor had connected something.
   */
  | 'available'
  | 'not_connected'
  | 'connecting'
  | 'connected'
  | 'syncing'
  | 'error';

export interface IntegrationDefinition {
  id: 'classroom' | 'calendar' | 'drive' | 'docs';
  name: string;
  /** One line explaining the value, written for a student. */
  summary: string;
  /** What it will do once connected. Shown in the detail area. */
  capabilities: string[];
  icon: CoursenIconName;
  /** Accent used for the icon tile. Kept to brand-adjacent hues. */
  tint: string;
  /**
   * Whether the backend can actually do this today. When false the UI is
   * locked to `coming_soon` no matter what else is passed in.
   */
  implemented: boolean;
  /** How the connection is established, shown so nothing feels like magic. */
  method: string;
}

export const INTEGRATIONS: readonly IntegrationDefinition[] = [
  {
    id: 'classroom',
    name: 'Google Classroom',
    summary: 'Your classes, classwork and due dates.',
    capabilities: [
      'Import enrolled classes and teachers',
      'Read assignments, due dates and points',
      'Track turned in, missing and returned work',
    ],
    icon: 'classes',
    tint: 'text-primary',
    implemented: true,
    method: `${brand.extensionName} reads Classroom from your signed-in browser session.`,
  },
  {
    id: 'calendar',
    name: 'Google Calendar',
    summary: 'Bring deadlines into your schedule.',
    capabilities: [
      'Place assignment deadlines on your calendar',
      'See coursework beside classes and activities',
      'Spot the week where three things land at once',
    ],
    icon: 'calendar',
    tint: 'text-muted-foreground',
    implemented: false,
    method: 'Will connect through your Google account.',
  },
  {
    id: 'drive',
    name: 'Google Drive',
    summary: 'Give Coursen access to selected school documents.',
    capabilities: [
      'Link the files attached to an assignment',
      'Find the handout you were given three weeks ago',
      'Keep coursework files beside the work itself',
    ],
    icon: 'file',
    tint: 'text-muted-foreground',
    implemented: false,
    method: 'Will connect through your Google account, folder by folder.',
  },
  {
    id: 'docs',
    name: 'Google Docs',
    summary: 'Work with documents directly from Coursen.',
    capabilities: [
      'Open an assignment doc without hunting for it',
      'See which draft belongs to which assignment',
      'Pick up where you left off',
    ],
    icon: 'assignment',
    tint: 'text-muted-foreground',
    implemented: false,
    method: 'Will connect through your Google account.',
  },
] as const;

/**
 * Resolve the state an integration should display.
 *
 * Unimplemented integrations are forced to `coming_soon` regardless of the
 * requested state. This is the single guard that keeps the UI from ever
 * claiming a connection that does not exist.
 */
export function resolveState(
  definition: IntegrationDefinition,
  requested: IntegrationState,
): IntegrationState {
  return definition.implemented ? requested : 'coming_soon';
}

export interface StatePresentation {
  label: string;
  /** Drives the badge styling. */
  tone: 'neutral' | 'positive' | 'active' | 'warning';
  /** Whether a spinner/pulse should be shown. */
  busy: boolean;
}

export const STATE_PRESENTATION: Record<IntegrationState, StatePresentation> = {
  coming_soon: { label: 'Coming soon', tone: 'neutral', busy: false },
  available: { label: 'Available now', tone: 'positive', busy: false },
  not_connected: { label: 'Not connected', tone: 'neutral', busy: false },
  connecting: { label: 'Connecting', tone: 'active', busy: true },
  connected: { label: 'Connected', tone: 'positive', busy: false },
  syncing: { label: 'Syncing', tone: 'active', busy: true },
  error: { label: 'Needs attention', tone: 'warning', busy: false },
};

export function getIntegration(
  id: IntegrationDefinition['id'],
): IntegrationDefinition {
  const found = INTEGRATIONS.find((item) => item.id === id);
  if (!found) throw new Error(`Unknown integration: ${id}`);
  return found;
}
