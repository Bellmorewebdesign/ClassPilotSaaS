import type { CoursenIconName } from '@/components/coursen-icon';

/**
 * MARKETING DEMO CONTENT ONLY.
 *
 * Everything in this file is illustrative sample data for the public
 * homepage. It is deliberately isolated under the (marketing) route group and
 * is NEVER imported by the workspace - the signed-in product shows real
 * synced data or an honest empty state, never invented assignments.
 *
 * If you are adding something here, ask: "would a logged-in student see this
 * as their own data?" If yes, it does not belong in this file.
 */

export interface DemoSource {
  id: string;
  label: string;
  icon: CoursenIconName;
  /** Whether the real integration exists today. Drives honest UI labelling. */
  live: boolean;
}

/** The four services the product story connects. */
export const DEMO_SOURCES: DemoSource[] = [
  { id: 'classroom', label: 'Classroom', icon: 'classes', live: true },
  { id: 'calendar', label: 'Calendar', icon: 'calendar', live: false },
  { id: 'drive', label: 'Drive', icon: 'file', live: false },
  { id: 'docs', label: 'Docs', icon: 'assignment', live: false },
];

export interface DemoAssignment {
  id: string;
  course: string;
  title: string;
  due: string;
  /** Tailwind-safe accent class for the course chip. */
  accent: string;
  points: number | null;
}

export const DEMO_ASSIGNMENTS: DemoAssignment[] = [
  {
    id: 'chem-lab',
    course: 'AP Chemistry',
    title: 'Titration Lab Report',
    due: 'Tomorrow, 11:59 PM',
    accent: 'bg-primary',
    points: 50,
  },
  {
    id: 'calc-limits',
    course: 'Calculus AB',
    title: 'Limits Practice Set',
    due: 'Friday',
    accent: 'bg-sky',
    points: 20,
  },
  {
    id: 'lit-essay',
    course: 'English Literature',
    title: 'Gatsby Close Reading',
    due: 'Next Monday',
    accent: 'bg-muted-foreground',
    points: 100,
  },
];

/** Prompts shown in the assistant preview. Never answered - see AskPreview. */
export const DEMO_PROMPTS: string[] = [
  'What do I have due this week?',
  'Anything missing?',
  'What should I work on first?',
  'What did my chemistry teacher say about the test?',
];
