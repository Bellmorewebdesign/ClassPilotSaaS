import Link from 'next/link';
import type { Metadata } from 'next';
import { brand } from '@classpilot/shared';
import { AuthCard, GoogleButtonPreview } from '@/components/auth/auth-card';
import { SignInForm } from '@/components/auth/signin-form';

export const metadata: Metadata = { title: 'Sign in' };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  // Only a same-site path survives; see signInAction for the matching guard.
  const next =
    params.next?.startsWith('/') && !params.next.startsWith('//')
      ? params.next
      : '/dashboard';

  return (
    <AuthCard
      title={`Sign in to ${brand.shortName}`}
      lede="Open your workspace and pick up where your coursework left off."
      footer={
        <>
          New to {brand.shortName}?{' '}
          <Link
            href="/signup"
            className="font-semibold text-depth-ink underline underline-offset-4"
          >
            Get started
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <SignInForm next={next} />

        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-depth-line" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-depth-muted">
            Or
          </span>
          <span className="h-px flex-1 bg-depth-line" />
        </div>

        <GoogleButtonPreview label="Continue with Google" />
      </div>
    </AuthCard>
  );
}
