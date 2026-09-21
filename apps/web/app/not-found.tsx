import Link from 'next/link';
import { brand } from '@classpilot/shared';
import { BrandMark } from '@/components/brand-logo';
export default function NotFound() {
  return (
    <section className="rounded-2xl border bg-card p-8">
      <BrandMark />
      <h1 className="mt-5 text-2xl font-semibold">
        This page is not in your workspace.
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        It may have moved, or it may not belong to your account.
      </p>
      <Link href="/dashboard" className="action-link mt-6">
        Back to {brand.shortName}
      </Link>
    </section>
  );
}
