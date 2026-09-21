'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ListTodo,
  PanelsTopLeft,
  SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const links = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/assignments', label: 'Assignments', icon: ListTodo },
  { href: '/classes', label: 'Classes', icon: PanelsTopLeft },
  { href: '/', label: 'Setup', icon: SlidersHorizontal },
];

export function WorkspaceNav({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label={mobile ? 'Mobile workspace' : 'Workspace'}
      className={cn(mobile ? 'grid grid-cols-4 gap-1' : 'space-y-2')}
    >
      {links.map(({ href, label, icon: Icon }) => {
        const active =
          href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex min-h-11 items-center gap-3 rounded-xl font-medium transition-colors',
              mobile
                ? 'flex-col justify-center gap-1 px-1 py-2 text-[11px]'
                : 'px-4 py-3 text-sm',
              active
                ? 'bg-secondary text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon
              aria-hidden="true"
              className="h-[18px] w-[18px]"
              strokeWidth={1.75}
            />
            {label}
            {active ? (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute rounded-full bg-primary',
                  mobile ? 'bottom-0 h-0.5 w-5' : 'left-0 h-5 w-0.5',
                )}
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
