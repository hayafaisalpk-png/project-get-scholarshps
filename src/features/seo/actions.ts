'use server'

import { revalidatePath } from 'next/cache'

import { requirePermission } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { indexActionSchema, type IndexableKind } from '@/lib/validation/seo'
import { isEditableSettingKey, parseSettingValue } from '@/lib/validation/settings'
import { resolveIndexChange } from './guardrails'

/**
 * SEO administration Server Actions.
 *
 * Two capabilities, two permissions, deliberately not merged:
 *
 *   - `setIndexAction`      → `seo.manage`
 *   - `updateSettingAction` → `settings.manage`
 *
 * A person who can decide what is indexable should not thereby gain the ability
 * to rewrite the site's title and social handles, and vice versa. Both are
 * re-checked on the server, and RLS re-checks them on the write.
 *
 * The guardrail decision is made by `resolveIndexChange`, not here. That function
 * is shared with nothing else today, which is deliberate: it is the rule, it is
 * unit tested, and an action that re-implemented the judgement inline would be
 * free to drift from the tests.
 */

export type SeoActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string }

/** The table backing each record kind. A closed map, never string interpolation. */
type SeoClient = Awaited<ReturnType<typeof createClient>>

/** What the guardrail needs to know about a record, whichever table it lives in. */
type SeoRecord = {
  title: string
  status: string
  noindex: boolean
  /** `null` for kinds that have no `allow_sitemap` column. */
  allowSitemap: boolean | null
}

async function loadSeoRecord(
  supabase: SeoClient,
  kind: IndexableKind,
  id: string,
): Promise<SeoRecord | null> {
  if (kind === 'article') {
    const { data } = await supabase
      .from('articles')
      .select('title, status, noindex, allow_sitemap')
      .eq('id', id)
      .maybeSingle()
    return data
      ? { ...data, allowSitemap: data.allow_sitemap ?? null }
      : null
  }

  if (kind === 'scholarship') {
    const { data } = await supabase
      .from('scholarships')
      .select('title, status, noindex')
      .eq('id', id)
      .maybeSingle()
    return data ? { ...data, allowSitemap: null } : null
  }

  const { data } = await supabase
    .from('content_pages')
    .select('title, status, noindex')
    .eq('id', id)
    .maybeSingle()
  return data ? { ...data, allowSitemap: null } : null
}

/**
 * Write the index patch.
 *
 * `allow_sitemap` is written only for `articles`, because the column does not
 * exist elsewhere and PostgREST rejects the entire request when a named column
 * is unknown — so this cannot be a shared "just set every column" helper.
 */
async function writeSeoRecord(
  supabase: SeoClient,
  kind: IndexableKind,
  id: string,
  patch: { noindex: boolean },
  allowSitemap: boolean | null,
): Promise<{ error: { code?: string; message: string } | null }> {
  if (kind === 'article') {
    return supabase
      .from('articles')
      .update({ noindex: patch.noindex, allow_sitemap: allowSitemap ?? false })
      .eq('id', id)
  }

  if (kind === 'scholarship') {
    return supabase.from('scholarships').update(patch).eq('id', id)
  }

  return supabase.from('content_pages').update(patch).eq('id', id)
}

/* -------------------------------------------------------------------------- */
/* Index control                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Turn indexing on or off for one record.
 *
 * `status` is submitted from the rendered row so the guardrail can explain
 * itself ("this record is still a draft"), but it is NOT trusted: the row is read
 * again from the database before anything is written, and it is the stored status
 * that decides. A caller who passes a favourable status gains nothing.
 */
export async function setIndexAction(
  kind: string,
  id: string,
  indexable: boolean,
  status: string,
): Promise<SeoActionResult> {
  await requirePermission('seo.manage')

  const parsed = indexActionSchema.safeParse({
    kind,
    id,
    indexable: indexable ? 'true' : 'false',
    status,
  })

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'That change is not valid.' }
  }

  const { kind: recordKind, id: recordId } = parsed.data
  const supabase = await createClient()

  /*
   * The three record kinds are branched EXPLICITLY rather than through a
   * `TABLES[kind]` lookup.
   *
   * Two reasons, both practical. `allow_sitemap` exists only on `articles`, so
   * the column lists genuinely differ. And a union of three Supabase table
   * types defeats the generated parser types entirely: `data` collapses to
   * `SelectQueryError | ParserError` and every property access fails to
   * typecheck. Three short branches are clearer and correct.
   */
  const current = await loadSeoRecord(supabase, recordKind, recordId)

  if (!current) {
    return { ok: false, message: 'That record could not be found.' }
  }

  const verdict = resolveIndexChange(
    {
      kind: recordKind,
      id: recordId,
      title: current.title,
      // The STORED status, not the submitted one.
      status: current.status,
      noindex: current.noindex,
    },
    indexable,
  )

  if (!verdict.ok) return { ok: false, message: verdict.message }

  const patch = { noindex: verdict.patch.noindex }

  const { error } = await writeSeoRecord(
    supabase,
    recordKind,
    recordId,
    patch,
    verdict.patch.allow_sitemap,
  )

  if (error) {
    console.error('[seo] index change failed:', error.code, error.message)

    if (error.code === '23514') {
      return {
        ok: false,
        message:
          'The database refused that combination — a no-index record cannot also be listed in the sitemap.',
      }
    }
    return { ok: false, message: 'That change could not be saved.' }
  }

  await supabase.rpc('write_audit_log', {
    p_action: 'seo.index_change',
    p_entity_type: recordKind,
    p_entity_id: recordId,
    p_before: { noindex: current.noindex, allow_sitemap: current.allowSitemap },
    p_after: { ...patch, allow_sitemap: verdict.patch.allow_sitemap },
  })

  revalidatePath('/admin/seo')
  // The public pages carry the robots directive, so they must be re-rendered.
  revalidatePath('/', 'layout')

  return {
    ok: true,
    message: indexable ? 'This record is now indexable.' : 'This record is now excluded from search engines.',
  }
}

/* -------------------------------------------------------------------------- */
/* Site settings                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Update one site setting.
 *
 * The key must be in `EDITABLE_SETTING_KEYS`. That allowlist is the control that
 * keeps this screen away from `newsletter.enabled`, `ads.enabled` and
 * `site.maintenance_mode` — switches that belong to their own features and that
 * nobody should be able to flip from a generic settings form.
 *
 * `value` is JSONB, so the conversion is by the row's own `value_type`. A boolean
 * written as the string `"false"` is truthy in JavaScript, which would show a
 * switch as on while the page behaved as if it were off.
 */
export async function updateSettingAction(
  _prev: SeoActionResult | null,
  formData: FormData,
): Promise<SeoActionResult & { fieldErrors?: Record<string, string> }> {
  await requirePermission('settings.manage')

  const key = String(formData.get('key') ?? '')
  const raw = formData.get('value')
  const rawValue = typeof raw === 'string' ? raw : ''

  if (!isEditableSettingKey(key)) {
    return { ok: false, message: 'That setting cannot be edited here.' }
  }

  const supabase = await createClient()

  const { data: before } = await supabase
    .from('site_settings')
    .select('value, value_type')
    .eq('key', key)
    .maybeSingle()

  if (!before) {
    return { ok: false, message: 'That setting does not exist.' }
  }

  /*
   * The type comes from the DATABASE ROW, never from the form.
   *
   * An earlier version trusted a hidden `valueType` input. It rendered empty
   * because of a select-alias mismatch, `parseSettingValue('')` fell through to
   * its string branch, and an `http://` address was accepted and stored in a
   * setting declared as `url` — silently, because an undefined type and a
   * missing type look identical. A client that can name the type of the column
   * it is writing has already defeated the check.
   */
  const parsed = parseSettingValue({ raw: rawValue, valueType: before.value_type })

  if (!parsed.ok) {
    return {
      ok: false,
      message: parsed.message,
      fieldErrors: { value: parsed.message },
    }
  }

  const { error } = await supabase
    .from('site_settings')
    .update({ value: parsed.value })
    .eq('key', key)

  if (error) {
    console.error('[seo] setting update failed:', error.code, error.message)
    return { ok: false, message: 'That setting could not be saved.' }
  }

  await supabase.rpc('write_audit_log', {
    p_action: 'setting.update',
    p_entity_type: 'site_setting',
    p_entity_id: key,
    p_before: { value: before.value },
    p_after: { value: parsed.value },
  })

  revalidatePath('/admin/settings')
  // These values are read by the public layout, so the whole public tree needs a
  // fresh render for a title or description change to take effect.
  revalidatePath('/', 'layout')

  return { ok: true, message: 'Saved.' }
}