import { CoursenIcon } from '@/components/coursen-icon';
import {
  STATE_PRESENTATION,
  type IntegrationDefinition,
  type IntegrationState,
} from '@/lib/integrations/registry';
import { cn } from '@/lib/utils';

/**
 * One integration, on either surface.
 *
 * Single component driven by the registry rather than four hand-built cards,
 * so adding Calendar support later is a data change. `tone` switches between
 * the light workspace and the dark marketing surface.
 */
export function IntegrationCard({
  definition,
  state,
  /** Optional line of live detail, e.g. "Last sync 2 minutes ago". */
  detail,
  action,
  tone = 'light',
  className,
}: {
  definition: IntegrationDefinition;
  state: IntegrationState;
  detail?: string | null;
  action?: React.ReactNode;
  tone?: 'light' | 'depth';
  className?: string;
}) {
  const presentation = STATE_PRESENTATION[state];
  const depth = tone === 'depth';

  return (
    <div
      className={cn(
        'flex h-full flex-col gap-4 rounded-lg border p-5 transition-colors duration-fast ease-out',
        depth
          ? 'border-depth-line bg-white/[0.03] hover:border-depth-line-strong'
          : 'border-border bg-card',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-md border',
            depth ? 'border-depth-line bg-white/[0.04]' : 'border-border bg-secondary/60',
          )}
        >
          <CoursenIcon name={definition.icon} className={cn('h-5 w-5', definition.tint)} />
        </span>
        <StateBadge state={state} tone={tone} />
      </div>

      <div className="flex-1">
        <h3
          className={cn(
            'card-heading',
            depth ? 'text-depth-ink' : 'text-foreground',
          )}
        >
          {definition.name}
        </h3>
        <p
          className={cn(
            'mt-1.5 text-small-body',
            depth ? 'text-depth-muted' : 'text-muted-foreground',
          )}
        >
          {definition.summary}
        </p>

        {detail ? (
          <p
            className={cn(
              'mt-3 flex items-center gap-1.5 text-metadata font-semibold',
              presentation.tone === 'positive'
                ? 'text-success'
                : presentation.tone === 'warning'
                  ? 'text-error-text'
                  : depth
                    ? 'text-depth-muted'
                    : 'text-muted-foreground',
            )}
          >
            {presentation.tone === 'positive' ? (
              <CoursenIcon name="check" className="h-3.5 w-3.5 shrink-0" />
            ) : null}
            {presentation.tone === 'warning' ? (
              <CoursenIcon name="attention" className="h-3.5 w-3.5 shrink-0" />
            ) : null}
            {/* Busy uses the kit's sweep on a still C, not a spinner. */}
            {presentation.busy ? (
              <svg viewBox="0 0 64 64" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
                <path
                  d="M44.73 44.73 A18 18 0 1 1 44.73 19.27"
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity="0.3"
                  strokeWidth="9"
                  strokeLinecap="round"
                />
                <path
                  d="M44.73 44.73 A18 18 0 1 1 44.73 19.27"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="9"
                  strokeLinecap="round"
                  pathLength={100}
                  className="activity-sweep"
                />
              </svg>
            ) : null}
            {detail}
          </p>
        ) : null}
      </div>

      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

export function StateBadge({
  state,
  tone = 'light',
}: {
  state: IntegrationState;
  tone?: 'light' | 'depth';
}) {
  const { label, tone: stateTone } = STATE_PRESENTATION[state];
  const depth = tone === 'depth';

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-metadata font-semibold',
        stateTone === 'positive' &&
          'border-transparent bg-success-surface text-success',
        stateTone === 'warning' &&
          'border-transparent bg-error-surface text-error-text',
        stateTone === 'active' &&
          (depth
            ? 'border-depth-line-strong bg-depth-accent/10 text-depth-accent'
            : 'border-primary/30 bg-secondary text-primary'),
        stateTone === 'neutral' &&
          (depth
            ? 'border-depth-line bg-white/[0.06] text-depth-muted'
            : 'border-transparent bg-neutral text-muted-foreground'),
      )}
    >
      {label}
    </span>
  );
}
