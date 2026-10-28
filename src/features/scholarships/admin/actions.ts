'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requirePermission } from '@/lib/auth/guards'
import { fieldErrorsFrom } from '@/lib/validation/auth'
import { sanitizeArticleHtml } from '@/lib/sanitize'
import {
  type ScholarshipStatus,
  scholarshipSchema,
  SCHOLARSHIP_STATUSES,
  slugify,
} from '@/lib/validation/scholarship'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { z } from 'zod'

/**
 * Scholarship Server Actions.
 *
 * Every action follows the same shape:
 *
 *   1. `requirePermission` runs FIRST, before any database call. Hiding a button
 *      is not authorisation.
 *   2. Input is parsed and validated with Zod.
 *   3. The write goes through the SESSION client, so RLS enforces it. The
 *      service-role client is never used for user-driven mutations.
 *   4. The change is written to the audit log.
 *   5. Cached paths are revalidated.
 *
 * The service-role client would bypass RLS entirely; using it here would make
 * every check above decorative.
 */

export type ScholarshipActionResult =
  | { ok: true; message?: string; id?: string }
  | {
      ok: false
      message: string
      fieldErrors?: Record<string, string>
      /** Present when the record was created but a later step failed. */
      id?: string
      /** Submitted values echoed back so the form can restore them after a failed submission. */
      values?: Record<string, string | string[]>
    }

const bulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  next: z.enum(['draft', 'pending_review', 'published', 'expired', 'archived']),
})

const verificationSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['unverified', 'pending', 'verified', 'disputed']),
  note: z.string().trim().max(2000),
})

/* -------------------------------------------------------------------------- */
/* FormData -> validated input                                                */
/* -------------------------------------------------------------------------- */

/**
 * Collect the taxonomy checkboxes.
 *
 * Unchecked boxes are simply absent from the submission, so a multi-select is
 * read with `getAll` rather than a single `get`.
 */
function idList(formData: FormData, key: string): string[] {
  return formData.getAll(key).map(String).filter(Boolean)
}

/** A checkbox is present-and-true when the box was ticked. */
function flag(formData: FormData, key: string): boolean {
  return formData.get(key) !== null
}

/** Empty strings become null so the database stores NULL, not ''. */
function text(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

function buildInput(formData: FormData) {
  return {
    title: text(formData, 'title'),
    slug: text(formData, 'slug') || slugify(text(formData, 'title')),
    sponsor_name: text(formData, 'sponsor_name'),
    institution_logo_url: text(formData, 'institution_logo_url'),
    institution_country: text(formData, 'institution_country'),
    summary: text(formData, 'summary'),
    description: text(formData, 'description'),
    eligibility_requirements: text(formData, 'eligibility_requirements'),
    application_instructions: text(formData, 'application_instructions'),
    internal_notes: text(formData, 'internal_notes'),
    renewal_details: text(formData, 'renewal_details'),
    required_documents: text(formData, 'required_documents'),
    award_amount_min: text(formData, 'award_amount_min'),
    award_amount_max: text(formData, 'award_amount_max'),
    award_amount_text: text(formData, 'award_amount_text'),
    award_currency: text(formData, 'award_currency') || 'USD',
    number_of_awards: text(formData, 'number_of_awards'),
    award_per_year: flag(formData, 'award_per_year'),
    application_fee: text(formData, 'application_fee'),
    is_renewable: flag(formData, 'is_renewable'),
    max_renewals: text(formData, 'max_renewals'),
    opens_at: text(formData, 'opens_at'),
    deadline: text(formData, 'deadline'),
    is_rolling: flag(formData, 'is_rolling'),
    application_url: text(formData, 'application_url'),
    status: text(formData, 'status'),
    verification_status: text(formData, 'verification_status'),
    featured: flag(formData, 'featured'),
    noindex: flag(formData, 'noindex'),
    seo_title: text(formData, 'seo_title'),
    seo_description: text(formData, 'seo_description'),
    social_media_share_image_url: text(formData, 'social_media_share_image_url'),    category_ids: idList(formData, 'category_ids'),
    education_level_ids: idList(formData, 'education_level_ids'),
    field_ids: idList(formData, 'field_ids'),
    location_ids: idList(formData, 'location_ids'),
  }
}

/**
 * Echo the submitted form values back to the client so a failed submission does
 * not wipe what the editor typed. Strings are clipped to a sane length; taxonomy
 * checkboxes are echoed as arrays (possibly empty) so an unchecked group clears.
 */
function echoValues(formData: FormData): Record<string, string | string[]> {
  const textKeys = [
    'title',
    'slug',
    'sponsor_name',
    'institution_logo_url',
    'institution_country',
    'summary',
    'eligibility_requirements',
    'application_instructions',
    'internal_notes',
    'required_documents',
    'award_amount_min',
    'award_amount_max',
    'award_currency',
    'award_amount_text',
    'number_of_awards',
    'application_fee',
    'max_renewals',
    'opens_at',
    'deadline',
    'application_url',
    'status',
    'verification_status',
    'seo_title',
    'seo_description',
    'social_media_share_image_url',
  ]
  const checkboxKeys = [
    'award_per_year',
    'is_renewable',
    'is_rolling',
    'featured',
    'noindex',
  ]
  const arrayKeys = [
    'category_ids',
    'education_level_ids',
    'field_ids',
    'location_ids',
  ]

  const out: Record<string, string | string[]> = {}
  for (const key of textKeys) {
    const raw = formData.get(key)
    if (typeof raw === 'string') {
      const clipped = raw.slice(0, 5000)
      if (clipped.length > 0) out[key] = clipped
    }
  }
  for (const key of checkboxKeys) {
    if (formData.get(key) !== null) out[key] = 'on'
  }
  for (const key of arrayKeys) {
    out[key] = formData.getAll(key).map(String).filter(Boolean)
  }
  return out
}

/* -------------------------------------------------------------------------- */
/* Row payload                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Convert validated input into the `scholarships` row shape.
 *
 * Taxonomy columns are deliberately absent: they live in join tables and are
 * written separately.
 */
/** Taxonomy assignment shape accepted by the form. */
type ScholarshipTaxonomyInput = {
  category_ids: string[]
  education_level_ids: string[]
  field_ids: string[]
  location_ids: string[]
}

/** Row shape accepted by Supabase for `scholarships`. */
type ScholarshipInsert =
  Database['public']['Tables']['scholarships']['Insert']

/** Partial row shape accepted by `.update()`. */
type ScholarshipUpdate =
  Database['public']['Tables']['scholarships']['Update']

/**
 * Convert validated input into the `scholarships` row shape.
 *
 * Taxonomy columns are deliberately absent: they live in join tables and are
 * written separately.
 *
 * Returns `Insert` because every value here is also valid in an update, and
 * `Insert` additionally carries the three required columns — which makes this
 * the stricter of the two shapes and therefore the safer one to hand to both
 * `.insert()` and `.update()`.
 */
function toRow(
  value: ReturnType<typeof scholarshipSchema.parse>,
  userId: string,
  mode: 'create' | 'update',
  institutionId: string | null = null,
): ScholarshipInsert {
  const now = new Date().toISOString()

  return {
    slug: value.slug,
    title: value.title,
    sponsor_name: value.sponsor_name,
    institution_id: institutionId,
    summary: value.summary,
    description: value.description,
    eligibility_requirements: sanitizeArticleHtml(value.eligibility_requirements) || null,
    application_instructions: sanitizeArticleHtml(value.application_instructions) || null,
    internal_notes: value.internal_notes,
    renewal_details: value.renewal_details,
    required_documents: sanitizeArticleHtml(value.required_documents) || null,
    award_amount_min_cents: value.award_amount_min,
    award_amount_max_cents: value.award_amount_max,
    award_amount_text: value.award_amount_text,
    award_currency: value.award_currency,
    number_of_awards: value.number_of_awards,
    award_per_year: value.award_per_year,
    application_fee_cents: value.application_fee ?? 0,
    is_renewable: value.is_renewable,
    max_renewals: value.max_renewals,
    opens_at: value.opens_at,
    deadline: value.is_rolling ? null : value.deadline,
    is_rolling: value.is_rolling,
    application_url: value.application_url,
    status: value.status,
    verification_status: value.verification_status,
    featured: value.featured,
    noindex: value.noindex,
    seo_title: value.seo_title,
    seo_description: value.seo_description,
    social_media_share_image_url: value.social_media_share_image_url,
    updated_by: userId,

    // Timestamps that only make sense when entering or leaving a state.
    ...(value.status === 'published' ? { published_at: now } : {}),
    ...(value.status === 'archived' ? { archived_at: now } : {}),
    ...(mode === 'create' ? { created_by: userId, created_at: now } : {}),
  }
}

/**
 * Replace a scholarship's taxonomy assignments with exactly the ids given.
 *
 * Written out per table rather than looped with a computed column name: a
 * `[target.column]` key produces `{ [x: string]: string }`, which no longer
 * satisfies supabase-js's per-table `Insert` types and so would have to be
 * forced through a cast. Four explicit blocks keep the payloads fully typed.
 */
async function replaceJoins(
  scholarshipId: string,
  taxonomy: ScholarshipTaxonomyInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createClient()

  const categoryIds = [...new Set(taxonomy.category_ids)]
  const levelIds = [...new Set(taxonomy.education_level_ids)]
  const fieldIds = [...new Set(taxonomy.field_ids)]
  const locationIds = [...new Set(taxonomy.location_ids)]

  {
    const { error } = await supabase
      .from('scholarship_categories')
      .delete()
      .eq('scholarship_id', scholarshipId)
    if (error) return { ok: false, message: error.message }
  }
  if (categoryIds.length > 0) {
    const { error } = await supabase
      .from('scholarship_categories')
      .insert(categoryIds.map((category_id) => ({ scholarship_id: scholarshipId, category_id })))
    if (error) return { ok: false, message: error.message }
  }

  {
    const { error } = await supabase
      .from('scholarship_education_levels')
      .delete()
      .eq('scholarship_id', scholarshipId)
    if (error) return { ok: false, message: error.message }
  }
  if (levelIds.length > 0) {
    const { error } = await supabase
      .from('scholarship_education_levels')
      .insert(
        levelIds.map((education_level_id) => ({
          scholarship_id: scholarshipId,
          education_level_id,
        })),
      )
    if (error) return { ok: false, message: error.message }
  }

  {
    const { error } = await supabase
      .from('scholarship_fields')
      .delete()
      .eq('scholarship_id', scholarshipId)
    if (error) return { ok: false, message: error.message }
  }
  if (fieldIds.length > 0) {
    const { error } = await supabase
      .from('scholarship_fields')
      .insert(
        fieldIds.map((academic_field_id) => ({
          scholarship_id: scholarshipId,
          academic_field_id,
        })),
      )
    if (error) return { ok: false, message: error.message }
  }

  {
    const { error } = await supabase
      .from('scholarship_locations')
      .delete()
      .eq('scholarship_id', scholarshipId)
    if (error) return { ok: false, message: error.message }
  }
  if (locationIds.length > 0) {
    const { error } = await supabase
      .from('scholarship_locations')
      .insert(
        locationIds.map((location_id) => ({
          scholarship_id: scholarshipId,
          location_id,
        })),
      )
    if (error) return { ok: false, message: error.message }
  }

  return { ok: true }
}

/** Revalidate the admin list and the public surfaces that show the record. */
function revalidate(slug?: string | null) {
  revalidatePath('/admin/scholarships')
  if (slug) {
    revalidatePath(`/admin/scholarships/${slug}`)
  }
  revalidatePath('/scholarships')
  revalidatePath('/')
}

/* -------------------------------------------------------------------------- */
/* Institution resolution                                                     */
/* -------------------------------------------------------------------------- */

async function resolveInstitutionId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  name: string,
  logoUrl: string | null,
  country: string | null,
): Promise<string | null> {
  const trimmed = name.trim()
  if (!trimmed) return null

  let existing: { id: string } | null = null
  try {
    const { data } = await supabase
      .from('institutions')
      .select('id')
      .ilike('name', trimmed)
      .maybeSingle()
    existing = (data as { id: string } | null) ?? null
  } catch {
    // Institutions table may not exist yet (migration not applied).
    return null
  }

  if (existing?.id) {
    const patch: { logo_url?: string; country?: string } = {}
    if (logoUrl?.trim()) patch.logo_url = logoUrl.trim()
    if (country?.trim()) patch.country = country.trim()
    if (Object.keys(patch).length > 0) {
      await supabase.from('institutions').update(patch).eq('id', existing.id)
    }
    return existing.id
  }

  const baseSlug =
    trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ||
    'institution'
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 8)}`

  const { data: created, error } = await supabase
    .from('institutions')
    .insert({
      name: trimmed,
      slug,
      institution_type: 'other',
      logo_url: logoUrl?.trim() || null,
      country: country?.trim() || null,
      is_verified: false,
    })
    .select('id')
    .single()

  if (error || !created) return null
  return created.id
}

/* -------------------------------------------------------------------------- */
/* Create                                                                     */
/* -------------------------------------------------------------------------- */

export async function createScholarshipAction(
  _prev: ScholarshipActionResult | null,
  formData: FormData,
): Promise<ScholarshipActionResult> {
  const { user } = await requirePermission('scholarship.manage')

  const parsed = scholarshipSchema.safeParse(buildInput(formData))

  if (!parsed.success) {
    return {
      ok: false,
      message: 'Please correct the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: echoValues(formData),
    }
  }

  const value = parsed.data
  const supabase = await createClient()

  const institutionId = await resolveInstitutionId(
    supabase,
    value.sponsor_name,
    value.institution_logo_url,
    value.institution_country,
  )

  // Check the slug before writing so the editor gets a field-level message
  // rather than a generic constraint failure.
  const { data: clash } = await supabase
    .from('scholarships')
    .select('id')
    .eq('slug', value.slug)
    .maybeSingle()

  if (clash) {
    return {
      ok: false,
      message: 'That URL slug is already in use.',
      fieldErrors: { slug: 'This slug is already taken.' },
      values: echoValues(formData),
    }
  }

  let inserted: { id: string; slug: string } | null = null
  let error: { code?: string; message?: string } | null = null
  {
    const res = await supabase
      .from('scholarships')
      .insert(toRow(value, user.id, 'create', institutionId))
      .select('id, slug')
      .single()
    inserted = res.data as { id: string; slug: string } | null
    error = res.error as { code?: string; message?: string } | null
  }
  if (error && error.code === '42703') {
    // institution_id column missing (migration 042 not applied yet): retry
    // without it so existing functionality keeps working.
    const rowWithout = toRow(value, user.id, 'create', null) as Record<string, unknown>
    delete rowWithout.institution_id
    const res2 = await supabase
      .from('scholarships')
      .insert(rowWithout as never)
      .select('id, slug')
      .single()
    inserted = res2.data as { id: string; slug: string } | null
    error = res2.error as { code?: string; message?: string } | null
  }

  if (error || !inserted) {
    return { ok: false, message: friendlyWriteError(error?.code, error?.message), values: echoValues(formData) }
  }

  const joins = await replaceJoins(inserted.id, {
    category_ids: value.category_ids,
    education_level_ids: value.education_level_ids,
    field_ids: value.field_ids,
    location_ids: value.location_ids,
  })

  if (!joins.ok) {
    // The record exists; the assignment did not. Say so precisely instead of
    // implying a clean save.
    return {
      ok: false,
      message: `The scholarship was created, but its categories could not be saved: ${joins.message}`,
      id: inserted.id,
      values: echoValues(formData),
    }
  }

  await supabase.rpc('write_audit_log', {
    p_action: 'scholarship.create',
    p_entity_type: 'scholarship',
    p_entity_id: inserted.id,
    p_after: { title: value.title, slug: value.slug, status: value.status },
  })

  revalidate(inserted.slug)
  redirect(`/admin/scholarships/${inserted.id}`)
}

/* -------------------------------------------------------------------------- */
/* Update                                                                     */
/* -------------------------------------------------------------------------- */

export async function updateScholarshipAction(
  _prev: ScholarshipActionResult | null,
  formData: FormData,
): Promise<ScholarshipActionResult> {
  const { user } = await requirePermission('scholarship.manage')

  const id = text(formData, 'id')
  if (!id) return { ok: false, message: 'Missing scholarship reference.', values: echoValues(formData) }

  const parsed = scholarshipSchema.safeParse(buildInput(formData))

  if (!parsed.success) {
    return {
      ok: false,
      message: 'Please correct the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: echoValues(formData),
    }
  }

  const value = parsed.data
  const supabase = await createClient()

  const institutionId = await resolveInstitutionId(
    supabase,
    value.sponsor_name,
    value.institution_logo_url,
    value.institution_country,
  )

  // Capture the previous state for the audit trail before overwriting it.
  const { data: before } = await supabase
    .from('scholarships')
    .select('title, slug, status, featured')
    .eq('id', id)
    .maybeSingle()

  const { data: clash } = await supabase
    .from('scholarships')
    .select('id')
    .eq('slug', value.slug)
    .neq('id', id)
    .maybeSingle()

  if (clash) {
    return {
      ok: false,
      message: 'That URL slug is already in use.',
      fieldErrors: { slug: 'This slug is already taken.' },
      values: echoValues(formData),
    }
  }

  let updateError = (
    await supabase
      .from('scholarships')
      .update(toRow(value, user.id, 'update', institutionId))
      .eq('id', id)
  ).error as { code?: string; message?: string } | null
  if (updateError && updateError.code === '42703') {
    const rowWithout = toRow(value, user.id, 'update', null) as Record<string, unknown>
    delete rowWithout.institution_id
    updateError = (
      await supabase
        .from('scholarships')
        .update(rowWithout as never)
        .eq('id', id)
    ).error as { code?: string; message?: string } | null
  }
  const error = updateError

  if (error) {
    return { ok: false, message: friendlyWriteError(error.code, error.message), values: echoValues(formData) }
  }

  const joins = await replaceJoins(id, {
    category_ids: value.category_ids,
    education_level_ids: value.education_level_ids,
    field_ids: value.field_ids,
    location_ids: value.location_ids,
  })

  if (!joins.ok) {
    return {
      ok: false,
      message: `The changes were saved, but the categories could not be updated: ${joins.message}`,
      values: echoValues(formData),
    }
  }

  await supabase.rpc('write_audit_log', {
    p_action: 'scholarship.update',
    p_entity_type: 'scholarship',
    p_entity_id: id,
    p_before: before ?? null,
    p_after: { title: value.title, slug: value.slug, status: value.status },
  })

  revalidate(value.slug)

  return { ok: true, message: 'Changes saved.' }
}

/* -------------------------------------------------------------------------- */
/* Status transitions                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Move a scholarship to a new lifecycle status.
 *
 * Publishing is deliberately re-checked here rather than trusted from the form:
 * the CHECK constraints require a publication timestamp and an application URL,
 * and a status change must not be able to bypass the same rules the full form
 * enforces.
 */
export async function setScholarshipStatusAction(
  id: string,
  next: ScholarshipStatus,
): Promise<ScholarshipActionResult> {
  const { user } = await requirePermission('scholarship.manage')

  if (!SCHOLARSHIP_STATUSES.includes(next)) {
    return { ok: false, message: 'Unknown status.' }
  }

  const supabase = await createClient()

  const { data: current, error: loadError } = await supabase
    .from('scholarships')
    .select('id, slug, title, status, application_url, verification_status, published_at')
    .eq('id', id)
    .maybeSingle()

  if (loadError || !current) {
    return { ok: false, message: 'That scholarship could not be found.' }
  }

  const now = new Date().toISOString()
  const patch: ScholarshipUpdate = {
    status: next,
    updated_by: user.id,
  }

  if (next === 'published') {
    if (!current.application_url) {
      return {
        ok: false,
        message:
          'Add an official application link before publishing. Applicants need somewhere to apply.',
      }
    }

    if (
      current.verification_status === 'pending' ||
      current.verification_status === 'disputed'
    ) {
      return {
        ok: false,
        message:
          'Resolve the verification status before publishing this record.',
      }
    }

    patch.published_at = current.published_at ?? now
    patch.archived_at = null
  }

  if (next === 'archived') {
    patch.archived_at = now
  }

  if (next === 'draft') {
    patch.archived_at = null
  }

  const { error } = await supabase
    .from('scholarships')
    .update(patch)
    .eq('id', id)

  if (error) {
    return { ok: false, message: friendlyWriteError(error.code, error.message) }
  }

  await supabase.rpc('write_audit_log', {
    p_action: 'scholarship.status_change',
    p_entity_type: 'scholarship',
    p_entity_id: id,
    p_before: { status: current.status },
    p_after: { status: next },
  })

  revalidate(current.slug)

  return { ok: true, message: `Moved to ${next.replace('_', ' ')}.` }
}

/** Apply a lifecycle status to a bounded, explicitly selected set of records. */
export async function bulkSetScholarshipStatusAction(
  _previous: ScholarshipActionResult | null,
  formData: FormData,
): Promise<ScholarshipActionResult> {
  const { user } = await requirePermission('scholarship.manage')
  const parsed = bulkSchema.safeParse({
    ids: formData.getAll('ids').map(String),
    next: formData.get('next'),
  })
  if (!parsed.success) return { ok: false, message: 'Select at least one scholarship and a valid action.' }

  const supabase = await createClient()
  const now = new Date().toISOString()
  const patch: ScholarshipUpdate = { status: parsed.data.next, updated_by: user.id }
  if (parsed.data.next === 'archived') patch.archived_at = now
  if (parsed.data.next === 'draft' || parsed.data.next === 'pending_review') patch.archived_at = null
  if (parsed.data.next === 'published') {
    patch.published_at = now
    patch.archived_at = null
  }

  const { data: rows, error } = await supabase
    .from('scholarships')
    .select('id, title, status, application_url, verification_status')
    .in('id', parsed.data.ids)
  if (error) return { ok: false, message: 'The selected scholarships could not be loaded.' }

  if (parsed.data.next === 'published' && (rows ?? []).some((row) => !row.application_url || row.verification_status !== 'verified')) {
    return { ok: false, message: 'Every selected scholarship must have an HTTPS application link and verified information before publishing.' }
  }

  for (const row of rows ?? []) {
    const result = await supabase.from('scholarships').update(patch).eq('id', row.id)
    if (result.error) return { ok: false, message: 'The bulk update stopped before all records were changed.' }
    await supabase.rpc('write_audit_log', {
      p_action: 'scholarship.bulk_status_change',
      p_entity_type: 'scholarship',
      p_entity_id: row.id,
      p_before: { status: row.status },
      p_after: { status: parsed.data.next },
    })
  }
  revalidate()
  return { ok: true, message: `${(rows ?? []).length} scholarship(s) updated.` }
}

/** Record a verification decision independently of the editorial lifecycle. */
export async function setScholarshipVerificationAction(
  id: string,
  status: 'unverified' | 'pending' | 'verified' | 'disputed',
  note: string,
): Promise<ScholarshipActionResult> {
  const { user } = await requirePermission('scholarship.verify')
  const parsed = verificationSchema.safeParse({ id, status, note })
  if (!parsed.success) return { ok: false, message: 'Choose a valid verification status and note.' }
  const supabase = await createClient()
  const { data: before } = await supabase.from('scholarships').select('title, verification_status').eq('id', parsed.data.id).maybeSingle()
  if (!before) return { ok: false, message: 'That scholarship could not be found.' }
  const now = new Date().toISOString()
  const { error } = await supabase.from('scholarships').update({
    verification_status: parsed.data.status,
    verified_at: parsed.data.status === 'verified' ? now : null,
    last_reviewed_at: now,
    updated_by: user.id,
  }).eq('id', parsed.data.id)
  if (error) return { ok: false, message: 'The verification result could not be saved.' }
  await supabase.rpc('write_audit_log', {
    p_action: 'scholarship.verify',
    p_entity_type: 'scholarship',
    p_entity_id: parsed.data.id,
    p_before: before,
    p_after: { verification_status: parsed.data.status, note: parsed.data.note || null },
  })
  revalidate()
  return { ok: true, message: 'Verification result saved.' }
}

/** Toggle the homepage "featured" flag. */
export async function toggleFeaturedAction(
  id: string,
  featured: boolean,
): Promise<ScholarshipActionResult> {
  await requirePermission('scholarship.manage')

  const supabase = await createClient()

  const { error } = await supabase
    .from('scholarships')
    .update({ featured, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    return { ok: false, message: friendlyWriteError(error.code, error.message) }
  }

  await supabase.rpc('write_audit_log', {
    p_action: featured ? 'scholarship.feature' : 'scholarship.unfeature',
    p_entity_type: 'scholarship',
    p_entity_id: id,
  })

  revalidate()
  return { ok: true }
}

/**
 * Permanently delete a scholarship.
 *
 * Requires `scholarship.delete`, which is held only by administrators — editors
 * and authors cannot reach it. Expired records are normally archived instead:
 * the schema comment is explicit that expired records keep their page and
 * history.
 */
export async function deleteScholarshipAction(
  id: string,
): Promise<ScholarshipActionResult> {
  await requirePermission('scholarship.delete')

  const supabase = await createClient()

  const { data: current } = await supabase
    .from('scholarships')
    .select('title, slug')
    .eq('id', id)
    .maybeSingle()

  if (!current) {
    return { ok: false, message: 'That scholarship could not be found.' }
  }

  const { error } = await supabase.from('scholarships').delete().eq('id', id)

  if (error) {
    return { ok: false, message: friendlyWriteError(error.code, error.message) }
  }

  await supabase.rpc('write_audit_log', {
    p_action: 'scholarship.delete',
    p_entity_type: 'scholarship',
    p_entity_id: id,
    p_before: { title: current.title, slug: current.slug },
  })

  revalidate(current.slug)
  revalidatePath('/admin/scholarships')

  return { ok: true, message: 'Deleted.' }
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Turn a Postgres/PostgREST failure into a message an editor can act on.
 *
 * The raw message is logged rather than returned, so constraint internals,
 * column names and SQL never reach the browser.
 */
function friendlyWriteError(
  code: string | null | undefined,
  message: string | undefined,
): string {
  console.error('[admin] scholarship write failed:', code, message)

  switch (code) {
    case '23505':
      return 'Another record already uses that unique value.'
    case '23514':
      return 'Those values break a data rule. Check the amounts, deadline and publishing fields.'
    case '23503':
      return 'A referenced record does not exist. Reload the page and try again.'
    case '42501':
      return 'You do not have permission to do that.'
    default:
      return 'The change could not be saved. Please try again.'
  }
}
