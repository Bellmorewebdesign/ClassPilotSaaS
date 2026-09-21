import { brand } from '@classpilot/shared';
import { ArrowUp } from 'lucide-react';
import { BrandMark } from '@/components/brand-logo';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function AssistantCard() {
  return (
    <Card className="border-primary/10 bg-secondary/60">
      <CardHeader>
        <div className="mb-3 flex items-center justify-between gap-3">
          <BrandMark />
          <Badge variant="outline" className="bg-card">
            Coming later
          </Badge>
        </div>
        <CardTitle>{brand.assistantTitle}</CardTitle>
        <p className="pt-2 text-sm leading-relaxed text-muted-foreground">
          A little more context for your coursework. AI assistance is not
          available in this version.
        </p>
      </CardHeader>
      <CardContent>
        <div className="rounded-2xl border border-input/60 bg-card p-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {brand.assistantPlaceholder}
          </p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Preview only</span>
            <button
              type="button"
              disabled
              aria-label="AI assistance is not available yet"
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary"
            >
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
