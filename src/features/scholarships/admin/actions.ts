'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requirePermission } from '@/lib/auth/guards'
import { fieldErrorsFrom } from '@/lib/validation/auth'
import {
  parseRequiredDocuments,
  type ScholarshipStatus,
  scholarshipSchema,
  SCHOLARSHIP_STATUSES,
} from '@/lib/validation/scholarship'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

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
    }

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
    slug: text(formData, 'slug'),
    sponsor_name: text(formData, 'sponsor_name'),
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
    category_ids: idList(formData, 'category_ids'),
    education_level_ids: idList(formData, 'education_level_ids'),
    field_ids: idList(formData, 'field_ids'),
    location_ids: idList(formData, 'location_ids'),
  }
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
): ScholarshipInsert {
  const now = new Date().toISOString()

  return {
    slug: value.slug,
    title: value.title,
    sponsor_name: value.sponsor_name,
    summary: value.summary,
    description: value.description,
    eligibility_requirements: value.eligibility_requirements,
    application_instructions: value.application_instructions,
    internal_notes: value.internal_notes,
    renewal_details: value.renewal_details,
    required_documents: parseRequiredDocuments(value.required_documents),
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
    }
  }

  const value = parsed.data
  const supabase = await createClient()

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
    }
  }

  const { data: inserted, error } = await supabase
    .from('scholarships')
    .insert(toRow(value, user.id, 'create'))
    .select('id, slug')
    .single()

  if (error || !inserted) {
    return { ok: false, message: friendlyWriteError(error?.code, error?.message) }
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
  if (!id) return { ok: false, message: 'Missing scholarship reference.' }

  const parsed = scholarshipSchema.safeParse(buildInput(formData))

  if (!parsed.success) {
    return {
      ok: false,
      message: 'Please correct the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    }
  }

  const value = parsed.data
  const supabase = await createClient()

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
    }
  }

  const { error } = await supabase
    .from('scholarships')
    .update(toRow(value, user.id, 'update'))
    .eq('id', id)

  if (error) {
    return { ok: false, message: friendlyWriteError(error.code, error.message) }
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