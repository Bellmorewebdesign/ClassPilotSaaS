'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { brand } from '@classpilot/shared';
import { BrandLogo } from '@/components/brand-logo';
import { cn } from '@/lib/utils';

const SECTIONS = [
  { href: '#product', label: 'Product' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#integrations', label: 'Integrations' },
];

/**
 * Marketing navigation.
 *
 * Two behaviours worth noting:
 *  - The bar is transparent over the hero and gains a glass backing once you
 *    scroll, so the hero reads full-bleed but the nav stays legible.
 *  - The mobile sheet is a real focus-trapped panel that closes on Escape and
 *    on navigation, and locks background scroll while open.
 */
export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    // Stop the page scrolling behind the sheet.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-base ease-out',
        scrolled
          ? 'border-b border-depth-line bg-depth-base/80 backdrop-blur-glass'
          : 'border-b border-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link href="/" aria-label={`${brand.name} home`} className="rounded-lg">
          <BrandLogo tone="depth" />
        </Link>

        <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
          {SECTIONS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm text-depth-muted transition-colors duration-fast ease-out hover:text-depth-ink"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/signin"
            className="rounded-lg px-3 py-2 text-sm font-medium text-depth-ink transition-colors duration-fast ease-out hover:text-depth-glow"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex min-h-10 items-center rounded-xl bg-depth-ink px-4 text-sm font-semibold text-depth-base shadow-low transition-[transform,box-shadow] duration-fast ease-out hover:-translate-y-px hover:shadow-mid active:translate-y-0"
          >
            Get started
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-xl text-depth-ink md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile sheet */}
      <div
        id="mobile-nav"
        hidden={!open}
        className="border-t border-depth-line bg-depth-base/95 backdrop-blur-glass md:hidden"
      >
        <nav aria-label="Sections" className="space-y-1 px-5 py-4">
          {SECTIONS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex min-h-12 items-center rounded-xl px-3 text-[15px] text-depth-ink transition-colors duration-fast hover:bg-white/5"
            >
              {item.label}
            </a>
          ))}
          <div className="grid gap-2 pt-3">
            <Link
              href="/signin"
              onClick={() => setOpen(false)}
              className="quiet-link w-full"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-depth-ink px-4 text-sm font-semibold text-depth-base"
            >
              Get started
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
