'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CoursenIcon, type CoursenIconName } from '@/components/coursen-icon';
import { cn } from '@/lib/utils';

/**
 * Kit interface icons, not a generic set: "Quiet geometry. Consistent
 * weight." They share a 24x24 frame and a 1.8 stroke with everything else in
 * the workspace.
 */
const LINKS: Array<{ href: string; label: string; icon: CoursenIconName }> = [
  { href: '/dashboard', label: 'Overview', icon: 'overview' },
  { href: '/assignments', label: 'Assignments', icon: 'assignment' },
  { href: '/classes', label: 'Classes', icon: 'classes' },
  { href: '/integrations', label: 'Integrations', icon: 'source' },
];

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
      {LINKS.map(({ href, label, icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group relative flex items-center font-medium transition-colors duration-fast ease-out',
              mobile
                ? 'min-h-[3.25rem] flex-col justify-center gap-1 rounded-md px-1 text-metadata'
                : 'min-h-11 gap-3 rounded-md px-3 py-2.5 text-small-body',
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

            <CoursenIcon
              name={icon}
              className={cn(
                'relative shrink-0',
                mobile ? 'h-[20px] w-[20px]' : 'h-[18px] w-[18px]',
              )}
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
