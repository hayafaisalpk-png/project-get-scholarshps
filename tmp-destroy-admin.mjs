/**
 * Destroy the temporary super_admin created to verify the admin brand, following the
 * create-and-destroy-in-the-same-run pattern in `supabase/tests/rls-policy-tests.mjs`.
 *
 * Removes the auth user and the `profiles` row the bootstrap created. The
 * `admin_audit_log` entries it wrote are deliberately LEFT ALONE: an audit trail is
 * append-only, and deleting rows from it to tidy up after a test would be the wrong
 * instinct in a system whose whole point is that privileged actions are recorded.
 */

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!URL_BASE || !SVC) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set.')
  process.exit(1)
}

const EMAIL = 'brand-size-check@example.com'
const call = (path, method = 'GET') => ({
  key: SVC,
  method,
  apikey: SVC,
  Authorization: `Bearer ${SVC}`,
})

async function api(path, options) {
  const res = await fetch(`${URL_BASE}${path}`, options)
  const text = await res.text()
  if (!res.ok) throw new Error(`${options.method} ${path} -> ${res.status}: ${text}`)
  return text
}

/* Find the user id. */
const list = JSON.parse(
  await api(`/auth/v1/admin/users?page=1&per_page=200`, call()),
)
const user = list.users?.find((u) => (u.email ?? '').toLowerCase() === EMAIL)

if (!user) {
  console.log(`No auth user for ${EMAIL} — nothing to remove.`)
} else {
  await api(`/rest/v1/profiles?id=eq.${user.id}`, call(`/rest/v1/profiles?id=eq.${user.id}`, 'DELETE'))
  await api(`/auth/v1/admin/users/${user.id}`, call(`/auth/v1/admin/users/${user.id}`, 'DELETE'))
  console.log(`Removed auth user ${user.id} (${EMAIL}) and its profiles row.`)
}

console.log('Audit log rows left in place, by design.')