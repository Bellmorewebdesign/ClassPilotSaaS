import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'ClassPilot',
  description: 'Your classes and assignments, synced from Google Classroom.',
};

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/classes', label: 'Classes' },
  { href: '/assignments', label: 'Assignments' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
            <Link href="/" className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="h-6 w-6 rounded-md bg-gradient-to-br from-[#0b72d4] to-[#57c2b6]"
              />
              <span className="text-base font-semibold tracking-tight">ClassPilot</span>
            </Link>

            <nav className="flex items-center gap-1 text-sm">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>

        <footer className="mx-auto max-w-6xl px-6 pb-10 pt-4 text-xs text-muted-foreground">
          ClassPilot V1 &middot; development mode &middot; data synced from your own
          Google Classroom session
        </footer>
      </body>
    </html>
  );
}
