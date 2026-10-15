# GetScholarship

Scholarship discovery and educational content platform for
<https://getscholarship.online>.

Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4,
Supabase (PostgreSQL + Auth + Storage) and Row Level Security.

**Status: Phase 1 complete — foundation only.** The public website, search
engine and CMS are not built yet. See
[`docs/DEVELOPMENT_ROADMAP.md`](docs/DEVELOPMENT_ROADMAP.md) for the
authoritative status and [`docs/CHANGELOG.md`](docs/CHANGELOG.md) for what has
actually been implemented and verified.

---

## Prerequisites

- Node.js **20.9+** (developed on 24.16)
- npm 10+
- A Supabase project (required for Phase 2 onward)

## Quick start

```bash
npm ci
copy .env.example .env.local    # Windows
# cp .env.example .env.local    # macOS / Linux

npm run dev
```

Open <http://localhost:3000>.

The app validates its environment at startup and reports exactly which
variables are missing or malformed.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (flat config) |
| `npm run test` | Vitest unit + integration tests |
| `npm run test:coverage` | Vitest with V8 coverage |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run verify` | typecheck → lint → test → build |

## Environment

Copy `.env.example` to `.env.local`. Required:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL
```

Optional: `SUPABASE_SERVICE_ROLE_KEY` (server-only), `NEXT_PUBLIC_GA_MEASUREMENT_ID`,
`NEXT_PUBLIC_ADSENSE_CLIENT_ID`, `UPSTASH_REDIS_REST_*`, `SMTP_*`.

> **Security:** only `NEXT_PUBLIC_`-prefixed variables reach the browser. The
> Supabase service-role key must never be given that prefix, and is read only by
> `src/lib/supabase/admin.ts` on the server.

## Project layout

```
src/
├── app/           Routes (pages, layouts, handlers, loading/error states)
├── components/    Shared UI primitives and layout
├── features/      scholarships | articles | auth | admin
├── lib/           supabase | seo | security | validation | env
├── types/         Shared TypeScript types
└── proxy.ts       Supabase session refresh (Next 16 `proxy` convention)
supabase/          Migrations and seed data
tests/             unit | integration | e2e
docs/              Technical and operational documentation
```

## Documentation

| Document | Contents |
| --- | --- |
| [`AGENTS.md`](AGENTS.md) | Permanent instructions for AI coding agents |
| [`docs/PROJECT_OVERVIEW.md`](docs/PROJECT_OVERVIEW.md) | Purpose, journeys, scope, integrity rules |
| [`docs/SYSTEM_ARCHITECTURE.md`](docs/SYSTEM_ARCHITECTURE.md) | Layers, request flow, caching |
| [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) | Tables, relationships, indexes, RLS |
| [`docs/SECURITY_POLICY.md`](docs/SECURITY_POLICY.md) | Threat model and controls |
| [`docs/SEO_GUIDELINES.md`](docs/SEO_GUIDELINES.md) | Metadata, JSON-LD, indexation |
| [`docs/DEVELOPMENT_ROADMAP.md`](docs/DEVELOPMENT_ROADMAP.md) | Phases, status, acceptance criteria |
| [`docs/DEPLOYMENT_GUIDE.md`](docs/DEPLOYMENT_GUIDE.md) | Supabase, Vercel, DNS, rollback |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | Dated change history |

## Content integrity

This platform does not publish invented scholarships, award amounts, deadlines
or application links. Every scholarship record carries provenance: an official
source URL, the date it was last checked, and a verification status. Expired
scholarships keep their pages and history. All statistics are derived from live
database queries.

## Contributing

Read [`AGENTS.md`](AGENTS.md) first. All changes must pass `npm run verify`.
