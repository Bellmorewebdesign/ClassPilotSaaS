# Coursen AI

An AI workspace for students. **V1 proves one thing:** a Chrome extension can
sync Google Classroom into the Coursen AI backend using the browser session
the student is *already* signed into — no school password, no Classroom
OAuth, no admin permissions.

> **Scope note.** There is no AI in V1. The "Ask Coursen" buttons are
> visible but disabled placeholders.

---

## Architecture

```
                         YOUR BROWSER
  ┌──────────────────────────────────────────────────────────────┐
  │                                                              │
  │   classroom.google.com          Coursen Sync extension (MV3)   │
  │   (your existing session)       ┌──────────────────────────┐ │
  │          ▲                      │ popup  ── Sync Classroom │ │
  │          │ reads pages you      │   │                      │ │
  │          │ can already open     │   ▼                      │ │
  │          │                      │ service worker           │ │
  │   ┌──────┴───────┐   message    │   │  sync engine         │ │
  │   │ content      │◄─────────────┤   │  · 1 inactive tab    │ │
  │   │ script       ├─────────────►│   │  · sequential        │ │
  │   │ (extractors) │   candidates │   │  · batched upload    │ │
  │   └──────────────┘              └───┼──────────────────────┘ │
  │                                     │                        │
  └─────────────────────────────────────┼────────────────────────┘
                                        │ HTTPS + Bearer token
                                        ▼
                    ┌───────────────────────────────────┐
                    │   Coursen AI API  (Fastify, :4000)│
                    │  ─────────────────────────────────│
                    │   Zod validation (never trust the │
                    │     extension's output)           │
                    │   normalize → dedupeKey → upsert  │
                    │   contentHash → new/updated/same  │
                    │   every query scoped by userId    │
                    └───────────────┬───────────────────┘
                                    │ Mongoose
                                    ▼
                    ┌───────────────────────────────────┐
                    │   MongoDB Atlas                   │
                    │   users · classroom_classes ·     │
                    │   assignments · sync_runs ·       │
                    │   extension_tokens                │
                    └───────────────▲───────────────────┘
                                    │ read-only, server-side
                    ┌───────────────┴───────────────────┐
                    │   Coursen AI web  (Next.js, :3000)│
                    │   / · /dashboard · /classes ·     │
                    │   /classes/[id] · /assignments ·  │
                    │   /assignments/[id]               │
                    └───────────────────────────────────┘

         @classpilot/shared  ──  one definition of every type, Zod
                                  contract and normalizer, imported by
                                  all three apps. No duplicated interfaces.
```

### Repository layout

```
classpilot/
├── apps/
│   ├── api/          Fastify + Mongoose + Zod          (port 4000)
│   ├── web/          Next.js 15 + Tailwind + shadcn/ui (port 3000)
│   └── extension/    Chrome MV3 + TypeScript + esbuild
├── packages/
│   └── shared/       types · Zod contract · normalizers · DTOs
├── docker/           api.Dockerfile · web.Dockerfile · tunnel guide
├── docker-compose.yml
└── .env.example
```

There is no `packages/config`: the root `tsconfig.base.json` and
`eslint.config.mjs` already serve that purpose, and an extra workspace package
holding two JSON files would be indirection without benefit.

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20.11+ (22 recommended) | |
| pnpm | 10+ | `corepack enable && corepack prepare pnpm@latest --activate` |
| Google Chrome | 116+ | For the unpacked extension |
| MongoDB Atlas | free M0 tier | **No local MongoDB required** |
| Docker | optional | Only for the containerised path |

---

## Setup

### 1. Install

```bash
git clone https://github.com/Bellmorewebdesign/ClassPilotSaaS.git
cd ClassPilotSaaS
pnpm install
```

### 2. MongoDB Atlas

1. <https://cloud.mongodb.com> → create a free **M0** cluster.
2. **Database Access** → add a database user (username + password).
3. **Network Access** → add your current IP address.
4. **Connect → Drivers** → copy the connection string.

### 3. Environment

```bash
cp .env.example .env
```

There is **one** `.env`, at the repository root. Both the API and the web app
load it explicitly — they share values (the dev token in particular), and two
files that have to be kept in sync is a bug waiting to happen. A real
environment variable always overrides the file, which is what Docker and CI
rely on.

Edit `.env`:

```bash
# from Atlas, with <password> replaced
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority

# generate your own; do not use the placeholder
DEV_EXTENSION_TOKEN=<paste the output of: openssl rand -hex 32>

# the web app authenticates to the API with the same token in dev mode
CLASSPILOT_API_TOKEN=<the same value>
```

Generate the token:

```bash
openssl rand -hex 32
```

`.env` is gitignored. **No secret is ever committed, and none is compiled into
the extension** — the extension build fails if it detects one.

### 4. Run

```bash
pnpm dev
```

That starts the shared-package watcher, the API on **:4000**, the web app on
**:3000**, and the extension build in watch mode.

Individually:

```bash
pnpm dev:api          # API only
pnpm dev:web          # web only
pnpm build:extension  # one-off extension build
```

Check the API:

```bash
curl http://localhost:4000/health
```

---

## Loading the extension into Chrome

```bash
pnpm build:extension     # produces apps/extension/dist
```

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked**.
4. Select **`apps/extension/dist`** — the `dist` folder, not the repo root.

Pin Coursen Sync to the toolbar so the popup is one click away.

After each rebuild, click the **reload** icon on the Coursen Sync card in
`chrome://extensions`.

### Connecting the extension to the backend

1. Click the Coursen Sync icon → **Settings**.
2. **Workspace API URL**: `http://localhost:4000`
3. **API token**: paste your `DEV_EXTENSION_TOKEN` from `.env`.
4. **Save & test** — it should report `Connected as dev@classpilot.local`.

The token is stored in `chrome.storage.local`, which is local to that Chrome
profile and is **not** synced to your Google account.

### Running a sync

1. Sign in to <https://classroom.google.com> in the same Chrome profile.
2. Open the Coursen Sync popup — it should say **Classroom detected ✓**.
3. Click **Sync Classroom**.

The sync opens **one inactive background tab** and walks it through your
Classwork pages. You can keep using Chrome; focus is never taken. Progress
shows live, and closing the popup does not stop the sync.

When it finishes, open <http://localhost:3000/dashboard>.

---

## What currently syncs

| Field | Source | Reliability |
|---|---|---|
| Class Classroom id | URL `/c/<courseId>` | **High** — URL grammar |
| Class URL | URL | **High** |
| Class name | card link accessible name | Medium |
| Class section | card secondary line | Low — heuristic |
| Class teacher | avatar `alt`, then name-shaped line | Low — heuristic |
| Class room / description | class page labels | Low — heuristic |
| Assignment id | URL `/a/<workId>` | **High** |
| Assignment URL | URL | **High** |
| Assignment title | first heading in `<main>` | Medium |
| Assignment type | URL shape + icon label | Medium |
| Instructions | longest prose block in `<main>` | **Low** — heuristic |
| Due date + raw label | `aria-label`, then `/Due .../` text | Medium, English-only |
| Points | `/N points/` text | Medium, English-only |
| Status | status-word text | Medium, English-only |
| Grade | `/92\/100/` text | Medium |
| Topic | second heading | Low — heuristic |
| Attachment name/URL/type | non-Classroom links in `<main>` | **High** for URL/type |

**Nothing is ever fabricated.** A field that cannot be read is stored as
`null` and the dashboard says *"Not shown in Classroom"*.

### Known extraction limitations

1. **The selectors have not been validated against live Google Classroom.**
   They were written from Classroom's URL grammar and general ARIA
   conventions. The URL-derived fields are safe; everything marked *Medium*
   or *Low* above needs a real page to confirm. See **Refining the extractors**.
2. **English only.** Due dates, points and status are matched on English
   words (`Due`, `points`, `Turned in`). A Classroom in another language will
   return `null` for these.
3. **Instructions use a heuristic** ("the longest prose block"), which can
   pick up a neighbouring block on an unusual layout.
4. **Attachment contents are not read.** V1 records name, link and type only.
5. **Archived classes, announcements and per-student assignments** are not
   synced.
6. **A renamed item with no Classroom id** creates a second record, because
   the fallback dedupe key is derived from the title. Items with ids (the
   normal case) are immune.

---

## Refining the extractors

The extension ships a diagnostics mode for exactly this. It reports page
**structure** — tag names, ARIA roles, counts, text *lengths*, Classroom URLs
with the ids stripped, and which extraction strategies currently match. It
contains **no schoolwork, class names or teacher names**, and a test asserts
that.

1. Open a real Classroom page (home, a Classwork page, an assignment).
2. Coursen Sync popup → **Settings** → **Scraper diagnostics** → **Capture
   diagnostics**.
3. **Copy to clipboard** and share the JSON.

Leave *"Include text samples"* **off** unless you are debugging locally — it
makes the output privacy-sensitive and it must not be shared.

The most useful part is `strategyProbes`, which turns *"the sync came back
empty"* into *"`classroomHome:url-class-anchors` matched 7 links but
`assignmentPage:aria-label-due` matched none"*.

---

## Testing

```bash
pnpm test        # all packages
pnpm typecheck
pnpm lint
```

### Database integration tests

Tests covering upserts, duplicate prevention, user isolation and content-hash
change detection need a **real MongoDB**, because those guarantees come from
unique indexes rather than application logic. Point them at a **scratch**
database — their collections are wiped between tests:

```bash
MONGODB_TEST_URI="mongodb://localhost:27017/classpilot_test" pnpm --filter @classpilot/api test
```

```bash
MONGODB_TEST_URI="mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/classpilot_test" \
  pnpm --filter @classpilot/api test
```

Without `MONGODB_TEST_URI` they try `mongodb-memory-server` and, failing that,
**skip with an explanatory message** rather than failing the build.

> ⚠️ Never point `MONGODB_TEST_URI` at a database you care about.

---

## Docker

```bash
docker compose up -d --build
docker compose logs -f api
docker compose down
```

The compose file intentionally has **no MongoDB service**: Coursen AI uses
Atlas so that local development and the eventual AWS deployment talk to the
same kind of database, rather than hiding connection-string, TLS and IP
allow-list problems until deploy day. A throwaway local Mongo is available
opt-in:

```bash
docker compose --profile mongo-local up -d   # then set MONGODB_URI=mongodb://mongo:27017
```

### Cloudflare Tunnel (optional)

Expose the stack without opening router ports — see
[`docker/cloudflare-tunnel.md`](docker/cloudflare-tunnel.md). Read the
security notes there before leaving a tunnel running.

---

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `MONGODB_URI` | **yes** | — | Atlas connection string. Never logged. |
| `MONGODB_DB_NAME` | no | `classpilot` | Database name |
| `DEV_EXTENSION_TOKEN` | **yes** (dev mode) | — | Extension bearer token. Only its SHA-256 hash is stored. |
| `CLASSPILOT_API_TOKEN` | **yes** (web) | — | Same value; how the web app calls the API |
| `CLASSPILOT_API_URL` | no | `http://localhost:4000` | Where the web app reaches the API, server-side |
| `NEXT_PUBLIC_API_URL` | no | `http://localhost:4000` | Shown in the UI |
| `AUTH_MODE` | no | `dev` | `production` is reserved and refuses to boot |
| `DEV_USER_EMAIL` | no | `dev@classpilot.local` | Development user identity |
| `API_HOST` | no | `127.0.0.1` | Use `0.0.0.0` in containers |
| `API_PORT` | no | `4000` | |
| `CORS_ORIGINS` | no | `http://localhost:3000` | Comma-separated allow-list |
| `ALLOW_EXTENSION_ORIGINS` | no | `true` | Allow `chrome-extension://` origins |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW` | no | `300` / `1 minute` | |
| `LOG_LEVEL` / `LOG_PRETTY` | no | `info` / `false` | |
| `SCRAPER_DEBUG` | no | `false` | Persist extraction reports with each sync run |
| `MAX_BODY_BYTES` | no | `4000000` | Largest accepted sync payload |
| `MONGODB_TEST_URI` | no | — | Scratch database for integration tests |

---

## Security & privacy

- **No Google password, ever.** Coursen AI has no login form for your school
  account and no OAuth flow. It reads pages your browser is already
  authorised to display.
- **No admin bypass.** If Classroom will not show you something, Coursen AI
  cannot see it either.
- **No hardcoded secrets.** The extension build greps its own output and
  fails if a token-shaped string appears in the bundle.
- **`userId` scopes every read and write.** Another user's id returns `404`,
  never `403` — the API does not confirm which ids exist.
- **Redacted logs.** Tokens, `Authorization` headers, cookies and connection
  strings are blanked by pino's serializer, so no call site can leak one.
  Assignment bodies are never logged.
- **No raw HTML stored.** Only normalized, extracted fields.
- **Least-privilege manifest**: `storage`, `tabs` and `classroom.google.com`.
  The API origin is an *optional* permission requested when you save it.
  See [`apps/extension/PERMISSIONS.md`](apps/extension/PERMISSIONS.md).

### V1 authentication is deliberately minimal

One development user, one static bearer token. This is **not** production
authentication, and `AUTH_MODE=production` refuses to boot to make that
impossible to forget. The structure is what matters: every record carries a
`userId`, every query filters by it, and swapping in real auth means
replacing one resolver in `apps/api/src/plugins/auth.ts`.

---

## Cloud readiness

| Concern | Today | Later |
|---|---|---|
| Frontend | Next.js on :3000 | Vercel or AWS |
| API | stateless Fastify container | AWS ECS/Fargate |
| Database | MongoDB Atlas | same Atlas cluster |
| Background work | in-extension | AWS worker + queue |
| Files | not stored | S3 |
| Secrets | `.env` | AWS Secrets Manager |

The API writes nothing to local disk and holds no per-user state in memory,
so it can be replaced or scaled without coordination.

---

## Not built yet (deliberately)

AI assignment help · automatic submission · Google Classroom OAuth · Stripe ·
subscriptions · production auth · AWS Lambda/queues · Drive deep ingestion ·
Docs automation.

## Brand configuration

Public identity, colors, and the waypoint mark are centralized in
[`packages/shared/src/brand.ts`](packages/shared/src/brand.ts). See
[`docs/branding.md`](docs/branding.md) for rename, asset, and rebuild instructions.
Internal `classpilot` package names, database names, environment variables,
and extension storage keys deliberately remain stable.
