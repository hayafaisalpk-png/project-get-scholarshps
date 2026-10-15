# Changelog

All notable changes to GetScholarship are recorded here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) conventions.
A change is only recorded as **done** when it was actually implemented and
verified by running the relevant command.

---

## [Unreleased]

Nothing yet beyond the initial Phase 1 foundation below.

---

## [0.1.0] — 2026-10-15

Phase 1: repository audit and project foundation.

### Added

**Project scaffolding**
- Next.js 16.4.0 with App Router and Turbopack.
- React 19.3.1, TypeScript 5.9.3 (`strict` plus `noUncheckedIndexedAccess`,
  `noImplicitOverride`, `noFallthroughCasesInSwitch`).
- Tailwind CSS 4.3.3 configured CSS-first (no `tailwind.config.js`).
- ESLint 10.12.0 flat config via `eslint-config-next@16.4.0`.
  `next lint` no longer exists in Next 16, so linting runs through the CLI.
- Vitest 5.0.5 (jsdom) for unit and integration tests.
- Playwright 1.64.1 for end-to-end tests, with desktop-Chrome and Pixel 7
  projects.
- Git repository initialised on `main`.

**Design system**
- `src/app/globals.css` defining Tailwind v4 `@theme` tokens: brand blue,
  accent green, deadline amber, ink neutrals, semantic surfaces, radii,
  elevation shadows and motion easing.
- Base layer: visible focus rings, reduced-motion support, semantic typography,
  skip-link utility.
- Component layer: `.container-page`, `.prose-editorial`.
- Utility layer: `.no-scrollbar`.

**Supabase integration (structure only)**
- `src/lib/supabase/client.ts` — browser client, publishable key only.
- `src/lib/supabase/server.ts` — request-scoped server client with cookie
  handling; Server Component cookie-write limitation handled per Supabase
  guidance.
- `src/lib/supabase/admin.ts` — service-role client, server-only, throws
  rather than silently falling back to the publishable key.
- `src/proxy.ts` — Next 16 `proxy` convention (replaces `middleware`); refreshes
  the session via `auth.getClaims()` and returns the response carrying refreshed
  cookies with no-store cache headers.

**Configuration**
- `src/lib/env.ts` — Zod-validated environment access with separate public and
  server schemas, plus site-URL helpers. Fails loudly with actionable messages.
- `next.config.ts` — security headers (HSTS, `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`), `noindex` and
  `no-store` on `/admin` and `/auth`, restricted `next/image` remote patterns.
- `.env.example` — full variable reference containing no secrets.
- `.gitignore` — excludes all real environment files and local tooling state.

**Documentation**
- `AGENTS.md`, `docs/PROJECT_OVERVIEW.md`, `docs/SYSTEM_ARCHITECTURE.md`,
  `docs/DATABASE_SCHEMA.md`, `docs/SECURITY_POLICY.md`,
  `docs/SEO_GUIDELINES.md`, `docs/DEVELOPMENT_ROADMAP.md`,
  `docs/DEPLOYMENT_GUIDE.md`, `docs/CHANGELOG.md`.

### Fixed

- `src/proxy.ts`: `createServerClient` returns a Supabase client, not a
  `NextResponse`. The upstream Supabase documentation snippet assigns it to
  `supabaseResponse`, which is incorrect; this implementation uses a separate
  `supabase` binding and returns the response built by `setAll`. Without this,
  refreshed tokens would be dropped and users would be signed out at random.

### Decisions

- **TypeScript pinned to 5.9.3**, not the current 7.x release line, because
  TypeScript 7's ecosystem support (notably Next.js type generation) is not yet
  established. The specification required `strict` mode but did not pin a
  TypeScript version. To be revisited.
- **Next.js pinned to exactly 16.4.0** as specified. 16.4.1 is available; moving
  to it requires approval.
- **ESLint 10** rather than 9, matching the flat-config direction of Next 16.
- **CSS-first Tailwind v4** — design tokens live in `@theme`, not a JS config.
- **Next.js 16 constraints applied**: `proxy.ts` instead of `middleware.ts`;
  `params`/`searchParams` are Promises; ESLint CLI instead of `next lint`;
  Turbopack by default.

### Verification

```
npm run typecheck   →  clean
npm run lint        →  0 errors, 0 warnings
npm run test        →  3 passed (1 file)
npm run build       →  compiled successfully, 3 static pages, proxy registered
```

### Known limitations

- **No Supabase project is provisioned.** The Supabase clients compile and are
  structurally correct but have never been exercised against a live project.
- `.env.local` on the maintainer's machine holds placeholder, non-functional
  values so that the build can run.
- No database migrations exist yet (Phase 2).
- `src/app/page.tsx` is an explicit placeholder, replaced in Phase 3.
- No authentication UI, no admin, no search, no SEO routes beyond base metadata.
- Nothing has been deployed.
