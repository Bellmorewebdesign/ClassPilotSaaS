# Coursen AI branding

Coursen AI is a working public brand for the existing ClassPilotSaaS project.
Coursen.ai is display text only: no domain, DNS, deployment host, canonical URL,
or external link has been configured for it.

## Single source of identity

Edit `packages/shared/src/brand.ts` for the product name, short name,
extension name, assistant copy, description, tagline, palette, and waypoint mark.
It exports:

- `brand`: public names, colors, and mark geometry.
- `brandCssVariables()`: existing Tailwind HSL tokens and extension CSS variables.
- `brandMarkup()`: escaped template substitutions for the popup.
- `brandMarkSvg()`: the extension's vector mark.

The web app imports this config for metadata, navigation, onboarding, empty/error
states, and assistant presentation. The extension build resolves its manifest,
popup, CSS variables, and SVG from the same config. The API imports it only for
two existing user-visible messages. Do not use the display names as identifiers
or infer a host from `domainStyleName`.

Manrope is self-hosted in `packages/shared/assets/Manrope.woff` with its OFL
license. Neither app requires a Google Fonts request. The web mark component
uses the shared geometry; the favicon and Chrome toolbar assets are raster
exports of the retained C mark.

A future text rename needs the config plus human-written README/permissions
copy. If the mark or its color changes, also regenerate these raster assets:

- `apps/web/app/favicon.ico`
- `apps/web/public/brand/{favicon-32.png,apple-touch-icon.png}`
- `apps/extension/public/icons/icon{16,32,48,128}.png`

Run `pnpm build` after changing the brand. Extension watch mode watches bundled
code; static templates, fonts, and brand-generated assets require restarting the
watcher or running `pnpm build:extension` again. Load the generated `dist` folder,
not `public` (which contains build-time placeholders).

## Presentation changes

- White surfaces, pale blue accents, Manrope, shared semantic colors, visible
  keyboard focus, reduced-motion support, and the open C waypoint mark.
- Desktop sidebar and mobile bottom navigation with active-route indication.
- Setup steps and connection status; technical installation instructions and
  diagnostics remain available in disclosure panels.
- Dashboard priorities: upcoming seven-day deadlines, Classroom's missing
  status, synced classes, and sync health. Counts use API totals, not preview
  row counts. Upcoming includes all synced statuses and says so explicitly.
- Honest empty states and partial-load errors. Failed counts show a dash.
- Assignment cards retain existing source data, grades, attachments, and links.
  Returned coursework is no longer marked overdue.
- “Ask Coursen” is explicitly marked “Coming later”; no AI backend or fake
  interactive assistant was added.
- Coursen Sync popup, settings, live progress, status messages, and toolbar icons.
  Existing DOM controls and worker messages remain intact.

## Compatibility boundaries

Intentionally retained: repository/package names, `@classpilot/*` imports,
`CLASSPILOT_API_URL` and `CLASSPILOT_API_TOKEN`, the `classpilot` MongoDB name,
collections, API paths, dev identity (`dev@classpilot.local` / existing display
name), `classpilot.settings`, `classpilot.lastSummary`, message types, log
prefixes, archive names, and internal comments/test examples. These preserve
configuration, saved tokens, records, and sync behavior across the rename.

No infrastructure, authentication, database model, extractor, or sync protocol
was changed. The dashboard client now sends already-supported `dueBefore` and
`status` query filters; no new API feature was implemented.

## Validation (2026-09-21)

| Check | Result |
| --- | --- |
| Frozen dependency install | Passed |
| Workspace typecheck | Passed |
| Root ESLint and Next lint | Passed |
| Shared tests | 71 passed, including brand tokens and text contrast |
| Extension tests | 75 passed, including popup hydration, sync/cancel, settings, and local app navigation |
| API tests | 68 passed; 49 database integration tests skipped |
| Root production build | Shared, API, extension, and Next passed |
| Minified extension build | Passed secret scan and bundle budgets: background 12.9 kB, content 25.5 kB, popup 7.0 kB |
| Browser checks | Setup, dashboard, classes, assignments, and both detail pages at 1440, 390, and 320px; no horizontal overflow or client errors |
| State checks | Empty dashboard, partial API failure, not-found page, popup settings and live progress passed |

The MongoDB binary downloaded successfully but could not start in this runtime
(`open: Operation not permitted`, exit 100). The existing test harness therefore
skipped the 49 database-dependent cases. Run them against a disposable database
before merging if this is a required gate:

```bash
MONGODB_TEST_URI="mongodb://localhost:27017/classpilot_test" pnpm --filter @classpilot/api test
```

The test database's collections are cleared by the suite. A real signed-in
Google Classroom sync was not performed here. Browser fixtures were isolated
outside the repository; no example classes or assignments ship in the app.
The web package has no unit-test suite; browser checks cover the changed views.

Install compatibility: the lockfile uses the already-published `tsx@4.23.13`
instead of `4.23.15`, which was too recent for this runtime's release-age policy.
No package was added. `pnpm-workspace.yaml` mirrors the existing esbuild/sharp
build approvals for pnpm 11 and denies other install hooks; the root pnpm 10
configuration remains compatible. No supply-chain policy was relaxed.

## Update a local checkout

From a clean checkout (save any local work first):

```bash
cd ClassPilotSaaS
git fetch origin
git switch codex/coursen-brand-system
git pull --ff-only origin codex/coursen-brand-system
pnpm install --frozen-lockfile
pnpm build
pnpm dev
```

Keep your existing `.env`. `pnpm build` rebuilds the extension. In
`chrome://extensions`, reload the existing unpacked extension from
`apps/extension/dist`, then refresh Classroom tabs so the current content script
is loaded. Keep the same unpacked path to retain the extension's local settings.

Remaining review: verify the new icons at native toolbar size and run a live
Classroom sync in the owner's Chrome profile. No known layout issue remains
in the viewport/state checks above. Dark mode remains outside this light-theme
brand pass; AI remains a future capability.

## Changed files

- `README.md`
- `apps/api/src/routes/dev.ts`
- `apps/api/src/server.ts`
- `apps/extension/PERMISSIONS.md`
- `apps/extension/build.mjs`
- `apps/extension/public/icons/icon128.png`
- `apps/extension/public/icons/icon16.png`
- `apps/extension/public/icons/icon32.png`
- `apps/extension/public/icons/icon48.png`
- `apps/extension/public/manifest.json`
- `apps/extension/public/popup.css`
- `apps/extension/public/popup.html`
- `apps/extension/src/background/index.ts`
- `apps/extension/src/background/syncEngine.ts`
- `apps/extension/src/lib/apiClient.ts`
- `apps/extension/src/popup/main.test.ts`
- `apps/extension/src/popup/main.ts`
- `apps/web/app/assignments/[id]/page.tsx`
- `apps/web/app/assignments/page.tsx`
- `apps/web/app/classes/page.tsx`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/error.tsx`
- `apps/web/app/favicon.ico`
- `apps/web/app/globals.css`
- `apps/web/app/layout.tsx`
- `apps/web/app/loading.tsx`
- `apps/web/app/not-found.tsx`
- `apps/web/app/page.tsx`
- `apps/web/components/assignment-row.tsx`
- `apps/web/components/assistant-card.tsx`
- `apps/web/components/brand-logo.tsx`
- `apps/web/components/states.tsx`
- `apps/web/components/ui/badge.tsx`
- `apps/web/components/ui/button.tsx`
- `apps/web/components/ui/card.tsx`
- `apps/web/components/workspace-nav.tsx`
- `apps/web/lib/api.ts`
- `apps/web/public/brand/apple-touch-icon.png`
- `apps/web/public/brand/favicon-32.png`
- `docs/branding.md`
- `packages/shared/assets/Manrope.woff`
- `packages/shared/assets/OFL.txt`
- `packages/shared/src/brand.test.ts`
- `packages/shared/src/brand.ts`
- `packages/shared/src/index.ts`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
