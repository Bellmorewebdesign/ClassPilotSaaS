import { ArrowUp, Sparkles } from 'lucide-react';
import { brand } from '@classpilot/shared';
import { BrandMark } from '@/components/brand-logo';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Ask Coursen, in the workspace.
 *
 * Shows the questions the assistant is being built to answer and nothing
 * else. There is no fake response, no typing indicator, no simulated thread -
 * the composer is visibly disabled and every affordance says "preview".
 *
 * Faking an answer here would be the most misleading thing in the product,
 * because unlike the marketing page this sits beside the user's real data and
 * would read as though it had understood it.
 */
const SUGGESTIONS = [
  'What do I have due this week?',
  'Anything missing?',
  'What should I work on first?',
] as const;

export function AssistantCard() {
  return (
    <Card className="border-primary/15 bg-secondary/40">
      <CardContent className="pt-6">
        <div className="mb-4 flex items-center gap-2.5">
          <BrandMark className="h-6 w-6" />
          <h2 className="text-[15px] font-semibold">{brand.assistantTitle}</h2>
          <Badge variant="outline" className="ml-auto bg-card text-[10px]">
            In development
          </Badge>
        </div>

        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Once more of your school connects, Coursen will answer from your own
          coursework.
        </p>

        <ul className="mt-4 space-y-1.5">
          {SUGGESTIONS.map((prompt) => (
            <li
              key={prompt}
              className="flex items-start gap-2 rounded-lg border bg-card px-3 py-2.5 text-[13px] leading-snug text-muted-foreground"
            >
              <Sparkles
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              {prompt}
            </li>
          ))}
        </ul>

        {/* Disabled composer. Present so the intended shape is legible. */}
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-input/50 bg-card/60 p-2 pl-3.5">
          <span className="flex-1 truncate text-[13px] text-muted-foreground/70">
            {brand.assistantPlaceholder}
          </span>
          <button
            type="button"
            disabled
            aria-label={`${brand.assistantTitle} is not available in this build`}
            className="flex h-9 w-9 shrink-0 cursor-not-allowed items-center justify-center rounded-lg bg-secondary text-primary/50"
          >
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
