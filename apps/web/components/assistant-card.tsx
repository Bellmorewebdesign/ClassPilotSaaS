import { brand } from '@classpilot/shared';
import { BrandMark } from '@/components/brand-logo';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Ask Coursen, in the workspace.
 *
 * "Leave room for help. Be honest about readiness." (guide page 26). The kit's
 * dashboard concept gives the assistant a Light brand panel, a clear
 * readiness label, and a prompt field - and no answers. This does the same.
 *
 * There is deliberately no simulated response, no typing indicator and no
 * thread: unlike the marketing page this sits beside real coursework, where a
 * fake answer would read as though Coursen had understood it.
 *
 * The three-dot activity mark below is the kit's assistant-activity study. It
 * is a VISUAL STATE only - the kit is explicit that it is "not a claim about
 * hidden reasoning" - so it is shown as a static rest state here, animating
 * only if the assistant is ever actually working.
 */
export function AssistantCard() {
  return (
    <Card className="border-transparent bg-secondary">
      <CardContent className="pt-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <BrandMark size={28} className="h-7 w-7" />
          <span className="text-metadata text-muted-foreground">
            Future concept
          </span>
        </div>

        <h2 className="card-heading text-foreground">{brand.assistantTitle}</h2>
        <p className="mt-2 text-small-body text-muted-foreground">
          {brand.assistantPlaceholder}
        </p>

        {/* Composer, visibly not available. */}
        <div className="mt-5 rounded-md border border-input bg-card px-4 py-3">
          <p className="truncate text-small-body text-muted-foreground/80">
            What should I work on next?
          </p>
        </div>

        <p className="mt-3 text-metadata text-muted-foreground">
          Coursen will answer from your synced coursework. Not available in this
          build.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * The assistant's activity mark, for when the assistant genuinely is working.
 *
 * Exported but unused today - there is nothing to be busy about yet. Kept
 * here so the kit's rhythm (three dots, 0.4s apart, 2.4s cycle) lives with
 * the component it belongs to rather than being reinvented later.
 */
export function AssistantActivity() {
  return (
    <span className="flex items-center gap-1.5" aria-label="Working">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="activity-waypoint h-1.5 w-1.5 rounded-full bg-primary"
          style={{ animationDelay: `${index * 400}ms` }}
        />
      ))}
    </span>
  );
}
