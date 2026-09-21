import { LogOut } from 'lucide-react';
import { signOutAction } from '@/app/(auth)/actions';

/**
 * Signed-in identity and sign-out.
 *
 * A form posting a server action rather than a client-side handler, so it
 * works without JavaScript and the cookie is cleared server-side.
 */
export function UserMenu({ email }: { email: string }) {
  const initial = email.trim().charAt(0).toUpperCase() || '?';

  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[13px] font-bold text-primary"
      >
        {initial}
      </span>
      <span className="hidden min-w-0 flex-1 lg:block">
        <span className="block truncate text-[13px] font-medium">{email}</span>
        <span className="block text-[11px] text-muted-foreground">
          Development workspace
        </span>
      </span>
      <form action={signOutAction}>
        <button
          type="submit"
          aria-label="Sign out"
          title="Sign out"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-fast hover:bg-secondary hover:text-foreground"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
