#!/usr/bin/env node
/**
 * Creates the first administrator account.
 *
 * Why this exists
 * ---------------
 * Sign-up is closed (see `AGENTS.md`). That is the right default for an
 * invitation-only CMS, but it means somebody has to create the very first
 * account out of band, otherwise nobody can ever sign in and the CMS cannot
 * be used at all. This script is that bootstrap, and nothing else.
 *
 * Safety properties:
 *   - Refuses to run unless a service-role key is present. It never falls back
 *     to the publishable key, which cannot create users.
 *   - Refuses to grant `super_admin` to more than one account unless
 *     `--allow-multiple` is passed, so a mistyped run cannot quietly create
 *     several all-powerful accounts.
 *   - Idempotent: re-running reports the existing account rather than creating
 *     a duplicate.
 *   - Creates no content. It provisions an identity only.
 *
 * Usage
 * -----
 *   node supabase/scripts/create-first-admin.mjs you@example.com
 *
 * Environment:
 *   NEXT_PUBLIC_SUPABASE_URL          from .env.local
 *   SUPABASE_SERVICE_ROLE_KEY         from .env.local (server-only)
 *   ADMIN_INITIAL_PASSWORD           the password to set (>= 12 characters)
 *
 * Optional flags:
 *   --role <key>      role to grant; defaults to super_admin
 *   --full-name <s>   display name stored on the profile
 *   --allow-multiple  permit granting super_admin when one already exists
 *
 * After running, sign in at /auth/login with this account. Further staff
 * accounts should be created from the administration area once it exists,
 * never with this script.
 */

import { createClient } from '@supabase/supabase-js'

const args = process.argv.slice(2)

const email = args.find((a) => !a.startsWith('--') && a.includes('@'))
const flags = new Set(args.filter((a) => a.startsWith('--')))

function flagValue(name) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

const roleKey = flagValue('--role') ?? 'super_admin'
const fullName = flagValue('--full-name')
const allowMultiple = flags.has('--allow-multiple')

function fail(message) {
  console.error(`\n  ERROR: ${message}\n`)
  process.exit(1)
}

if (!email) {
  fail(
    'No email address supplied.\n' +
      '  Usage: node supabase/scripts/create-first-admin.mjs you@example.com',
  )
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const password = process.env.ADMIN_INITIAL_PASSWORD

if (!url) fail('NEXT_PUBLIC_SUPABASE_URL is not set. Check .env.local.')
if (!serviceKey) {
  fail(
    'SUPABASE_SERVICE_ROLE_KEY is not set.\n' +
      '  This script performs privileged operations and will not run with the\n' +
      '  publishable key.',
  )
}
if (!password) {
  fail(
    'ADMIN_INITIAL_PASSWORD is not set.\n' +
      '  Set it in your shell before running, for example:\n' +
      '    $env:ADMIN_INITIAL_PASSWORD = "<at least 12 characters>"',
  )
}
if (password.length < 12) {
  fail('ADMIN_INITIAL_PASSWORD must be at least 12 characters.')
}

// Bypasses RLS on purpose: this is a privileged bootstrap path.
const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// --- Resolve the role -------------------------------------------------------

const { data: role, error: roleError } = await supabase
  .from('roles')
  .select('id, key')
  .eq('key', roleKey)
  .maybeSingle()

if (roleError) fail(`Could not read roles: ${roleError.message}`)
if (!role) fail(`Role "${roleKey}" does not exist. Check supabase/seed.sql ran.`)

// --- Refuse to over-provision ----------------------------------------------

if (roleKey === 'super_admin' && !allowMultiple) {
  const { count } = await supabase
    .from('user_roles')
    .select('user_id', { count: 'exact', head: true })
    .eq('role_id', role.id)

  if (count && count > 0) {
    fail(
      `${count} account(s) already hold super_admin.\n` +
        '  Refusing to create another by accident. Pass --allow-multiple if\n' +
        '  this is genuinely intended.',
    )
  }
}

// --- Create or reuse the account ------------------------------------------

let userId = null
let created = false

const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true, // bootstrap: no waiting on a mailbox
  user_metadata: fullName ? { full_name: fullName } : {},
})

if (createError) {
  // Already registered is not fatal — reuse the existing account so the
  // script is safe to re-run.
  const alreadyExists =
    /already been registered|already exists/i.test(createError.message)

  if (!alreadyExists) fail(`Could not create the user: ${createError.message}`)

  const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
  const match = list?.users?.find(
    (u) => (u.email ?? '').toLowerCase() === email.toLowerCase(),
  )

  if (!match) fail(`Account exists but could not be located: ${createError.message}`)

  userId = match.id
  console.log(`  Existing account found; reusing it.`)
} else {
  userId = createdUser.user.id
  created = true
}

// --- Profile ----------------------------------------------------------------

const { error: profileError } = await supabase
  .from('profiles')
  .upsert(
    { id: userId, email, full_name: fullName ?? null, status: 'active' },
    { onConflict: 'id' },
  )

if (profileError) fail(`Could not create the profile: ${profileError.message}`)

// --- Role assignment --------------------------------------------------------

const { error: grantError } = await supabase
  .from('user_roles')
  .upsert(
    { user_id: userId, role_id: role.id },
    { onConflict: 'user_id,role_id' },
  )

if (grantError) fail(`Could not assign the role: ${grantError.message}`)

// --- Audit ------------------------------------------------------------------

await supabase.from('audit_logs').insert({
  actor_id: userId,
  actor_email: email,
  action: 'admin.bootstrap_created',
  entity_type: 'profile',
  entity_id: userId,
  after: { role: roleKey, bootstrap: true },
})

// --- Report -----------------------------------------------------------------

console.log(`
  Administrator ready.

    email : ${email}
    role  : ${roleKey}
    id    : ${userId}
    state : ${created ? 'created' : 'existing account, role assigned'}

  Sign in at /auth/login.

  This account was created with a password you supplied directly. Change it
  from the administration area once signed in, and rotate any credential that
  was ever pasted into a chat or commit.
`)