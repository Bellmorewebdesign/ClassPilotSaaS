'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ListTodo,
  PanelsTopLeft,
  Plug,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/assignments', label: 'Assignments', icon: ListTodo },
  { href: '/classes', label: 'Classes', icon: PanelsTopLeft },
  { href: '/integrations', label: 'Integrations', icon: Plug },
] as const;

/**
 * Workspace navigation, used by both the desktop sidebar and the mobile tab
 * bar.
 *
 * The active indicator is a separate absolutely-positioned element rather
 * than a border, so it can animate without affecting layout.
 */
export function WorkspaceNav({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={mobile ? 'Workspace sections' : 'Workspace'}
      className={cn(mobile ? 'grid grid-cols-4 gap-1' : 'space-y-1')}
    >
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group relative flex items-center font-medium transition-colors duration-fast ease-out',
              mobile
                ? 'min-h-[3.25rem] flex-col justify-center gap-1 rounded-lg px-1 text-[11px]'
                : 'min-h-11 gap-3 rounded-lg px-3 py-2.5 text-[14px]',
              active
                ? 'text-primary'
                : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground',
            )}
          >
            {/* Active pill sits behind the content so the label never shifts. */}
            {active && !mobile ? (
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-lg bg-secondary"
              />
            ) : null}

            <Icon
              aria-hidden="true"
              className={cn(
                'relative shrink-0 transition-transform duration-base ease-out',
                mobile ? 'h-[18px] w-[18px]' : 'h-[17px] w-[17px]',
                !active && 'group-hover:scale-105',
              )}
              strokeWidth={active ? 2 : 1.75}
            />
            <span className="relative">{label}</span>

            {active ? (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute rounded-full bg-primary',
                  mobile ? 'bottom-1 h-1 w-6' : 'left-0 h-5 w-[3px]',
                )}
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
