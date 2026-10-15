# Deployment Guide

Target platform: **Vercel**. Database: **Supabase (production region)**.
Domain: `getscholarship.online`.

Status: **guide only — nothing has been deployed.**

---

## 1. Prerequisites

- [ ] Supabase production project created
- [ ] Vercel account with access to the target team
- [ ] GitHub repository (private until launch)
- [ ] Domain registered and DNS access available
- [ ] AdSense account approved (Phase 6)
- [ ] GA4 property created (Phase 6)

---

## 2. Local setup

```bash
git clone <repo-url>
cd getscholarship
npm ci

copy .env.example .env.local     # Windows
# cp .env.example .env.local     # macOS / Linux
```

Fill in `.env.local`, then:

```bash
npm run dev          # http://localhost:3000
npm run verify       # typecheck + lint + test + build
```

Minimum required variables: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`. The app throws
an actionable error at startup if any of these are missing or malformed.

---

## 3. Supabase setup

### 3.1 Create the project
1. Supabase Dashboard → **New project**.
2. Choose the region closest to the majority of your audience. This cannot be
   changed later without a migration.
3. Record the project URL and the publishable key.
4. Create a **separate** service-role key for server-only use. Store it only in
   the Vercel server environment — never in the repository, never in a
   `NEXT_PUBLIC_` variable.

### 3.2 Apply migrations
```bash
npm i -g supabase
supabase login
supabase link --project-ref <project-ref>

# Preview against a throwaway local database first
supabase db start
supabase db reset                 # local only — NEVER against production

# Apply to the linked project
supabase db push
```

> `supabase db reset` drops and recreates the database. It is safe **only**
> against a local development database. Never point it at production.

### 3.3 Seed (development only)
```bash
supabase db reset        # local only, applies seed.sql automatically
```

`seed.sql` contains no destructive statements, but it is still development
data. Do not run it against production.

### 3.4 Auth configuration
- **Site URL:** `https://getscholarship.online`
- **Redirect URLs:**
  - `https://getscholarship.online/auth/callback`
  - `https://getscholarship.online/auth/confirm`
  - `https://*.vercel.app/auth/**` (preview deployments)
  - `http://localhost:3000/auth/**`
- Enable **email confirmation**.
- Configure an SMTP provider (Supabase's default rate limit is low and the
  built-in `inbucket` mailbox is development-only).
- Templates: set `{{ .SiteURL }}` and a real `EmailFrom`.

### 3.5 Backups
Enable **Point-in-Time Recovery** and confirm the retention window meets the
platform's recovery requirements. Export a manual backup before every schema
migration.

---

## 4. Vercel

### 4.1 Import
1. Vercel Dashboard → **Add New Project** → import the GitHub repository.
2. Framework preset: **Next.js**. Build command and output are auto-detected.
3. Do **not** override the build command; Next 16 uses Turbopack by default.

### 4.2 Environment variables

| Variable | Scope | Value |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | All | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | All | Publishable key |
| `NEXT_PUBLIC_SITE_URL` | Production | `https://getscholarship.online` |
| `SUPABASE_SERVICE_ROLE_KEY` | Production + Preview | **Server only.** Never prefixed `NEXT_PUBLIC_` |
| `APP_ORIGIN` | Production | `https://getscholarship.online` |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Production | GA4 ID (empty until Phase 6) |
| `NEXT_PUBLIC_ADSENSE_CLIENT_ID` | Production | `ca-pub-…` (empty until Phase 6) |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Production | Optional; strongly recommended |
| `SMTP_*`, `EMAIL_FROM` | Production | If sending mail server-side |

Preview deployments should use a **separate Supabase project** so preview data
can never touch production. Leave `NEXT_PUBLIC_ADSENSE_CLIENT_ID` empty in
preview so AdSense policy is never violated by test traffic.

### 4.3 Deploy
Push to `main` (production) or open a PR (preview). Verify the build log shows
`npm run build` succeeding with no TypeScript errors.

---

## 5. Domain and DNS

| Record | Type | Value |
| --- | --- | --- |
| `@` | A / ALIAS | Vercel-assigned target |
| `www` | CNAME | `cname.vercel-dns.com` |

Then in Vercel: add `getscholarship.online` as the primary domain and configure
`www` → apex as a **301 redirect**.

Verify HTTPS is enforced and the certificate has issued before launch.

---

## 6. Post-deploy verification

- [ ] Homepage renders with real database content
- [ ] A known scholarship page loads and its official apply link resolves
- [ ] Search, filters and pagination work
- [ ] Registration → email verification → login → logout works end to end
- [ ] A student account cannot reach `/admin` (server-side rejection, not a redirect loop)
- [ ] An admin can publish a scholarship and the public page appears
- [ ] An expired scholarship still resolves and shows its status
- [ ] Draft content is not reachable and not indexed
- [ ] `https://getscholarship.online/robots.txt` correct; sitemap reachable
- [ ] Canonicals correct on a sample of pages
- [ ] Security headers present
- [ ] `/admin` and `/api` excluded from search engines
- [ ] Consent banner appears; scripts stay absent until consent is granted
- [ ] Mobile and keyboard navigation verified

---

## 7. Scheduled jobs *(planned)*

Vercel Cron for scheduled article publication. Define in `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/publish-scheduled", "schedule": "*/10 * * * *" }
  ]
}
```

The handler must verify a shared secret and be **idempotent**, so running it
repeatedly or concurrently cannot double-publish.

---

## 8. Rollback

1. **Code:** Vercel → Deployments → promote a previous successful build.
2. **Database:** migrations must be forward-only and additive. Write a new
   migration to revert; never hand-edit or drop production tables.
3. **Content:** restore from Point-in-Time Recovery if data corruption occurs.

---

## 9. Maintenance schedule

| Frequency | Task |
| --- | --- |
| Weekly | Dependency audit; review reported scholarship errors |
| Monthly | Verify upcoming deadlines; review expired scholarship handling |
| Quarterly | Backup restore drill; access review; `npm outdated` review |
| Annually | Legal and privacy review; penetration test |
