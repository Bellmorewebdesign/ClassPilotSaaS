import type { ExtractionReport, FieldProvenance } from '@classpilot/shared';

/**
 * The extraction framework.
 *
 * Google Classroom is a client-rendered app whose CSS class names are
 * obfuscated and change without notice. Scattering selectors through the
 * codebase would guarantee a silent breakage we only discover when a
 * student's sync comes back empty.
 *
 * So every field is extracted by an ordered list of NAMED STRATEGIES:
 *
 *   - each strategy documents the signal it depends on and how confident we
 *     are in that signal;
 *   - they run most-semantic first, most-heuristic last;
 *   - the first non-null result wins;
 *   - the winning strategy's name is recorded in the extraction report.
 *
 * When Google changes their markup, the report tells us exactly which
 * strategy stopped matching and which fallback picked up the slack -- without
 * anyone having to paste private schoolwork into a bug report.
 */

/**
 * How much we trust the signal a strategy relies on.
 *
 *   url       - derived from the URL. Google would have to change their
 *               routing to break this. Effectively stable.
 *   semantic  - ARIA roles, aria-label, headings, link structure. Google
 *               maintains these for accessibility, so they change rarely.
 *   textual   - visible text patterns such as a label starting with "Due".
 *               Survives markup changes; breaks on wording or locale changes.
 *   heuristic - structural guesses ("the longest text block in main"). Works
 *               today, expected to need revision.
 */
export type StrategyConfidence = 'url' | 'semantic' | 'textual' | 'heuristic';

export interface ExtractionContext {
  /** The rendered document to read. */
  readonly document: Document;
  /** The page's own URL. */
  readonly url: string;
  /** Injectable clock, so date-relative extraction is testable. */
  readonly now: Date;
}

export interface Strategy<T> {
  /** Stable identifier that appears in extraction reports. */
  readonly name: string;
  readonly confidence: StrategyConfidence;
  /** One line describing the signal this strategy depends on. */
  readonly describes: string;
  /** Return null to defer to the next strategy. Must never throw. */
  run(context: ExtractionContext): T | null;
}

/**
 * Collects provenance and warnings while an extractor runs.
 * One recorder per extractor invocation.
 */
export class ExtractionRecorder {
  private readonly provenance: FieldProvenance[] = [];
  private readonly warnings: string[] = [];
  private readonly startedAt = Date.now();

  constructor(
    private readonly extractor: string,
    private readonly version: string,
    private readonly pageUrl: string | null,
  ) {}

  /**
   * Run strategies in order and return the first non-null result.
   *
   * A strategy that throws is contained: it is recorded as a warning and the
   * next strategy runs. One broken selector must never abort a whole sync.
   */
  resolve<T>(field: string, strategies: Array<Strategy<T>>, context: ExtractionContext): T | null {
    for (const strategy of strategies) {
      let value: T | null = null;
      try {
        value = strategy.run(context);
      } catch (error) {
        this.warn(
          `strategy ${strategy.name} threw while reading ${field}: ${
            error instanceof Error ? error.name : 'unknown error'
          }`,
        );
        continue;
      }

      if (value !== null && value !== undefined && value !== '') {
        this.provenance.push({ field, strategy: strategy.name, found: true });
        return value;
      }
    }

    this.provenance.push({ field, strategy: null, found: false });
    return null;
  }

  /** Record a field we resolved without the strategy machinery. */
  note(field: string, strategy: string, found: boolean): void {
    this.provenance.push({ field, strategy, found });
  }

  /**
   * Record a non-fatal problem.
   * Messages must describe STRUCTURE, never page content -- these end up in
   * logs and in the sync run stored server-side.
   */
  warn(message: string): void {
    if (this.warnings.length < 50) this.warnings.push(message);
  }

  /** Field names the extractor looked for and did not find. */
  missingFields(): string[] {
    return this.provenance.filter((entry) => !entry.found).map((entry) => entry.field);
  }

  build(): ExtractionReport {
    return {
      extractor: this.extractor,
      version: this.version,
      pageUrl: this.pageUrl,
      provenance: this.provenance.slice(0, 60),
      warnings: this.warnings,
      durationMs: Date.now() - this.startedAt,
    };
  }
}

/** Convenience constructor so strategy definitions stay readable. */
export function strategy<T>(
  name: string,
  confidence: StrategyConfidence,
  describes: string,
  run: (context: ExtractionContext) => T | null,
): Strategy<T> {
  return { name, confidence, describes, run };
}

/**
 * Page titles that belong to the Classroom app shell rather than to any
 * particular class or assignment.
 *
 * Without this guard, an extractor running against a page that has not
 * finished rendering would happily store an assignment called "Classroom".
 */
const GENERIC_PAGE_TITLES = new Set([
  'classroom',
  'google classroom',
  'classes',
  'classwork',
  'stream',
  'loading',
  'sign in',
  'untitled',
]);

/** True when a document.title is the app shell's, not real content. */
export function isGenericPageTitle(title: string): boolean {
  return GENERIC_PAGE_TITLES.has(title.trim().toLowerCase());
}
