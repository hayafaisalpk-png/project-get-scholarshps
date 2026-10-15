# System Architecture

Status: **Phase 1 foundation implemented.** Layers below are the target
architecture; items not yet built are marked *(planned)*.

---

## 1. Architectural principles

1. **Server-first rendering.** Public pages are Server Components rendered on
   the server. Client Components are the exception, not the default.
2. **The database is the source of truth.** No content, taxonomy, navigation or
   settings are hardcoded in components.
3. **Authorization is enforced twice** — server-side in every handler, and by
   Row Level Security in PostgreSQL. Either layer alone is insufficient.
4. **Least privilege.** Browser code uses the publishable key. The service-role
   key is server-only and used for a short, explicit list of operations.
5. **Secure by default.** Deny by default in RLS; allow-list everything.
6. **Cacheable public content, never private content.** Shared caches must never
   receive an authenticated response.

---

## 2. System context

```
                    ┌──────────────────────────────┐
   Visitors  ──────▶│  Vercel Edge Network (CDN)   │
   Search engines   └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │  Next.js 16 App Router        │
                    │  (Node runtime, Turbopack)    │
                    │  ├─ Server Components         │
                    │  ├─ Route Handlers / Actions  │
                    │  └─ proxy.ts (session refresh)│
                    └───────┬───────────┬──────────┘
                            │           │
           ┌────────────────▼──┐   ┌────▼─────────────────┐
           │ Supabase Auth     │   │ Supabase Postgres     │
           │ (JWT + cookies)   │   │ + RLS                 │
           └───────────────────┘   └────┬─────────────────┘
                                        │
                                 ┌──────▼───────┐
                                 │ Supabase     │
                                 │ Storage      │
                                 └──────────────┘

   External: scholarship provider sites (outbound apply links),
             Google AdSense / GA4 (consent-gated),
             optional Redis (rate limiting)
```

---

## 3. Request lifecycle

### 3.1 Public page request
1. CDN checks cache. Public scholarship/article pages may be served from cache.
2. `src/proxy.ts` runs. It creates a Supabase server client bound to the
   request cookies, calls `auth.getClaims()` to refresh the token, and returns
   a response carrying the refreshed cookie plus no-store cache headers.
3. The route's Server Component executes a server-side Supabase query. RLS
   restricts the result to published rows for the anonymous role.
4. HTML is streamed. Contentful pages may be statically generated and
   revalidated on publish.

### 3.2 Mutation (Server Action)
1. `'use server'` action receives the request.
2. Origin is validated against `APP_ORIGIN` (CSRF defence).
3. Input is parsed with a Zod schema. Invalid input returns a typed error;
   nothing is written.
4. The caller's claims are resolved with `auth.getClaims()`.
5. A role/permission check runs server-side (`requirePermission()`).
6. The mutation executes through the *session* Supabase client, so RLS applies
   a second, independent check.
7. Affected tags are revalidated (`updateTag` for immediate, `revalidateTag`
   for background).
8. For privileged actions, an audit-log row is written.

### 3.3 Scheduled publication *(planned)*
A time-triggered route handler (Vercel Cron) promotes `scheduled` articles and
articles whose `published_at` has passed. Idempotent — safe to run repeatedly.

---

## 4. Source layout

```
src/
├── app/                     Routes only
│   ├── (public)/            Public site route group
│   ├── admin/               Authenticated CMS
│   ├── auth/                Login / register / reset
│   ├── api/                 Route handlers (newsletter, contact, cron, webhooks)
│   ├── sitemap.ts
│   ├── robots.ts
│   └── layout.tsx
├── components/
│   ├── ui/                  Design-system primitives (button, card, dialog, …)
│   ├── layout/              Header, footer, container, breadcrumbs
│   └── analytics/           Consent gate, GA4, AdSense slot
├── features/
│   ├── scholarships/        Search, filters, cards, detail, forms, queries
│   ├── articles/            Editor, renderer, listing, review workflow
│   ├── auth/                Login/register forms, session helpers
│   └── admin/               Admin shell, tables, filters, dialogs
├── lib/
│   ├── supabase/            client.ts | server.ts | admin.ts | proxy.ts
│   ├── seo/                 Metadata builders, JSON-LD, canonical helpers
│   ├── security/            Headers, CSRF, rate limiting, URL safety, sanitize
│   ├── validation/          Shared Zod schemas
│   ├── env.ts               Zod-validated environment access
│   └── utils/               cn(), dates, currency, slug
├── types/                   Shared TypeScript types
└── proxy.ts                 Session refresh (Next 16 `proxy` convention)

supabase/
├── migrations/              Version-controlled SQL
├── seed.sql                 Safe development seed
└── config.toml              Supabase CLI config

tests/
├── unit/                    Pure logic (Vitest)
├── integration/             With mocked Supabase clients (Vitest)
└── e2e/                     Browser journeys (Playwright)
```

---

## 5. Data access patterns

- **No client-side filtering of the full dataset.** Search runs in PostgreSQL
  with full-text search plus indexed filters, paginated server-side.
- **No N+1 queries.** Relationship data is selected in a single query using
  embedded resource syntax (`categories(*)`), and lists use joins or views.
- **Pagination** is offset-based for admin tables (simple, correct) and
  keyset-friendly ordering for public listings.
- **Counts** for facets are computed with a single aggregate query, not by
  loading rows.

---

## 6. Caching strategy

| Data | Strategy |
| --- | --- |
| Published scholarship / article detail | Static generation + tag-based revalidation on publish/update |
| Search and listing pages | Dynamic (searchParams-driven), short revalidation |
| Taxonomy landing pages | Static + revalidated on taxonomy or content change |
| Admin pages | Always dynamic, `private, no-store` |
| Auth pages | Always dynamic, `private, no-store` |
| Images | Next Image optimizer, Supabase Storage CDN, 4h minimum TTL |

Cached pages must never contain user-specific data. The `proxy` stamps
`Cache-Control: private, no-store` on responses that carry session cookies.

---

## 7. Authentication and authorization

- Supabase Auth issues JWTs; `@supabase/ssr` stores them in HTTP-only cookies.
- **Identity:** `auth.getClaims()` (verifies signature). `getSession()` is
  never used for authorization.
- **Roles:** `roles`, `permissions`, `role_permissions`, `user_roles`.
- **Server gate:** `requireUser()` / `requirePermission()` used by every
  protected route and mutation.
- **Database gate:** RLS policies keyed on a `SECURITY DEFINER` helper that
  reads the caller's roles from the JWT, so policies cannot be bypassed by
  simply changing application code.

Planned roles: `super_admin`, `admin`, `editor`, `author`, `reviewer`,
`student`. A student has no administrative permission of any kind.

---

## 8. External integrations

| Integration | Status | Notes |
| --- | --- | --- |
| Supabase (Postgres, Auth, Storage) | Structure ready, **no live project** | Requires credentials |
| Google AdSense | Planned (Phase 6) | Consent-gated, disabled in non-production |
| Google Analytics 4 | Planned (Phase 6) | Consent-gated; no PII in events |
| Upstash Redis | Optional | Rate limiting; in-memory fallback is per-instance and weaker |
| SMTP | Optional | Auth email via Supabase SMTP provider |

---

## 9. Performance strategy

- Server Components by default; minimal client JavaScript.
- Images via `next/image` with explicit `sizes` to avoid CLS.
- Fonts self-hosted by `next/font` — no render-blocking third-party requests.
- Facet counts and lists computed in SQL.
- Targets: LCP < 2.5s, INP < 200ms, CLS < 0.1 at the 75th percentile.

---

## 10. Observability

- Server-side error boundaries with sanitized messages (no stack traces or
  secrets sent to the client).
- Structured logging on the server; admin actions recorded in `audit_logs`.
- Analytics limited to privacy-safe, non-identifying events.
