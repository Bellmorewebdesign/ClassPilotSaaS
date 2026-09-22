import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { brand, brandCssVariables, depth } from '@classpilot/shared';
import './globals.css';

/**
 * Root layout.
 *
 * Deliberately thin: fonts, design tokens, and nothing else. The workspace
 * chrome used to live here, which meant the public homepage rendered inside a
 * dashboard sidebar. Each route group now owns its own shell:
 *
 *   (marketing)  public site        - dark depth surface, marketing nav
 *   (auth)       sign in / sign up  - centred, no chrome
 *   (app)        the workspace      - sidebar, light surface, needs a session
 */

const manrope = localFont({
  src: '../../../packages/shared/assets/Manrope.woff',
  variable: '--font-sans',
  display: 'swap',
  weight: '200 800',
});

export const metadata: Metadata = {
  title: { default: `${brand.name} - ${brand.tagline}`, template: `%s · ${brand.shortName}` },
  description: brand.description,
  applicationName: brand.name,
  // Official Brand Kit v2 icon masters. The .ico carries 16/32/48 for legacy
  // surfaces; the SVG is the optically adjusted small-size master, which the
  // kit supplies precisely because the waypoint needs more weight below 32px.
  icons: {
    icon: [
      { url: '/brand/icons/coursen-favicon.ico', sizes: '16x16 32x32 48x48' },
      { url: '/brand/icons/coursen-favicon-32.svg', type: 'image/svg+xml' },
    ],
    apple: { url: '/brand/icons/coursen-app-180.png', sizes: '180x180' },
  },
  // No metadataBase or canonical URL: the working domain is not owned.
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: brand.colors.background },
    { media: '(prefers-color-scheme: dark)', color: depth.base },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={manrope.variable}
      style={brandCssVariables() as React.CSSProperties}
      suppressHydrationWarning
    >
      <head>
        {/*
          Marks the document as scripted before first paint.

          `.reveal` hides content until an IntersectionObserver releases it.
          That hidden state is scoped to `html.js`, so when scripts are off -
          or fail - the class is never added and the page renders fully
          instead of blank. Runs synchronously in <head>, so there is no
          flash of the unhidden state.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js')",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
