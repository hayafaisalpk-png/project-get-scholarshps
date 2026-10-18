#!/usr/bin/env node
/**
 * RLS policy integration tests — live database.
 *
 * Verifies the access boundaries described in docs/DATABASE_SCHEMA.md by acting
 * as three distinct identities through the Supabase Data API:
 *
 *   anonymous  — the publishable key with no session
 *   student    — authenticated, holds only the `student` role
 *   author     — authenticated, holds only the `author` role
 *   reviewer   — authenticated, holds only the `reviewer` role
 *   admin      — authenticated, holds `super_admin`
 *
 * IMPORTANT DESIGN NOTE
 * ---------------------
 * A blocked write does NOT necessarily return an HTTP error. PostgREST returns
 * 204 when RLS filters the row out and zero rows matched. Therefore every
 * negative assertion below verifies the resulting DATA STATE (read the row back
 * and confirm it is unchanged) rather than trusting a status code. Asserting on
 * status codes alone produced three false positives during development.
 *
 * Usage:
 *   node supabase/tests/rls-policy-tests.mjs
 *
 * Required environment variables:
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * The suite creates its own users and fixtures and removes them on exit,
 * including on failure.
 */

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY
const PASSWORD = 'RlsTest-4kTn8QvZ2mR9xW!p'

for (const [k, v] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: BASE, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ANON, SUPABASE_SERVICE_ROLE_KEY: SVC })) {
  if (!v) {
    console.error(`Missing ${k}. Copy .env.example to .env.local and set it.`)
    process.exit(2)
  }
}

async function api(path, { key, token, method = 'GET', body, prefer } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      apikey: key ?? ANON,
      Authorization: `Bearer ${token ?? key ?? ANON}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { /* non-json */ }
  return { status: res.status, json, text, ok: res.ok }
}

const svc = (prefer) => ({ key: SVC, prefer, method: 'GET' })
const svcCall = (method, prefer) => ({ key: SVC, method, prefer })

let pass = 0
const failures = []
function check(label, condition, detail = '') {
  if (condition) { console.log(`  PASS  ${label}`); pass++ }
  else { console.log(`  FAIL  ${label}${detail ? `  <- ${detail}` : ''}`); failures.push(label) }
}

const createdUsers = []
const fixtures = { scholarshipIds: [], articleIds: [], mediaIds: [] }

async function cleanup() {
  console.log('\n=== cleanup ===')
  if (fixtures.scholarshipIds.length)
    await api(`/rest/v1/scholarships?id=in.(${fixtures.scholarshipIds.join(',')})`, svcCall('DELETE'))
  if (fixtures.articleIds.length)
    await api(`/rest/v1/articles?id=in.(${fixtures.articleIds.join(',')})`, svcCall('DELETE'))
  if (fixtures.mediaIds.length)
    await api(`/rest/v1/media_assets?id=in.(${fixtures.mediaIds.join(',')})`, svcCall('DELETE'))
  // Rows the new suites create. content_pages and content_reports cascade with
  // the scholarships above; only the standalone slugs need removing.
  for (const slug of ['rls-active', 'rls-inactive', 'rls-anon', 'rls-student'])
    await api(`/rest/v1/content_pages?slug=eq.${slug}`, svcCall('DELETE'))
  await api('/rest/v1/content_reports?details=in.(anon report,forged,no target at all)', svcCall('DELETE'))
  await api('/rest/v1/contact_submissions?email=eq.fixture@example.org', svcCall('DELETE'))
  // Explicit paths rather than a `like` pattern: the fixture set is fixed and
  // known, and an exact list cannot silently stop matching if the wildcard
  // syntax changes. (A `like.rls-*` pattern did exactly that — it left rows
  // behind and they were found by the next run's control assertion.)
  await api('/rest/v1/redirects?from_path=in.(/rls-old-award,/rls-external,/rls-bad-status,/rls-loop)', svcCall('DELETE'))
  for (const id of createdUsers)
    await api(`/rest/v1/user_roles?user_id=eq.${id}`, svcCall('DELETE'))
  for (const id of createdUsers)
    await api(`/rest/v1/profiles?id=eq.${id}`, svcCall('DELETE'))
  for (const id of createdUsers)
    await api(`/auth/v1/admin/users/${id}`, { key: SVC, method: 'DELETE' })
  console.log(`  removed ${createdUsers.length} users and ${fixtures.scholarshipIds.length + fixtures.articleIds.length} fixture records`)
}

async function makeUser(name, role) {
  const email = `rls-${role}-${name}@getscholarship.test`
  await api('/auth/v1/admin/users', {
    ...svcCall('POST'),
    body: { email, password: PASSWORD, email_confirm: true },
  })
  const signin = await api('/auth/v1/token?grant_type=password', {
    key: ANON, method: 'POST', body: { email, password: PASSWORD },
  })
  if (!signin.ok) throw new Error(`sign-in failed for ${role}: ${signin.text}`)
  const { access_token, user } = signin.json
  createdUsers.push(user.id)
  return { token: access_token, id: user.id, email }
}

try {
  // ---------------------------------------------------------------- setup ----
  console.log('=== setup ===')
  const student = await makeUser('a', 'student')
  const author = await makeUser('a', 'author')
  const reviewer = await makeUser('a', 'reviewer')
  const admin = await makeUser('a', 'super_admin')
  console.log(`  created 4 identities`)

  const rolesRes = await api('/rest/v1/roles?select=id,key', svc())
  const roleIds = Object.fromEntries(rolesRes.json.map((r) => [r.key, r.id]))

  await api('/rest/v1/profiles', {
    ...svcCall('POST', 'return=representation'),
    body: [student, author, reviewer, admin].map((u) => ({ id: u.id, email: u.email })),
  })
  await api('/rest/v1/user_roles', {
    ...svcCall('POST', 'return=representation'),
    body: [
      { user_id: student.id, role_id: roleIds.student },
      { user_id: author.id, role_id: roleIds.author },
      { user_id: reviewer.id, role_id: roleIds.reviewer },
      { user_id: admin.id, role_id: roleIds.super_admin },
    ],
  })

  const mkScholarship = (slug, status) => ({
    slug, title: `Fixture ${slug}`, sponsor_name: 'Fixture Sponsor', status,
    published_at: status === 'published' ? new Date().toISOString() : null,
    application_url: 'https://example.org/apply', verification_status: 'verified',
  })
  const schRes = await api('/rest/v1/scholarships', {
    ...svcCall('POST', 'return=representation'),
    body: [
      mkScholarship('rlspub', 'published'),
      mkScholarship('rlsdraft', 'draft'),
      mkScholarship('rlspending', 'pending_review'),
      mkScholarship('rlsarchived', 'archived'),
    ],
  })
  if (!Array.isArray(schRes.json)) throw new Error(`scholarship fixtures failed: ${schRes.status} ${schRes.text}`)
  fixtures.scholarshipIds = schRes.json.map((r) => r.id)

  // PostgREST requires every object in a bulk insert to carry the SAME set of
  // keys (PGRST102 "All object keys must match"), so unused fields are sent as
  // explicit nulls rather than being omitted.
  const nowIso = new Date().toISOString()
  const artRes = await api('/rest/v1/articles', {
    ...svcCall('POST', 'return=representation'),
    body: [
      { slug: 'rlsart-author',    title: 'Author Draft',     content: '<p>a</p>', content_plain: 'a', created_by: author.id, status: 'draft',     published_at: null, scheduled_for: null },
      { slug: 'rlsart-foreign',   title: 'Foreign Draft',    content: '<p>b</p>', content_plain: 'b', created_by: admin.id,   status: 'draft',     published_at: null, scheduled_for: null },
      { slug: 'rlsart-published', title: 'Published Article', content: '<p>c</p>', content_plain: 'c', created_by: admin.id, status: 'published', published_at: nowIso, scheduled_for: null },
      { slug: 'rlsart-scheduled', title: 'Scheduled Article', content: '<p>d</p>', content_plain: 'd', created_by: admin.id, status: 'scheduled', published_at: null, scheduled_for: '2099-01-01T00:00:00Z' },
    ],
  })
  if (!Array.isArray(artRes.json)) throw new Error(`article fixtures failed: ${artRes.status} ${artRes.text}`)
  fixtures.articleIds = artRes.json.map((r) => r.id)
  console.log(`  created ${fixtures.scholarshipIds.length} scholarships, ${fixtures.articleIds.length} articles`)

  // Look up by slug rather than relying on insert order.
  const allIds = await api('/rest/v1/scholarships?select=id,slug', svc())
  const publishedSchId = allIds.json?.find((r) => r.slug === 'rlspub')?.id
  const draftSchId = allIds.json?.find((r) => r.slug === 'rlsdraft')?.id
  if (!publishedSchId || !draftSchId) throw new Error('fixture lookup failed')

  // Read-back helpers use the SERVICE ROLE as ground truth.
  //
  // This matters: verifying a negative assertion through the same identity
  // being tested is wrong, because an author legitimately cannot read their own
  // draft ANONYMOUSLY. Reading back anonymously returns [] and would make a
  // correct "can edit" look like a failure.
  const readSch = (slug) => api(`/rest/v1/scholarships?select=slug,title,status&slug=eq.${slug}`, svc())
  const readArt = (slug) => api(`/rest/v1/articles?select=slug,title,status,published_at&slug=eq.${slug}`, svc())

  // ------------------------------------------------------------ anonymous ----
  console.log('\n=== ANONYMOUS (publishable key, no session) ===')
  const anonSch = await api('/rest/v1/scholarships?select=slug')
  const anonSlugs = (anonSch.json ?? []).map((r) => r.slug)
  check('reads published scholarships', anonSlugs.includes('rlspub'))
  check('cannot read drafts', !anonSlugs.includes('rlsdraft'))
  check('cannot read pending_review', !anonSlugs.includes('rlspending'))
  check('cannot read archived', !anonSlugs.includes('rlsarchived'))

  const anonArt = await api('/rest/v1/articles?select=slug')
  const anonArtSlugs = (anonArt.json ?? []).map((r) => r.slug)
  check('reads published articles', anonArtSlugs.includes('rlsart-published'))
  check('cannot read draft articles', !anonArtSlugs.includes('rlsart-author'))
  check('cannot read SCHEDULED articles before publication', !anonArtSlugs.includes('rlsart-scheduled'))

  await api('/rest/v1/scholarships?slug=eq.rlspub', { method: 'PATCH', body: { title: 'HACKED' } })
  check('UPDATE changes nothing', (await readSch('rlspub')).json[0]?.title === 'Fixture rlspub')

  await api('/rest/v1/scholarships?slug=eq.rlspub', { method: 'DELETE' })
  check('DELETE removes nothing', (await readSch('rlspub')).json?.length === 1)

  await api('/rest/v1/scholarships', { method: 'POST', body: { slug: 'anon-insert', title: 'x', sponsor_name: 'y' } })
  check('INSERT creates nothing', (await api('/rest/v1/scholarships?select=slug&slug=eq.anon-insert', svc())).json?.length === 0)

  for (const [table, label] of [
    ['newsletter_subscribers', 'newsletter subscribers'],
    ['contact_submissions', 'contact submissions'],
    ['audit_logs', 'audit logs'],
    ['user_roles', 'role assignments'],
    ['profiles', 'profiles'],
    ['redirects', 'redirects'],
    ['ad_placements', 'ad placements'],
    ['scholarship_sources', 'scholarship sources'],
    ['scholarship_verification_logs', 'verification logs'],
  ]) {
    const r = await api(`/rest/v1/${table}?select=*`)
    check(`cannot read ${label}`, r.status !== 200 || (r.json ?? []).length === 0, `status=${r.status}`)
  }

  const anonSettings = await api('/rest/v1/site_settings?select=key')
  const keys = (anonSettings.json ?? []).map((r) => r.key)
  check('reads only public settings', keys.includes('general.site_name') && !keys.includes('ads.enabled'), keys.join(','))

  check('reads active taxonomy', (await api('/rest/v1/education_levels?select=slug')).json?.length === 6)

  // -------------------------------------------------------------- student ----
  console.log('\n=== STUDENT ===')
  const sSch = await api('/rest/v1/scholarships?select=slug', { token: student.token })
  const sSlugs = (sSch.json ?? []).map((r) => r.slug)
  check('reads published scholarships', sSch.ok && sSlugs.includes('rlspub'))
  check('cannot read drafts', !sSlugs.includes('rlsdraft'))

  await api('/rest/v1/scholarships', { token: student.token, method: 'POST', body: { slug: 'student-sch', title: 'x', sponsor_name: 'y', created_by: student.id } })
  check('cannot create scholarships', (await api('/rest/v1/scholarships?select=slug&slug=eq.student-sch', svc())).json?.length === 0)

  await api('/rest/v1/articles', { token: student.token, method: 'POST', body: { slug: 'student-art', title: 'x', content: '<p>x</p>', content_plain: 'x', created_by: student.id } })
  check('cannot create articles', (await api('/rest/v1/articles?select=slug&slug=eq.student-art', svc())).json?.length === 0)

  await api('/rest/v1/categories', { token: student.token, method: 'POST', body: { slug: 'student-cat', name: 'X' } })
  check('cannot create taxonomy', (await api('/rest/v1/categories?select=slug&slug=eq.student-cat', svc())).json?.length === 0)

  const escalate = await api('/rest/v1/user_roles', { token: student.token, method: 'POST', body: { user_id: student.id, role_id: roleIds.super_admin } })
  check('cannot self-escalate to super_admin', !escalate.ok, `status=${escalate.status}`)
  // Ground truth via service role: the student's roles must be unchanged.
  const stillStudent = await api(`/rest/v1/user_roles?select=role_id&user_id=eq.${student.id}`, svc())
  check('role assignment unchanged after escalation attempt',
    stillStudent.json?.length === 1 && stillStudent.json[0].role_id === roleIds.student,
    JSON.stringify(stillStudent.json))

  check('cannot read audit logs', (await api('/rest/v1/audit_logs?select=*', { token: student.token })).json?.length === 0)
  check('reads own profile', (await api(`/rest/v1/profiles?select=email&id=eq.${student.id}`, { token: student.token })).json?.length === 1)
  check('cannot read another profile', (await api(`/rest/v1/profiles?select=email&id=eq.${admin.id}`, { token: student.token })).json?.length === 0)
  check('cannot manage settings', (await api('/rest/v1/site_settings?select=key&key=eq.ads.enabled', { token: student.token })).json?.length === 0)

  // --------------------------------------------------------------- author ----
  console.log('\n=== AUTHOR ===')
  const aSch = await api('/rest/v1/scholarships?select=slug', { token: author.token })
  check('reads published scholarships', (aSch.json ?? []).some((r) => r.slug === 'rlspub'))
  check('cannot read other people drafts', !(aSch.json ?? []).some((r) => r.slug === 'rlsdraft'))
  check('cannot read unpublished articles', !(await api('/rest/v1/articles?select=slug&slug=eq.rlsart-foreign', { token: author.token })).json?.length)

  await api('/rest/v1/articles', { token: author.token, method: 'POST', body: { slug: 'author-new', title: 'Author New', content: '<p>x</p>', content_plain: 'x', created_by: author.id, status: 'draft' } })
  check('CAN create own draft', (await api('/rest/v1/articles?select=slug&slug=eq.author-new', svc())).json?.length === 1)
  fixtures.articleIds.push(...(await api('/rest/v1/articles?select=id&slug=eq.author-new', svc())).json.map((r) => r.id))

  await api('/rest/v1/articles?slug=eq.author-new', { token: author.token, method: 'PATCH', body: { title: 'Edited By Author' } })
  check('CAN edit own draft', (await readArt('author-new')).json[0]?.title === 'Edited By Author')

  await api('/rest/v1/articles?slug=eq.author-new', { token: author.token, method: 'PATCH', body: { status: 'published', published_at: new Date().toISOString() } })
  check('CANNOT self-publish', (await readArt('author-new')).json[0]?.status === 'draft')

  await api('/rest/v1/articles?slug=eq.author-new', { token: author.token, method: 'PATCH', body: { status: 'scheduled', scheduled_for: '2099-01-01T00:00:00Z' } })
  check('CANNOT self-schedule', (await readArt('author-new')).json[0]?.status === 'draft')

  await api('/rest/v1/articles?slug=eq.rlsart-foreign', { token: author.token, method: 'PATCH', body: { title: 'STOLEN' } })
  check("CANNOT edit another author's draft", (await readArt('rlsart-foreign')).json[0]?.title === 'Foreign Draft')

  await api('/rest/v1/articles?slug=eq.rlsart-published', { token: author.token, method: 'PATCH', body: { title: 'STOLEN' } })
  check('CANNOT edit a published article', (await readArt('rlsart-published')).json[0]?.title === 'Published Article')

  await api('/rest/v1/articles', { token: author.token, method: 'POST', body: { slug: 'author-sch-attempt', title: 'x', sponsor_name: 'y', created_by: author.id } })
  check('cannot create scholarships', (await api('/rest/v1/scholarships?select=slug&slug=eq.author-sch-attempt', svc())).json?.length === 0)

  check('cannot read audit logs', (await api('/rest/v1/audit_logs?select=*', { token: author.token })).json?.length === 0)

  // ------------------------------------------------------------- reviewer ----
  console.log('\n=== REVIEWER ===')
  check('CAN read unpublished articles for review', (await api('/rest/v1/articles?select=slug&slug=eq.rlsart-foreign', { token: reviewer.token })).json?.length === 1)
  await api('/rest/v1/articles?slug=eq.rlsart-foreign', { token: reviewer.token, method: 'PATCH', body: { title: 'REVIEWER EDIT' } })
  check('CANNOT edit articles', (await readArt('rlsart-foreign')).json[0]?.title === 'Foreign Draft')
  await api('/rest/v1/articles?slug=eq.rlsart-foreign', { token: reviewer.token, method: 'PATCH', body: { status: 'published', published_at: new Date().toISOString() } })
  check('CANNOT publish articles', (await readArt('rlsart-foreign')).json[0]?.status === 'draft')
  const review = await api('/rest/v1/article_reviews', { token: reviewer.token, method: 'POST', body: { article_id: fixtures.articleIds[1], reviewer_id: reviewer.id, decision: 'changes_requested', notes: 'Please revise.' } })
  check('CAN record a review decision', review.ok, `status=${review.status}`)
  await api(`/rest/v1/article_reviews?article_id=eq.${fixtures.articleIds[1]}`, svcCall('DELETE'))

  // ---------------------------------------------------------------- admin ----
  console.log('\n=== ADMIN (super_admin) ===')
  const dSch = await api('/rest/v1/scholarships?select=slug', { token: admin.token })
  const dSlugs = (dSch.json ?? []).map((r) => r.slug)
  check('reads drafts', dSlugs.includes('rlsdraft'))
  check('reads pending_review', dSlugs.includes('rlspending'))
  check('reads archived', dSlugs.includes('rlsarchived'))
  check('reads private settings', (await api('/rest/v1/site_settings?select=key&key=eq.ads.enabled', { token: admin.token })).json?.length === 1)
  check('lists roles', (await api('/rest/v1/roles?select=key', { token: admin.token })).json?.length === 6)

  await api('/rest/v1/scholarships', { token: admin.token, method: 'POST', body: { slug: 'admin-created', title: 'Admin Created', sponsor_name: 'Admin', created_by: admin.id, status: 'draft' } })
  check('CAN create scholarships', (await api('/rest/v1/scholarships?select=slug&slug=eq.admin-created', svc())).json?.length === 1)
  const adminSchId = (await api('/rest/v1/scholarships?select=id&slug=eq.admin-created', svc())).json[0]?.id
  fixtures.scholarshipIds.push(adminSchId)

  await api(`/rest/v1/scholarships?id=eq.${adminSchId}`, { token: admin.token, method: 'PATCH', body: { status: 'published', published_at: new Date().toISOString() } })
  check('CHECK blocks publish without application_url', (await api(`/rest/v1/scholarships?select=status&id=eq.${adminSchId}`, svc())).json[0]?.status === 'draft')

  await api(`/rest/v1/scholarships?id=eq.${adminSchId}`, { token: admin.token, method: 'PATCH', body: { status: 'published', published_at: new Date().toISOString(), application_url: 'http://insecure.example.org' } })
  check('CHECK blocks non-HTTPS application_url', (await api(`/rest/v1/scholarships?select=status&id=eq.${adminSchId}`, svc())).json[0]?.status === 'draft')

  await api(`/rest/v1/scholarships?id=eq.${adminSchId}`, { token: admin.token, method: 'PATCH', body: { status: 'published', published_at: new Date().toISOString(), application_url: 'https://example.org/ok', verification_status: 'verified' } })
  check('CAN publish a complete record', (await api(`/rest/v1/scholarships?select=status&id=eq.${adminSchId}`, svc())).json[0]?.status === 'published')

  check('CANNOT forge audit rows', !(await api('/rest/v1/audit_logs', { token: admin.token, method: 'POST', body: { action: 'forged', entity_type: 'test', entity_id: '1' } })).ok)
  check('CANNOT update audit rows', !(await api('/rest/v1/audit_logs', { token: admin.token, method: 'PATCH', body: { action: 'tampered' } })).ok)
  check('CANNOT delete audit rows', !(await api('/rest/v1/audit_logs', { token: admin.token, method: 'DELETE' })).ok)

  // --------------------------------------------------- provenance view ----
  // Migration 016/017: public provenance lives in an owner-executed view that
  // exposes exactly three columns and only published scholarships. The base
  // table stays CMS-only. Both halves of that promise are asserted here.
  console.log('\n=== PUBLIC PROVENANCE VIEW ===')
  await api('/rest/v1/scholarship_sources', {
    ...svcCall('POST'),
    body: [
      { scholarship_id: publishedSchId, source_url: 'https://example.org/pub', source_name: 'Public source', retrieved_at: new Date().toISOString() },
      { scholarship_id: draftSchId, source_url: 'https://example.org/draft', source_name: 'Draft source', retrieved_at: new Date().toISOString() },
    ],
  })

  const anonSources = await api('/rest/v1/published_scholarship_sources?select=source_url,source_name,retrieved_at')
  check('anon CAN read published provenance', anonSources.ok, `status=${anonSources.status} ${anonSources.text.slice(0, 160)}`)

  const anonSourceUrls = (anonSources.json ?? []).map((r) => r.source_url)
  check('provenance includes the published record', anonSourceUrls.includes('https://example.org/pub'))
  check('provenance EXCLUDES the draft record', !anonSourceUrls.includes('https://example.org/draft'))
  check('provenance view has no `notes` column', !(anonSources.json ?? []).some((r) => 'notes' in r))

  const anonBase = await api('/rest/v1/scholarship_sources?select=*')
  check('anon CANNOT read the sources base table', anonBase.status !== 200, `status=${anonBase.status}`)

  // A student holds no table-level grant difference, so the request succeeds at
  // the privilege layer and is then filtered to zero rows by RLS. Assert on the
  // resulting data, not the status code: a filtered read is a legitimate 200.
  const studentBase = await api('/rest/v1/scholarship_sources?select=*', { token: student.token })
  check('student CANNOT read the sources base table', (studentBase.json ?? []).length === 0, `status=${studentBase.status} rows=${studentBase.json?.length}`)

  const adminBase = await api('/rest/v1/scholarship_sources?select=source_name,notes', { token: admin.token })
  check('admin CAN read the sources base table including notes', adminBase.ok, `status=${adminBase.status}`)

  // ------------------------------------------------- content_pages --------
  // Migration 021. Static legal/about pages are PUBLIC READ of active rows, and
  // write-capability is gated on a permission. The important assertion is the
  // inactive row: it must be invisible to anon without any status filter in the
  // application layer, because that is how a legal page is withdrawn without
  // leaving a dangling footer link.
  console.log('\n=== CONTENT PAGES ===')

  await api('/rest/v1/content_pages', {
    ...svcCall('POST'),
    body: [
      { slug: 'rls-active',   title: 'RLS active page',   body: '<p>visible</p>', status: 'active' },
      { slug: 'rls-inactive', title: 'RLS inactive page', body: '<p>hidden</p>', status: 'inactive' },
    ],
  })

  const anonPages = await api('/rest/v1/content_pages?select=slug&slug=in.(rls-active,rls-inactive)')
  check('anon CAN read active pages', anonPages.ok, `status=${anonPages.status} ${anonPages.text.slice(0, 160)}`)

  const pageSlugs = (anonPages.json ?? []).map((r) => r.slug)
  check('anon sees the active page', pageSlugs.includes('rls-active'))
  check('anon CANNOT see an inactive page', !pageSlugs.includes('rls-inactive'))

  // Write attempts. A filtered insert returns 201 with zero rows rather than an
  // error, so the assertion reads the row back.
  await api('/rest/v1/content_pages', {
    key: ANON, method: 'POST',
    body: { slug: 'rls-anon', title: 'anon attempt', body: '<p>x</p>' },
    prefer: 'return=representation',
  })
  const anonInserted = await api('/rest/v1/content_pages?select=slug&slug=eq.rls-anon', svc())
  check('anon CANNOT insert a content page', (anonInserted.json ?? []).length === 0)

  await api('/rest/v1/content_pages', {
    key: ANON, method: 'PATCH',
    body: { title: 'anon edit' },
  })
  const anonEdited = await api('/rest/v1/content_pages?select=title&slug=eq.rls-active', svc())
  check('anon CANNOT update a content page', !anonEdited.json?.[0]?.title?.includes('anon edit'))

  const studentInsert = await api('/rest/v1/content_pages', {
    key: student.token, method: 'POST',
    body: { slug: 'rls-student', title: 'student attempt', body: '<p>x</p>' },
  })
  const studentInserted = await api('/rest/v1/content_pages?select=slug&slug=eq.rls-student', svc())
  check('student CANNOT insert a content page',
    studentInsert.status !== 201 && (studentInserted.json ?? []).length === 0,
    `status=${studentInsert.status} rows=${studentInserted.json?.length}`)

  // --------------------------------------------------------------- reports --
  // Migrations 010/013/021. `content_reports` is the one public-write table:
  // anyone may file a correction, but only `report.manage` may read them. The
  // insert policy forces status='open' and resolved_at IS NULL, so a forged
  // pre-resolved report must be rejected by the policy, not merely by the app.
  console.log('\n=== CONTENT REPORTS ===')

  // POSITIVE case first. Every other assertion here is a "cannot", and a suite
  // of only denials would still pass if the public write path were broken — which
  // would mean the "Report incorrect information" form fails silently for every
  // visitor while the tests stay green. This is the assertion that makes the
  // denials meaningful.
  // NO `return=representation` here on purpose. That Prefer header makes PostgREST
  // answer with `INSERT ... RETURNING`, which additionally requires SELECT — and
  // anon deliberately has no SELECT on this table. Asking for the row back would
  // report a privilege failure that is the DESIGN, and would mask whether the
  // insert itself worked. Success is therefore verified by reading the row back
  // with the service role, in the control assertion below.
  const goodReport = await api('/rest/v1/content_reports', {
    key: ANON, method: 'POST',
    body: { scholarship_id: publishedSchId, reason: 'incorrect_deadline', details: 'anon report', status: 'open', resolved_at: null },
  })
  check('anon CAN file a legitimate report', goodReport.status === 201,
    `status=${goodReport.status} ${goodReport.text.slice(0, 160)}`)

  const anonReports = await api('/rest/v1/content_reports?select=id')
  check('anon CANNOT read content reports', anonReports.status !== 200 || (anonReports.json ?? []).length === 0,
    `status=${anonReports.status}`)

  const studentReports = await api('/rest/v1/content_reports?select=id', { token: student.token })
  check('student CANNOT read content reports', (studentReports.json ?? []).length === 0, `status=${studentReports.status}`)

  // Control: the row anon just filed is genuinely stored, so the denial above is
  // RLS filtering a real row rather than an empty table answering zero.
  const svcReports = await api('/rest/v1/content_reports?select=id&details=eq.anon report', svc())
  check('the filed report is genuinely stored (control)', (svcReports.json ?? []).length === 1, `rows=${svcReports.json?.length}`)

  const reviewerReports = await api('/rest/v1/content_reports?select=id', { token: reviewer.token })
  check('reviewer (report.manage) CAN read content reports', reviewerReports.ok, `status=${reviewerReports.status}`)

  const adminReports = await api('/rest/v1/content_reports?select=id,details', { token: admin.token })
  check('admin CAN read content reports', adminReports.ok, `status=${adminReports.status}`)

  // Forge a report that arrives already resolved. The insert policy requires
  // status='open' AND resolved_at IS NULL, so RLS must reject it.
  await api('/rest/v1/content_reports', {
    key: ANON, method: 'POST',
    body: { scholarship_id: publishedSchId, reason: 'duplicate', details: 'forged', status: 'resolved', resolved_at: new Date().toISOString() },
  })
  const forged = await api('/rest/v1/content_reports?select=details&details=eq.forged', svc())
  check('anon CANNOT forge a pre-resolved report', (forged.json ?? []).length === 0, `rows=${forged.json?.length}`)

  // The exactly-one-target constraint is enforced by the database, not the app.
  const targetless = await api('/rest/v1/content_reports', {
    key: ANON, method: 'POST',
    body: { reason: 'other', details: 'no target at all', status: 'open', resolved_at: null },
  })
  const targetlessRead = await api('/rest/v1/content_reports?select=details&details=eq.no target at all', svc())
  check('a report with no target is rejected by CHECK', targetless.status !== 201 || (targetlessRead.json ?? []).length === 0,
    `status=${targetless.status} rows=${targetlessRead.json?.length}`)

  // ------------------------------------------------- report triage (UPDATE) --
  // Increment 6 added the triage action, which is the first code path that can
  // MOVE a report. Until now every assertion above was about INSERT or SELECT, so
  // an UPDATE that was granted but broken would not have been caught.
  //
  // The recurring lesson of this suite applies with extra force here: a set of
  // "cannot" assertions passes just as happily against an UPDATE that always
  // fails. The positive cases below prove the permitted path actually writes.
  const triageRow = await api('/rest/v1/content_reports?select=id,status&details=eq.anon report', svc())
  const triageId = Array.isArray(triageRow.json) && triageRow.json.length > 0 ? triageRow.json[0].id : null

  if (!triageId) {
    check('located the report fixture to triage', false, `rows=${triageRow.json?.length}`)
  } else {
    const readReport = async () => {
      const r = await api(`/rest/v1/content_reports?id=eq.${triageId}&select=status,resolved_at,resolution_note`, svc())
      return Array.isArray(r.json) && r.json.length > 0 ? r.json[0] : null
    }

    // The denied case, verified by DATA STATE rather than status code: a blocked
    // write can return 204 with zero rows matched.
    await api(`/rest/v1/content_reports?id=eq.${triageId}`, {
      token: author.token, method: 'PATCH', body: { status: 'reviewing' },
    })
    const afterAuthor = await readReport()
    check('author (no report.manage) CANNOT triage a report',
      afterAuthor?.status === 'open', `status=${afterAuthor?.status}`)

    // The permitted case. `reviewing` is an open status, so `resolved_at` must stay
    // null — that is the other half of content_reports_resolved_consistent.
    const toReviewing = await api(`/rest/v1/content_reports?id=eq.${triageId}`, {
      token: reviewer.token, method: 'PATCH', body: { status: 'reviewing', resolved_at: null, resolution_note: null },
    })
    const afterReviewing = await readReport()
    check('reviewer (report.manage) CAN move a report to reviewing',
      (toReviewing.status === 200 || toReviewing.status === 204) && afterReviewing?.status === 'reviewing',
      `status=${toReviewing.status} row=${afterReviewing?.status}`)

    // THE CONSTRAINT. Setting a closed status WITHOUT resolved_at violates
    // `content_reports_resolved_consistent` and must be rejected by the database.
    // This is asserted positively so the reason `buildReportStatusPatch` writes
    // both fields together is documented by a test, not just a comment.
    const halfClosed = await api(`/rest/v1/content_reports?id=eq.${triageId}`, {
      token: reviewer.token, method: 'PATCH', body: { status: 'resolved' },
    })
    const afterHalfClose = await readReport()
    check('closing a report without resolved_at is rejected by the CHECK',
      halfClosed.status >= 400 && afterHalfClose?.status === 'reviewing',
      `status=${halfClosed.status} row=${afterHalfClose?.status} ${halfClosed.text.slice(0, 120)}`)

    // And the paired write the action actually performs succeeds.
    const resolvedAt = new Date().toISOString()
    const resolve = await api(`/rest/v1/content_reports?id=eq.${triageId}`, {
      token: reviewer.token, method: 'PATCH',
      body: { status: 'resolved', resolved_at: resolvedAt, resolution_note: 'Deadline corrected against the awarding body.' },
    })
    const afterResolve = await readReport()
    check('reviewer CAN resolve a report when status and resolved_at are written together',
      (resolve.status === 200 || resolve.status === 204) && afterResolve?.status === 'resolved' && Boolean(afterResolve?.resolved_at),
      `status=${resolve.status} row=${afterResolve?.status}`)

    // Reopening must clear all three fields, or the inbox would display a
    // correction note against a report that is open again.
    const reopen = await api(`/rest/v1/content_reports?id=eq.${triageId}`, {
      token: reviewer.token, method: 'PATCH', body: { status: 'open', resolved_at: null, resolution_note: null },
    })
    const afterReopen = await readReport()
    check('reopening a report clears resolved_at and the resolution note',
      (reopen.status === 200 || reopen.status === 204) && afterReopen?.status === 'open' &&
      afterReopen?.resolved_at === null && afterReopen?.resolution_note === null,
      `status=${reopen.status} row=${JSON.stringify(afterReopen)}`)
  }

  // ------------------------------------------------------- media assets ----
  // Migration 027. `media_select_public` originally ANDed the archived check
  // with the permission branch, which made an archived row invisible to EVERYONE
  // — including a media manager. The visible symptom was that
  // `UPDATE ... SET archived_at` failed with "new row violates row-level
  // security policy", because an UPDATE's RETURNING clause is filtered by the
  // SELECT policy.
  console.log('\n=== MEDIA ASSETS ===')

  /*
   * `alt_text` is required since migration 030: an asset is either described or
   * explicitly decorative, and the CHECK refuses the third state. This fixture
   * failed to insert until it was given alt text — which is the constraint
   * working, not the test breaking.
   */
  const mediaRow = await api('/rest/v1/media_assets', {
    ...svcCall('POST', 'return=representation'),
    body: [{
      storage_path: `private-media/general/rls-media-${Date.now()}.png`,
      is_public: false,
      file_name: 'rls-media.png',
      mime_type: 'image/png',
      file_size: 128,
      folder: 'general',
      alt_text: 'A placeholder image used by the RLS test suite.',
      uploaded_by: admin.id,
    }],
  })
  if (!Array.isArray(mediaRow.json) || mediaRow.json.length === 0) {
    check('seeded a media asset fixture', false, `${mediaRow.status} ${mediaRow.text.slice(0, 160)}`)
  } else {
    const mediaId = mediaRow.json[0].id
    fixtures.mediaIds = [mediaId]

    // A manager can already read it.
    const managerRead = await api(`/rest/v1/media_assets?id=eq.${mediaId}&select=id`, { token: admin.token })
    check('admin (media.manage) CAN read a private media asset', managerRead.ok, `status=${managerRead.status}`)

    // THE REGRESSION: archiving must succeed. Assert both WITH and WITHOUT
    // `return=representation`, because the WITH-CHECK failure only surfaces
    // when PostgreSQL filters the RETURNING rows through the SELECT policy.
    const archivePlain = await api(`/rest/v1/media_assets?id=eq.${mediaId}`, {
      token: admin.token, method: 'PATCH',
      body: { archived_at: new Date().toISOString() },
    })
    check('archiving a media asset does not trip a WITH-CHECK violation',
      archivePlain.status === 200 || archivePlain.status === 204,
      `status=${archivePlain.status} ${archivePlain.text.slice(0, 160)}`)

    // And the archived row must STILL be readable by the manager. This is the
    // assertion that would have caught the original AND bug.
    const archivedRead = await api(`/rest/v1/media_assets?id=eq.${mediaId}&select=id,archived_at`, { token: admin.token })
    check('an ARCHIVED asset is still visible to a media manager',
      Array.isArray(archivedRead.json) && archivedRead.json.length === 1 && Boolean(archivedRead.json[0].archived_at),
      `status=${archivedRead.status} rows=${archivedRead.json?.length}`)

    // But an anonymous visitor must not see it.
    const anonArchived = await api(`/rest/v1/media_assets?id=eq.${mediaId}&select=id`)
    check('an ARCHIVED private asset is invisible to anon',
      (anonArchived.json ?? []).length === 0,
      `rows=${anonArchived.json?.length}`)

    // A non-manager authenticated user must not see it either.
    const studentArchived = await api(`/rest/v1/media_assets?id=eq.${mediaId}&select=id`, { token: student.token })
    check('an ARCHIVED private asset is invisible to a student',
      (studentArchived.json ?? []).length === 0,
      `rows=${studentArchived.json?.length}`)

    // The alt-text CHECK, asserted from the service role so it is the constraint
    // under test rather than an RLS decision.
    const undescribed = await api('/rest/v1/media_assets', {
      ...svcCall('POST'),
      body: {
        storage_path: `private-media/general/rls-no-alt-${Date.now()}.png`,
        is_public: false,
        file_name: 'rls-no-alt.png',
        mime_type: 'image/png',
        file_size: 64,
        folder: 'general',
        uploaded_by: admin.id,
      },
    })
    check('an asset with neither alt text nor a decorative flag is REFUSED by CHECK',
      undescribed.status >= 400, `status=${undescribed.status}`)

    const decorative = await api('/rest/v1/media_assets', {
      ...svcCall('POST', 'return=representation'),
      body: {
        storage_path: `private-media/general/rls-decorative-${Date.now()}.png`,
        is_public: false,
        file_name: 'rls-decorative.png',
        mime_type: 'image/png',
        file_size: 64,
        folder: 'general',
        is_decorative: true,
        uploaded_by: admin.id,
      },
    })
    check('an asset marked decorative with no alt text is ACCEPTED',
      Array.isArray(decorative.json) && decorative.json.length === 1,
      `status=${decorative.status} ${decorative.text.slice(0, 120)}`)

    if (Array.isArray(decorative.json) && decorative.json.length === 1) {
      fixtures.mediaIds.push(decorative.json[0].id)
    }
  }

  // ------------------------------------------- contact_submissions --------
  // Migration 022. This table had NO select policy at all until then, which made
  // the public contact form a black hole: messages were stored and unreadable.
  // These assertions pin both halves of the fix — CMS reads, and no public read.
  console.log('\n=== CONTACT SUBMISSIONS ===')

  // A row is written through the SERVICE ROLE first. Without it, "student sees
  // zero rows" would pass trivially on an empty table and would prove nothing
  // about RLS — it would only prove the table was empty.
  await api('/rest/v1/contact_submissions', {
    ...svcCall('POST'),
    body: { name: 'Fixture Sender', email: 'fixture@example.org', subject: 'general', message: 'rls fixture message' },
  })

  const anonContact = await api('/rest/v1/contact_submissions?select=id')
  check('anon CANNOT read contact submissions', anonContact.status !== 200, `status=${anonContact.status}`)

  /*
   * From here the SELECT grant EXISTS for `authenticated`, so these requests
   * succeed at the privilege layer and are then filtered to zero rows by RLS.
   * A filtered read is a legitimate 200 — asserting on the status code alone is
   * exactly the false positive this suite's header warns about. The meaningful
   * comparison is against the fixture row, which is proven present below.
   */
  const studentContact = await api('/rest/v1/contact_submissions?select=id', { token: student.token })
  check('student CANNOT read contact submissions', (studentContact.json ?? []).length === 0, `status=${studentContact.status} rows=${studentContact.json?.length}`)

  const authorContact = await api('/rest/v1/contact_submissions?select=id', { token: author.token })
  check('author (no contact.manage) CANNOT read contact submissions', (authorContact.json ?? []).length === 0, `status=${authorContact.status} rows=${authorContact.json?.length}`)

  // super_admin holds contact.manage through the seeded role_permissions.
  const adminContact = await api('/rest/v1/contact_submissions?select=id', { token: admin.token })
  check('admin (contact.manage) CAN read contact submissions', adminContact.ok, `status=${adminContact.status} ${adminContact.text.slice(0, 160)}`)

  // The control: the fixture row is genuinely there and genuinely visible to
  // the permitted role, so the two assertions above are filtering and not an
  // empty table.
  check('admin sees the fixture row (control)', (adminContact.json ?? []).length > 0, `rows=${adminContact.json?.length}`)

  // As above: no `return=representation`, so this is a plain INSERT with no
  // SELECT demand attached to it.
  const anonInsert = await api('/rest/v1/contact_submissions', {
    key: ANON, method: 'POST',
    body: { name: 'Anon', email: 'anon@example.org', subject: 'general', message: 'anon should not be able to write this' },
  })
  check('anon CANNOT write directly to contact_submissions', anonInsert.status !== 201, `status=${anonInsert.status}`)

  // --------------------------------------------------- message triage (UPDATE)
  // Increment 6 added the triage action. As with reports, the denied case alone
  // would pass against an UPDATE that never works, so a positive case follows it.
  const contactRow = await api('/rest/v1/contact_submissions?select=id,status&email=eq.fixture@example.org', svc())
  const contactId = Array.isArray(contactRow.json) && contactRow.json.length > 0 ? contactRow.json[0].id : null

  if (!contactId) {
    check('located the contact fixture to triage', false, `rows=${contactRow.json?.length}`)
  } else {
    const readContact = async () => {
      const r = await api(`/rest/v1/contact_submissions?id=eq.${contactId}&select=status,handled_at,handled_by`, svc())
      return Array.isArray(r.json) && r.json.length > 0 ? r.json[0] : null
    }

    await api(`/rest/v1/contact_submissions?id=eq.${contactId}`, {
      token: author.token, method: 'PATCH', body: { status: 'resolved' },
    })
    const afterAuthor = await readContact()
    check('author (no contact.manage) CANNOT triage a message',
      afterAuthor?.status === 'new', `status=${afterAuthor?.status}`)

    const handledAt = new Date().toISOString()
    const resolve = await api(`/rest/v1/contact_submissions?id=eq.${contactId}`, {
      token: admin.token, method: 'PATCH', body: { status: 'resolved', handled_at: handledAt, handled_by: admin.id },
    })
    const afterResolve = await readContact()
    check('admin (contact.manage) CAN resolve a message and record the handler',
      (resolve.status === 200 || resolve.status === 204) && afterResolve?.status === 'resolved' &&
      Boolean(afterResolve?.handled_at) && afterResolve?.handled_by === admin.id,
      `status=${resolve.status} row=${JSON.stringify(afterResolve)}`)

    // Reopening clears the handler. `contact_submissions` has no CHECK for this —
    // it is a consistency rule of ours — so it is pinned here instead.
    const reopen = await api(`/rest/v1/contact_submissions?id=eq.${contactId}`, {
      token: admin.token, method: 'PATCH', body: { status: 'in_progress', handled_at: null, handled_by: null },
    })
    const afterReopen = await readContact()
    check('reopening a message clears handled_at and handled_by',
      (reopen.status === 200 || reopen.status === 204) && afterReopen?.status === 'in_progress' &&
      afterReopen?.handled_at === null && afterReopen?.handled_by === null,
      `status=${reopen.status} row=${JSON.stringify(afterReopen)}`)
  }

  // ------------------------------------------------------- redirects -------
  // Migration 029. Migration 013 granted INSERT/UPDATE/DELETE on `redirects` to
  // `authenticated` but omitted SELECT, so the CMS could write a redirect and
  // could not read one back — the screen rendered its error state. The SELECT
  // POLICY existed throughout and was reachable only in the sense that a policy
  // with no grant is dead code.
  //
  // The recurring lesson applies with full force: "author CANNOT read" would
  // have passed against the broken feature for the wrong reason (no grant at
  // all), so the positive case for a permitted role is the load-bearing one.
  console.log('\n=== REDIRECTS ===')

  await api('/rest/v1/redirects', {
    ...svcCall('POST'),
    body: { from_path: '/rls-old-award', to_path: '/rls-new-award', status_code: 301 },
  })

  const anonRedirects = await api('/rest/v1/redirects?select=from_path')
  check('anon CANNOT read the redirect map', anonRedirects.status !== 200, `status=${anonRedirects.status}`)

  const studentRedirects = await api('/rest/v1/redirects?select=from_path', { token: student.token })
  check('student CANNOT read the redirect map', (studentRedirects.json ?? []).length === 0, `status=${studentRedirects.status}`)

  const authorRedirects = await api('/rest/v1/redirects?select=from_path', { token: author.token })
  check('author (no seo.manage) CANNOT read the redirect map', (authorRedirects.json ?? []).length === 0, `status=${authorRedirects.status}`)

  const adminRedirects = await api('/rest/v1/redirects?select=from_path,to_path', { token: admin.token })
  check('admin (seo.manage) CAN read the redirect map', adminRedirects.ok, `status=${adminRedirects.status} ${adminRedirects.text.slice(0, 160)}`)
  check('admin sees the fixture rule (control)', (adminRedirects.json ?? []).some((r) => r.from_path === '/rls-old-award'),
    JSON.stringify(adminRedirects.json))

  // And the write path the CMS actually uses, proved rather than assumed.
  const upsert = await api('/rest/v1/redirects?on_conflict=from_path', {
    token: admin.token, method: 'POST',
    prefer: 'resolution=merge-duplicates',
    body: { from_path: '/rls-old-award', to_path: '/rls-newer-award', status_code: 308 },
  })
  const afterUpsert = await api('/rest/v1/redirects?select=from_path,to_path,status_code&from_path=eq./rls-old-award', svc())
  check('admin (seo.manage) CAN edit a redirect',
    (upsert.status === 200 || upsert.status === 201) && afterUpsert.json?.[0]?.status_code === 308,
    `status=${upsert.status} row=${JSON.stringify(afterUpsert.json)}`)

  const authorWrite = await api('/rest/v1/redirects?on_conflict=from_path', {
    token: author.token, method: 'POST',
    prefer: 'resolution=merge-duplicates',
    body: { from_path: '/rls-old-award', to_path: '/rls-hijacked', status_code: 301 },
  })
  const afterAuthorWrite = await api('/rest/v1/redirects?select=to_path&from_path=eq./rls-old-award', svc())
  check('author CANNOT edit a redirect',
    afterAuthorWrite.json?.[0]?.to_path === '/rls-newer-award', `status=${authorWrite.status} row=${JSON.stringify(afterAuthorWrite.json)}`)

  // The database refuses the shapes the CMS form also refuses.
  const loopShape = await api('/rest/v1/redirects', {
    token: admin.token, method: 'POST',
    body: { from_path: '/rls-loop', to_path: '/rls-loop', status_code: 301 },
  })
  check('a self-referential redirect is rejected by CHECK', loopShape.status >= 400, `status=${loopShape.status}`)

  const badStatus = await api('/rest/v1/redirects', {
    token: admin.token, method: 'POST',
    body: { from_path: '/rls-bad-status', to_path: '/rls-new-award', status_code: 404 },
  })
  check('an unsupported status code is rejected by CHECK', badStatus.status >= 400, `status=${badStatus.status}`)

  const httpsTarget = await api('/rest/v1/redirects', {
    token: admin.token, method: 'POST',
    body: { from_path: '/rls-external', to_path: 'https://example.org/x', status_code: 302 },
  })
  check('an https external destination is accepted', httpsTarget.status === 201, `status=${httpsTarget.status} ${httpsTarget.text.slice(0, 120)}`)
} catch (err) {
  console.error('\nSUITE ERROR:', err.message)
  failures.push('suite error: ' + err.message)
} finally {
  await cleanup()
}

console.log(`\n=== RESULT: ${pass} passed, ${failures.length} failed ===`)
if (failures.length) {
  console.log('failed:')
  failures.forEach((f) => console.log('  - ' + f))
  process.exit(1)
}
