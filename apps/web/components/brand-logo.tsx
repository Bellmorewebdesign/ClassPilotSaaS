import { brand } from '@classpilot/shared';
import { cn } from '@/lib/utils';

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cn('h-10 w-10 shrink-0 text-primary', className)}
    >
      <path
        d={brand.mark.path}
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <circle
        cx={brand.mark.dotX}
        cy={brand.mark.dotY}
        r="4"
        fill="currentColor"
      />
    </svg>
  );
}

export function BrandLogo() {
  return (
    <span className="flex items-center gap-2">
      <BrandMark />
      <span className="text-xl font-bold tracking-[-0.04em]">{brand.name}</span>
    </span>
  );
}
