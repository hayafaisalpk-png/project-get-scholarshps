#!/usr/bin/env node
/**
 * Development-only sample data loader.
 *
 * *** NOT REAL SCHOLARSHIPS. Every record created here is invented. ***
 *
 * WHY
 *   The live database contains zero scholarships, so every card, row, grid and
 *   detail page renders an empty state. A visual redesign cannot be reviewed in
 *   a browser against nothing, and `AGENTS.md` §2.7 forbids inventing content to
 *   fill it permanently. These rows exist so the design can be *seen*, and can be
 *   removed with one command.
 *
 * SAFEGUARDS (do not weaken these)
 *   1. Every slug is prefixed `sample-` and every title starts with `[SAMPLE]`,
 *      so `remove` finds them all without a lookup table and no reader can
 *      mistake one for a real listing.
 *   2. `application_url` uses the reserved `.invalid` TLD, which by definition
 *      never resolves. No link can reach a real organisation.
 *   3. `verification_status` is `unverified`, never `verified`. These records
 *      have not been checked by an editor and must never claim to have been.
 *   4. Loading is an explicit manual command. Nothing imports this file, and it
 *      is not part of `supabase/migrations/`, so `supabase db push` can never
 *      carry it into an environment.
 *
 * USAGE
 *   npm run db:fixtures          load
 *   npm run db:fixtures:remove   remove
 *
 * Run `npm run db:fixtures:remove` before any launch. Leaving these rows in a
 * production database would publish invented scholarships.
 */

import { createClient } from '@supabase/supabase-js'

const MODE = process.argv[2]
if (MODE !== 'load' && MODE !== 'remove') {
  console.error('Usage: node supabase/scripts/sample-data.mjs <load|remove>')
  process.exit(2)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
for (const [k, v] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key })) {
  if (!v) {
    console.error(`Missing ${k}. Copy .env.example to .env.local and set it.`)
    process.exit(2)
  }
}

// Service role: required, because RLS correctly blocks anon writes to
// scholarships. This bypasses RLS only to create clearly-labelled samples.
const db = createClient(url, key, { auth: { persistSession: false } })

const PREFIX = 'sample-'
const APPLY = 'https://example.invalid/sample'

/** Six samples chosen to exercise every rendering path in the UI. */
const SAMPLES = [
  {
    slug: `${PREFIX}undergraduate-merit-award`,
    title: '[SAMPLE] Undergraduate Merit Award',
    sponsor_name: 'Sample Education Foundation',
    summary: 'Placeholder listing used to review card and row layout. Not a real award.',
    description: '<p>Placeholder body copy for visual review only.</p>',
    award_amount_min_cents: 250000,
    award_amount_max_cents: 500000,
    number_of_awards: 25,
    application_fee_cents: 0,
    is_renewable: false,
    eligibility_requirements: 'Placeholder eligibility text for layout review.',
    application_instructions: 'Placeholder instructions for layout review.',
    required_documents: ['Placeholder transcript', 'Placeholder reference letter'],
    application_url: `${APPLY}/undergraduate-merit-award`,
    deadlineOffsetDays: 45,
    is_rolling: false,
    featured: true,
    reviewedDaysAgo: 2,
  },
  {
    slug: `${PREFIX}graduate-research-grant`,
    title: '[SAMPLE] Graduate Research Grant',
    sponsor_name: 'Sample Research Council',
    summary: 'Placeholder listing used to review the row-card metadata grid.',
    description: '<p>Placeholder body copy for visual review only.</p>',
    award_amount_min_cents: 1000000,
    award_amount_max_cents: 2000000,
    number_of_awards: 10,
    application_fee_cents: 0,
    is_renewable: true,
    eligibility_requirements: 'Placeholder eligibility text for layout review.',
    application_instructions: 'Placeholder instructions for layout review.',
    required_documents: ['Placeholder research proposal'],
    application_url: `${APPLY}/graduate-research-grant`,
    deadlineOffsetDays: 90,
    is_rolling: false,
    featured: false,
    reviewedDaysAgo: 5,
  },
  {
    slug: `${PREFIX}closing-soon-award`,
    title: '[SAMPLE] Deadline This Week Award',
    sponsor_name: 'Sample Community Trust',
    summary: 'Placeholder listing with an imminent deadline, to review urgency styling.',
    description: '<p>Placeholder body copy for visual review only.</p>',
    award_amount_min_cents: 500000,
    award_amount_max_cents: 500000,
    number_of_awards: 5,
    application_fee_cents: 0,
    is_renewable: false,
    eligibility_requirements: 'Placeholder eligibility text for layout review.',
    application_instructions: 'Placeholder instructions for layout review.',
    required_documents: [],
    application_url: `${APPLY}/closing-soon-award`,
    deadlineOffsetDays: 4,
    is_rolling: false,
    featured: true,
    reviewedDaysAgo: 1,
  },
  {
    slug: `${PREFIX}rolling-open-award`,
    title: '[SAMPLE] Rolling Deadline Award',
    sponsor_name: 'Sample Community Trust',
    summary: 'Placeholder rolling listing, to review the "Rolling" deadline treatment.',
    description: '<p>Placeholder body copy for visual review only.</p>',
    award_amount_min_cents: 100000,
    award_amount_max_cents: 100000,
    number_of_awards: 40,
    application_fee_cents: 0,
    is_renewable: false,
    eligibility_requirements: 'Placeholder eligibility text for layout review.',
    application_instructions: 'Placeholder instructions for layout review.',
    required_documents: [],
    application_url: `${APPLY}/rolling-open-award`,
    deadlineOffsetDays: null,
    is_rolling: true,
    featured: false,
    reviewedDaysAgo: 8,
  },
  {
    slug: `${PREFIX}amount-not-stated`,
    title: '[SAMPLE] Award With No Amount Recorded',
    sponsor_name: 'Sample Anonymous Donor',
    summary: 'Placeholder listing with no award amount, to review the "not recorded" path.',
    description: '<p>Placeholder body copy for visual review only.</p>',
    award_amount_min_cents: null,
    award_amount_max_cents: null,
    number_of_awards: null,
    application_fee_cents: 0,
    is_renewable: false,
    eligibility_requirements: null,
    application_instructions: null,
    required_documents: [],
    application_url: `${APPLY}/amount-not-stated`,
    deadlineOffsetDays: 120,
    is_rolling: false,
    featured: false,
    reviewedDaysAgo: null,
  },
  {
    slug: `${PREFIX}fee-applies-award`,
    title: '[SAMPLE] Award With An Application Fee',
    sponsor_name: 'Sample Fee-Based Trust',
    summary: 'Placeholder listing carrying an application fee, to review that disclosure.',
    description: '<p>Placeholder body copy for visual review only.</p>',
    award_amount_min_cents: 750000,
    award_amount_max_cents: 750000,
    number_of_awards: 2,
    application_fee_cents: 2500,
    is_renewable: false,
    eligibility_requirements: 'Placeholder eligibility text for layout review.',
    application_instructions: 'Placeholder instructions for layout review.',
    required_documents: [],
    application_url: `${APPLY}/fee-applies-award`,
    deadlineOffsetDays: 200,
    is_rolling: false,
    featured: false,
    reviewedDaysAgo: 3,
  },
]

const iso = (daysFromToday) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + daysFromToday)
  return d.toISOString().slice(0, 10)
}

function toRow(s) {
  const row = {
    slug: s.slug,
    title: s.title,
    sponsor_name: s.sponsor_name,
    summary: s.summary,
    description: s.description,
    award_amount_min_cents: s.award_amount_min_cents,
    award_amount_max_cents: s.award_amount_max_cents,
    award_currency: 'USD',
    number_of_awards: s.number_of_awards,
    application_fee_cents: s.application_fee_cents,
    is_renewable: s.is_renewable,
    eligibility_requirements: s.eligibility_requirements,
    application_instructions: s.application_instructions,
    required_documents: s.required_documents,
    application_url: s.application_url,
    is_rolling: s.is_rolling,
    // A rolling award must have no deadline: DB constraint
    // `scholarships_deadline_consistent`.
    deadline: s.is_rolling ? null : iso(s.deadlineOffsetDays),
    status: 'published',
    published_at: new Date().toISOString(),
    verification_status: 'unverified',
    last_reviewed_at: s.reviewedDaysAgo === null ? null : iso(-s.reviewedDaysAgo),
    featured: s.featured,
    seo_title: s.title,
    seo_description: 'Sample record for design review. Not a real scholarship.',
  }
  return row
}

async function remove() {
  const { data, error } = await db
    .from('scholarships')
    .delete({ count: 'exact' })
    .like('slug', `${PREFIX}%`)
    .select('slug')

  if (error) {
    console.error('remove failed:', error.message)
    process.exit(1)
  }
  console.log(`Removed ${data?.length ?? 0} sample record(s).`)
}

async function load() {
  const rows = SAMPLES.map(toRow)

  const { data: inserted, error } = await db
    .from('scholarships')
    .upsert(rows, { onConflict: 'slug' })
    .select('id, slug')

  if (error) {
    console.error('load failed:', error.message)
    process.exit(1)
  }

  // Attach taxonomy so filtered and related views are exercised too.
  const byslug = new Map(inserted.map((r) => [r.slug, r.id]))
  const joins = [
    { table: 'scholarship_categories', column: 'category_id', taxonomy: 'categories', slug: 'merit-based' },
    { table: 'scholarship_education_levels', column: 'education_level_id', taxonomy: 'education_levels', slug: 'undergraduate' },
    { table: 'scholarship_fields', column: 'academic_field_id', taxonomy: 'academic_fields', slug: 'engineering' },
  ]

  for (const join of joins) {
    const { data: term } = await db
      .from(join.taxonomy)
      .select('id')
      .eq('slug', join.slug)
      .maybeSingle()

    if (!term) {
      console.warn(`skip ${join.taxonomy}/${join.slug}: taxonomy term not found`)
      continue
    }

    const payload = inserted
      .map((r) => ({ scholarship_id: r.id, [join.column]: term.id }))
      .filter((r) => byslug.has(r.scholarship_id))

    const { error: joinError } = await db
      .from(join.table)
      .upsert(payload, { onConflict: 'scholarship_id,' + join.column })

    if (joinError) console.warn(`${join.table}: ${joinError.message}`)
  }

  console.log(`Loaded ${inserted.length} sample record(s), all prefixed "${PREFIX}".`)
  console.log('These are INVENTED placeholders for design review only.')
  console.log('Remove before launch:  npm run db:fixtures:remove')
}

await (MODE === 'load' ? load() : remove())