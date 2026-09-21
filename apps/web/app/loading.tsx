import { brand } from '@classpilot/shared';
import { BrandMark } from '@/components/brand-logo';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-7">
      <div className="flex items-center gap-3">
        <BrandMark />
        <p className="text-sm text-muted-foreground">
          Opening your {brand.shortName} workspace…
        </p>
      </div>
      <div aria-hidden="true" className="space-y-5">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}
