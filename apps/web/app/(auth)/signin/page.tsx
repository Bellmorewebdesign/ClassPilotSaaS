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
      title="Welcome back."
      lede="Sign in to your workspace."
      footer={
        <>
          New to {brand.shortName}?{' '}
          <Link
            href="/signup"
            className="font-semibold text-primary underline underline-offset-4"
          >
            Get started
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <SignInForm next={next} />

        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-border" />
          <span className="text-metadata uppercase tracking-[0.1em] text-muted-foreground">
            Or
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <GoogleButtonPreview label="Continue with Google" />
      </div>
    </AuthCard>
  );
}
