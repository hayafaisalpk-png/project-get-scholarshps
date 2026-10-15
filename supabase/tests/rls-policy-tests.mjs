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
const fixtures = { scholarshipIds: [], articleIds: [] }

async function cleanup() {
  console.log('\n=== cleanup ===')
  if (fixtures.scholarshipIds.length)
    await api(`/rest/v1/scholarships?id=in.(${fixtures.scholarshipIds.join(',')})`, svcCall('DELETE'))
  if (fixtures.articleIds.length)
    await api(`/rest/v1/articles?id=in.(${fixtures.articleIds.join(',')})`, svcCall('DELETE'))
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
