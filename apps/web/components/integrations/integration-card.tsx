import { Check, Loader2, TriangleAlert } from 'lucide-react';
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
        'lift flex h-full flex-col gap-4 rounded-xl border p-5',
        depth
          ? 'border-depth-line bg-white/[0.03] hover:border-depth-line-strong'
          : 'border-border bg-card',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border',
            depth ? 'border-depth-line bg-white/[0.04]' : 'border-border bg-secondary/60',
          )}
        >
          <definition.icon
            className={cn('h-5 w-5', definition.tint)}
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </span>
        <StateBadge state={state} tone={tone} />
      </div>

      <div className="flex-1">
        <h3
          className={cn(
            'text-[15px] font-semibold',
            depth ? 'text-depth-ink' : 'text-foreground',
          )}
        >
          {definition.name}
        </h3>
        <p
          className={cn(
            'mt-1.5 text-[13px] leading-relaxed',
            depth ? 'text-depth-muted' : 'text-muted-foreground',
          )}
        >
          {definition.summary}
        </p>

        {detail ? (
          <p
            className={cn(
              'mt-3 flex items-center gap-1.5 text-[12px] font-medium',
              presentation.tone === 'positive'
                ? 'text-[var(--brand-success)]'
                : presentation.tone === 'warning'
                  ? 'text-destructive'
                  : depth
                    ? 'text-depth-muted'
                    : 'text-muted-foreground',
            )}
          >
            {presentation.tone === 'positive' ? (
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
            ) : null}
            {presentation.tone === 'warning' ? (
              <TriangleAlert className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            ) : null}
            {presentation.busy ? (
              <Loader2
                className="h-3.5 w-3.5 animate-spin"
                strokeWidth={2}
                aria-hidden="true"
              />
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
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
        stateTone === 'positive' &&
          'border-[var(--brand-success)]/30 bg-[var(--brand-successSurface)] text-[var(--brand-success)]',
        stateTone === 'warning' &&
          'border-destructive/30 bg-[var(--brand-errorSurface)] text-destructive',
        stateTone === 'active' &&
          (depth
            ? 'border-depth-line-strong bg-depth-glow/10 text-depth-glow'
            : 'border-primary/30 bg-secondary text-primary'),
        stateTone === 'neutral' &&
          (depth
            ? 'border-depth-line bg-white/[0.04] text-depth-muted'
            : 'border-border bg-background text-muted-foreground'),
      )}
    >
      {label}
    </span>
  );
}
