# Security Policy

Status: **Phase 1 controls implemented.** Controls marked *(planned)* land in
later phases. This document defines the target security posture and the rules
that every change must uphold.

---

## 1. Security principles

1. **Deny by default.** A capability exists only because a policy explicitly
   grants it. Missing configuration must fail closed.
2. **Defense in depth.** Authorization is enforced both in application code and
   in PostgreSQL Row Level Security. Compromising one layer must not be enough.
3. **Least privilege.** The browser holds only the publishable key. Privileged
   credentials exist only in server-side environment variables.
4. **Validate at the boundary.** Every request body, form field, query
   parameter and file upload is untrusted until validated.
5. **Fail loudly in development, fail quietly in production.** Detailed errors
   for engineers; generic messages for users.

---

## 2. Threat model

| Threat | Control |
| --- | --- |
| Session forgery | JWT signature verified via `auth.getClaims()`. Cookie contents are never trusted directly. |
| Privilege escalation | Server-side permission checks per mutation **and** RLS policies keyed on verified roles. |
| XSS (stored) | TipTap output sanitized **server-side** with an allowlist before storage and again before render. |
| XSS (reflected) | React escaping; no `dangerouslySetInnerHTML` except for already-sanitized editorial HTML. |
| CSRF | Server Actions are origin-checked against `APP_ORIGIN`; SameSite cookies; state-changing GETs are not used. |
| SQL injection | Supabase client parameterisation only. No raw string-built SQL from user input. |
| Open redirect | Redirect targets validated to be site-relative or on an explicit host allowlist. |
| IDOR | Ownership/permission checked server-side for every object access; RLS is the backstop. |
| Secret leakage | Service-role key excluded from `NEXT_PUBLIC_*`; build fails if public env is invalid; no secrets in logs or errors. |
| Malicious uploads | MIME + extension allowlist, size cap, randomised storage paths, non-executable bucket, no public bucket for unvalidated files. |
| Search abuse | Rate limiting on search, auth and public forms. |
| Click-fraud / ad abuse | Consent-gated ads; no ads in buttons; server-controlled placement. |
| Cache leakage | Authenticated responses marked `private, no-store`; `proxy` stamps cache headers. |
| Header attacks | CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` set in `next.config.ts`. |

---

## 3. Implemented controls (Phase 1)

### 3.1 Secrets

- `.env.local` is gitignored; only `.env.example` is committed.
- `src/lib/env.ts` validates all environment variables with Zod and fails the
  build with an actionable message when public configuration is invalid.
- `SUPABASE_SERVICE_ROLE_KEY` is read **only** by `src/lib/supabase/admin.ts`,
  which is server-only by construction and throws rather than falling back to
  the publishable key.
- `src/lib/supabase/admin.ts` disables session persistence — the admin client
  never holds an interactive session.

### 3.2 Authentication

- `@supabase/ssr` cookie sessions, HTTP-only.
- `src/proxy.ts` refreshes tokens on every request and returns the response
  carrying refreshed cookies.
- Identity is established with `auth.getClaims()` (signature-verified), never
  `getSession()`.

### 3.3 HTTP headers

Configured in `next.config.ts`:

| Header | Value |
| --- | --- |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | camera, microphone, geolocation, browsing-topics disabled |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Robots-Tag` (on `/admin/**`) | `noindex, nofollow, noarchive` |
| `Cache-Control` (on `/admin/**`, `/auth/**`) | `private, no-store, max-age=0` |

### 3.4 Type safety

- TypeScript `strict` with `noUncheckedIndexedAccess` and `noImplicitOverride`.
- `npm run verify` blocks delivery on type, lint, test or build failures.

---

## 4. Planned controls

### 4.1 Content Security Policy *(Phase 7 — requires live ad/analytics origins)*

A CSP cannot be finalised before the AdSense and GA4 hosts are known. The
intended policy:

- `default-src 'self'`
- `script-src 'self' 'nonce-…' https://pagead2.googlesyndication.com` — note
  that AdSense requires additional domains, which is why the nonce and host list
  must be maintained together.
- `frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com`
- `img-src 'self' data: https: blob:`
- `connect-src 'self' https://*.supabase.co`
- `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`
- `upgrade-insecure-requests` in production

Report-only mode will be deployed first, then enforced.

### 4.2 Authorization *(Phase 2 / 4)*

- `requireUser()` — verified identity, else redirect to sign-in.
- `requirePermission(key)` — verified role grants the permission, else 403.
- Every Server Action and Route Handler calls one of these before touching data.
- UI visibility is a convenience, never the enforcement point.

### 4.3 Input validation *(Phase 4)*

- One Zod schema per input surface, colocated in `src/lib/validation/`.
- Parsed before any database call; unknown keys rejected (`.strict()`).
- Rich text sanitized on the server with an explicit tag/attribute allowlist.

### 4.4 Rate limiting *(Phase 4 / 6)*

Limits planned for sign-in, registration, password reset, newsletter signup,
contact form, search, and content reporting. Redis-backed when
`UPSTASH_REDIS_REST_*` is configured; otherwise an in-memory limiter that is
per-instance and explicitly documented as weaker.

### 4.5 Upload validation *(Phase 4)*

- Allowlist: `image/jpeg`, `image/png`, `image/webp`, `image/avif`, `image/svg+xml`
  (SVG only if sanitised).
- Maximum size (planned 5 MB).
- Server-side magic-byte check, not just the client-declared MIME type.
- Randomised storage keys; original filename retained only as metadata.
- Executable and archive types rejected outright.

### 4.6 URL safety *(Phase 4)*

- Outbound links validated as `http:`/`https:` only.
- `application_url` must be absolute HTTPS and must not point at private or
  loopback hosts (SSRF / open-redirect defence).
- Internal redirects validated to be site-relative.

---

## 5. Roles and permissions

| Role | Scope |
| --- | --- |
| `super_admin` | Everything, including role management and settings. |
| `admin` | Full CMS, no role management. |
| `editor` | Manage articles, scholarships, taxonomy, media. Publish. |
| `author` | Create and edit **own** drafts; submit for review. Cannot publish. |
| `reviewer` | Review and approve/reject; cannot publish or manage users. |
| `student` | Account management only. **No** administrative access of any kind. |

Enforcement is layered: RLS policies plus explicit server-side checks. A student
requesting `/admin` is rejected server-side, not merely hidden.

---

## 6. Data protection

- Newsletter emails are private; only the service-role client may read them.
- Subscriber IP addresses are stored only as a salted hash.
- Analytics events must never carry emails, names, passwords, tokens, or raw
  form values.
- Scholarship data provenance is retained so that corrections are auditable.
- User data export and deletion are available through Supabase dashboard
  tooling; a self-serve path is a backlog item.

---

## 7. Dependency management

- All dependencies are pinned to exact versions in `package.json`.
- `npm audit` is reviewed before each release; unresolved high/critical
  advisories block release.
- `npm ci` is used in CI and on Vercel so builds are reproducible.
- New dependencies require a written justification in `docs/CHANGELOG.md`.

---

## 8. Incident response

1. **Contain** — revoke affected sessions (`supabase.auth.admin`), rotate keys.
2. **Assess** — identify affected tables via `audit_logs` and access logs.
3. **Remediate** — patch the vector, add a regression test.
4. **Communicate** — affected parties notified per applicable law.
5. **Document** — add to `docs/CHANGELOG.md`, including what was and was not
   affected.

---

## 9. Reporting vulnerabilities

Report privately to the site owner. Do not disclose publicly until a fix is
deployed. We aim to acknowledge within 3 business days.

---

## 10. Compliance considerations

The site serves a broad, potentially international audience and is monetised via
advertising. Applicable obligations therefore include cookie consent, consent
signals to advertising partners, and a clear privacy policy. The exact regime
depends on the operator's establishment and audience; this must be confirmed
with qualified counsel before launch in a given jurisdiction.
