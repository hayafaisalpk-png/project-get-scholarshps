'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requirePermission } from '@/lib/auth/guards'
import { deriveArticleContent } from '@/lib/sanitize'
import { createClient } from '@/lib/supabase/server'
import { uploadMediaAction } from '@/features/media/actions'
import {
  type ArticleRelations,
} from '@/features/articles/admin/queries'
import { fieldErrorsFrom } from '@/lib/validation/auth'
import {
  type ArticleStatus,
  articleSchema,
  ARTICLE_STATUSES,
  localDateTimeToIso,
  slugifyArticle,
} from '@/lib/validation/article'
import type { Database } from '@/types/database'
import { z } from 'zod'

/**
 * Article Server Actions.
 *
 * Same shape as the scholarship actions — permission first, Zod second,
 * session client for the write so RLS enforces it, audit log last.
 *
 * The important difference is the body: `content` arrives as raw HTML from the
 * editor and is sanitised HERE, on the server. The client is not trusted to
 * have sanitised it, and the database stores only what survives the allowlist.
 */

export type ArticleActionResult =
  | { ok: true; message?: string; id?: string; warnings?: string[] }
  | {
      ok: false
      message: string
      fieldErrors?: Record<string, string>
      id?: string
    }

const reviewSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(['approved', 'changes_requested', 'rejected']),
  notes: z.string().trim().max(4000),
})

const autosaveSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(300),
  content: z.string().max(500000),
})

type ArticleInsert = Database['public']['Tables']['articles']['Insert']
type ArticleUpdate = Database['public']['Tables']['articles']['Update']

/* -------------------------------------------------------------------------- */
/* FormData -> input                                                          */
/* -------------------------------------------------------------------------- */

function text(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

function flag(formData: FormData, key: string): boolean {
  return formData.get(key) !== null
}

function idList(formData: FormData, key: string): string[] {
  return formData.getAll(key).map(String).filter(Boolean)
}

/**
 * Pair the FAQ question and answer inputs into items.
 *
 * The form posts one `faq_question` and one `faq_answer` per row, so the two
 * lists are zipped by index. A row where BOTH fields are blank is a row the
 * editor has not filled in yet, and is dropped rather than rejected — being
 * able to leave a spare empty row in the form is not an error. A row with only
 * one of the two filled in IS an error, and is left for the Zod schema to
 * report.
 */
function faqItemsFromFormData(formData: FormData): { question: string; answer: string }[] {
  const questions = formData.getAll('faq_question').map(String)
  const answers = formData.getAll('faq_answer').map(String)

  return questions
    .map((question, index) => ({
      question,
      answer: answers[index] ?? '',
    }))
    .filter((item) => item.question.trim() !== '' || item.answer.trim() !== '')
}

function buildInput(formData: FormData) {
  return {
    title: text(formData, 'title'),
    slug: text(formData, 'slug') || slugifyArticle(text(formData, 'title')),
    excerpt: text(formData, 'excerpt'),
    content: text(formData, 'content'),
    status: text(formData, 'status'),
    author_id: text(formData, 'author_id'),
    scheduled_for: text(formData, 'scheduled_for'),
    featured_image_id: text(formData, 'featuredImageId'),
    noindex: flag(formData, 'noindex'),
    allow_sitemap: flag(formData, 'allow_sitemap'),
    faq_items: faqItemsFromFormData(formData),
    seo_title: text(formData, 'seo_title'),
    seo_description: text(formData, 'seo_description'),
    canonical_url: text(formData, 'canonical_url'),
    article_category_ids: idList(formData, 'article_category_ids'),
    article_tag_ids: idList(formData, 'article_tag_ids'),
    scholarship_ids: idList(formData, 'scholarship_ids'),
    change_note: text(formData, 'change_note'),
  }
}

async function uploadFeaturedImage(
  formData: FormData,
): Promise<{ id: string } | ArticleActionResult | null> {
  const file = formData.get('featuredImageFile')
  if (!(file instanceof File) || file.size === 0) return null

  const uploadData = new FormData()
  uploadData.set('file', file)
  uploadData.set('folder', 'articles')
  uploadData.set('altText', text(formData, 'featuredImageAlt'))
  uploadData.set('caption', '')
  uploadData.set('attribution', '')
  uploadData.set('isDecorative', 'off')
  uploadData.set('isPublic', 'on')

  const result = await uploadMediaAction(null, uploadData)
  if (!result.ok) {
    return {
      ok: false,
      message: result.message,
      fieldErrors: result.fieldErrors
        ? {
            featured_image_id: Object.values(result.fieldErrors).join(' '),
          }
        : undefined,
    }
  }
  if (!result.asset) {
    return { ok: false, message: 'The featured image could not be uploaded.' }
  }
  return { id: result.asset.id }
}

/* -------------------------------------------------------------------------- */
/* Row payload                                                                */
/* -------------------------------------------------------------------------- */

function buildRow(
  value: ReturnType<typeof articleSchema.parse>,
  userId: string,
  mode: 'create' | 'update',
): { row: ArticleInsert; sanitisedBody: string; warnings: string[] } {
  const now = new Date().toISOString()
  const warnings: string[] = []

  /*
   * Sanitise before anything else is decided, then validate the RESULT rather
   * than the raw input. An editor who submits a body that sanitises away to
   * nothing must not be told "published successfully" and left with an empty
   * public page.
   */
  const derived = deriveArticleContent(value.content)
  const sanitisedBody = derived.content

  const row: ArticleInsert = {
    slug: value.slug,
    title: value.title,
    excerpt: value.excerpt,
    content: derived.content,
    content_plain: derived.content_plain,
    word_count: derived.word_count,
    reading_time_minutes: derived.reading_time_minutes,
    status: value.status,
    author_id: value.author_id,
    noindex: value.noindex,
    allow_sitemap: value.allow_sitemap,
    seo_title: value.seo_title,
    seo_description: value.seo_description,
    canonical_url: value.canonical_url,
    // The FAQ block is stored whole. It is read and written as one value, never
    // queried across articles, so a child table would cost a second query on
    // the page that has to render it.
    faq_items: value.faq_items,
    updated_by: userId,
  }

  if (mode === 'create') {
    row.created_by = userId
    row.created_at = now
  }

  // --- lifecycle timestamps -------------------------------------------
  if (value.status === 'scheduled') {
    row.scheduled_for = localDateTimeToIso(value.scheduled_for)
  } else {
    row.scheduled_for = null
  }

  if (value.status === 'published') {
    row.published_at = now
    row.scheduled_for = null
  }

  if (value.status === 'archived') {
    row.archived_at = now
  }

  if (value.status === 'draft' || value.status === 'in_review') {
    row.archived_at = null
  }

  /*
   * A noindex article cannot also be in the sitemap — the database enforces
   * this with a CHECK constraint. Toggling noindex alone would fail the whole
   * write, so the two are kept consistent here rather than surprising the
   * editor with a constraint error.
   */
  if (value.noindex && value.allow_sitemap) {
    row.allow_sitemap = false
    warnings.push(
      'Sitemap inclusion was turned off, because an article marked no-index cannot also be listed in the sitemap.',
    )
  }

  /*
   * The featured image is verified to EXIST rather than trusted.
   *
   * The foreign key would reject a bad id, but with a constraint error that names
   * a column the editor never touched. The image is also required to carry alt
   * text or an explicit decorative flag — migration 030 makes that true of every
   * stored asset, so this check catches a reference to something that was
   * archived-and-purged or written by a future migration that skipped the rule.
   */
  row.featured_image_id = value.featured_image_id

  return { row, sanitisedBody, warnings }
}

/* -------------------------------------------------------------------------- */
/* Featured image                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Confirm the chosen image exists and is usable.
 *
 * Returns an `ArticleActionResult` on failure so the caller can return it
 * directly. The foreign key would catch a bad id, but with an error naming a
 * column the editor never touched — and an ARCHIVED asset still resolves through
 * the foreign key while being something nobody should be choosing for a new page.
 */
async function verifyFeaturedImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  imageId: string | null,
): Promise<ArticleActionResult | null> {
  if (!imageId) return null

  const { data } = await supabase
    .from('media_assets')
    .select('id, archived_at, alt_text, is_decorative')
    .eq('id', imageId)
    .maybeSingle()

  if (!data) {
    return {
      ok: false,
      message: 'That image is no longer in the library. Choose another.',
      fieldErrors: { featured_image_id: 'That image could not be found.' },
    }
  }

  if (data.archived_at) {
    return {
      ok: false,
      message:
        'That image has been archived. Restore it in the media library or choose another.',
      fieldErrors: { featured_image_id: 'That image is archived.' },
    }
  }

  // Unreachable since migration 030, and kept so a future schema change that drops
  // the CHECK surfaces here rather than as an image with no accessible name.
  if (!data.is_decorative && !data.alt_text) {
    return {
      ok: false,
      message: 'That image has no alt text. Describe it in the media library first.',
      fieldErrors: { featured_image_id: 'That image has no alt text.' },
    }
  }

  return null
}

/* -------------------------------------------------------------------------- */
/* Relations                                                                  */
/* -------------------------------------------------------------------------- */

async function replaceRelations(
  articleId: string,
  relations: ArticleRelations,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createClient()

  const categoryIds = [...new Set(relations.category_ids)]
  const tagIds = [...new Set(relations.tag_ids)]
  const scholarshipIds = [...new Set(relations.scholarship_ids)]

  {
    const { error } = await supabase
      .from('article_category_links')
      .delete()
      .eq('article_id', articleId)
    if (error) return { ok: false, message: error.message }
  }
  if (categoryIds.length > 0) {
    const { error } = await supabase
      .from('article_category_links')
      .insert(
        categoryIds.map((article_category_id) => ({
          article_id: articleId,
          article_category_id,
        })),
      )
    if (error) return { ok: false, message: error.message }
  }

  {
    const { error } = await supabase
      .from('article_tag_links')
      .delete()
      .eq('article_id', articleId)
    if (error) return { ok: false, message: error.message }
  }
  if (tagIds.length > 0) {
    const { error } = await supabase
      .from('article_tag_links')
      .insert(tagIds.map((tag_id) => ({ article_id: articleId, tag_id })))
    if (error) return { ok: false, message: error.message }
  }

  {
    const { error } = await supabase
      .from('article_scholarships')
      .delete()
      .eq('article_id', articleId)
    if (error) return { ok: false, message: error.message }
  }
  if (scholarshipIds.length > 0) {
    const { error } = await supabase
      .from('article_scholarships')
      .insert(
        scholarshipIds.map((scholarship_id) => ({
          article_id: articleId,
          scholarship_id,
        })),
      )
    if (error) return { ok: false, message: error.message }
  }

  return { ok: true }
}

function revalidate(slug?: string | null) {
  revalidatePath('/admin/articles')
  if (slug) revalidatePath(`/admin/articles/${slug}`)
  revalidatePath('/articles')
  revalidatePath('/')
}

function friendlyWriteError(
  code: string | null | undefined,
  message: string | undefined,
): string {
  console.error('[admin] article write failed:', code, message)

  switch (code) {
    case '23505':
      return 'Another record already uses that unique value.'
    case '23514':
      return 'Those values break a data rule. Check the status, dates and indexing settings.'
    case '23503':
      return 'A referenced record does not exist. Reload the page and try again.'
    case '42501':
      return 'You do not have permission to do that.'
    default:
      return 'The change could not be saved. Please try again.'
  }
}

/* -------------------------------------------------------------------------- */
/* Create                                                                     */
/* -------------------------------------------------------------------------- */

export async function createArticleAction(
  _prev: ArticleActionResult | null,
  formData: FormData,
): Promise<ArticleActionResult> {
  const { user } = await requirePermission('article.create')

  const parsed = articleSchema.safeParse(buildInput(formData))
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Please correct the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    }
  }

  const uploadedImage = await uploadFeaturedImage(formData)
  if (uploadedImage && 'ok' in uploadedImage) return uploadedImage
  const value = uploadedImage
    ? { ...parsed.data, featured_image_id: uploadedImage.id }
    : parsed.data
  /*
   * `warnings` is intentionally not used here. Create ends in a `redirect` to the
   * edit screen, which throws away the action result — there is nowhere to
   * surface them, and appending them to the URL would put editorial notes into
   * the address bar. The only warning (sitemap inclusion cleared by `noindex`) is
   * visible immediately on the edit screen the user lands on.
   */
  const { row, sanitisedBody } = buildRow(value, user.id, 'create')

  // Re-check publication against the SANITISED body.
  if (value.status === 'published' && sanitisedBody.trim().length === 0) {
    return {
      ok: false,
      message:
        'The article body was empty after the content was cleaned. Add some text before publishing.',
      fieldErrors: { content: 'The body is empty after sanitisation.' },
    }
  }

  const supabase = await createClient()

  const imageProblem = await verifyFeaturedImage(supabase, value.featured_image_id)
  if (imageProblem) return imageProblem

  const { data: clash } = await supabase
    .from('articles')
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
    .from('articles')
    .insert(row)
    .select('id')
    .single()

  if (error || !inserted) {
    return { ok: false, message: friendlyWriteError(error?.code, error?.message) }
  }

  const relations = await replaceRelations(inserted.id, {
    category_ids: value.article_category_ids,
    tag_ids: value.article_tag_ids,
    scholarship_ids: value.scholarship_ids,
  })

  if (!relations.ok) {
    return {
      ok: false,
      message: `The article was created, but its categories or links could not be saved: ${relations.message}`,
      id: inserted.id,
    }
  }

  await supabase.rpc('write_audit_log', {
    p_action: 'article.create',
    p_entity_type: 'article',
    p_entity_id: inserted.id,
    p_after: { title: value.title, slug: value.slug, status: value.status },
  })

  revalidate(value.slug)
  redirect(`/admin/articles/${inserted.id}`)
}

/* -------------------------------------------------------------------------- */
/* Update                                                                     */
/* -------------------------------------------------------------------------- */

export async function updateArticleAction(
  _prev: ArticleActionResult | null,
  formData: FormData,
): Promise<ArticleActionResult> {
  const { user } = await requirePermission('article.manage')

  const id = text(formData, 'id')
  if (!id) return { ok: false, message: 'Missing article reference.' }

  const parsed = articleSchema.safeParse(buildInput(formData))
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Please correct the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    }
  }

  const uploadedImage = await uploadFeaturedImage(formData)
  if (uploadedImage && 'ok' in uploadedImage) return uploadedImage
  const value = uploadedImage
    ? { ...parsed.data, featured_image_id: uploadedImage.id }
    : parsed.data
  const { row, sanitisedBody, warnings } = buildRow(value, user.id, 'update')

  if (value.status === 'published' && sanitisedBody.trim().length === 0) {
    return {
      ok: false,
      message:
        'The article body was empty after the content was cleaned. Add some text before publishing.',
      fieldErrors: { content: 'The body is empty after sanitisation.' },
    }
  }

  const supabase = await createClient()

  const imageProblem = await verifyFeaturedImage(supabase, value.featured_image_id)
  if (imageProblem) return imageProblem

  const { data: before } = await supabase
    .from('articles')
    .select('title, slug, status')
    .eq('id', id)
    .maybeSingle()

  const { data: clash } = await supabase
    .from('articles')
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

  const { error } = await supabase.from('articles').update(row).eq('id', id)

  if (error) {
    return { ok: false, message: friendlyWriteError(error.code, error.message) }
  }

  const relations = await replaceRelations(id, {
    category_ids: value.article_category_ids,
    tag_ids: value.article_tag_ids,
    scholarship_ids: value.scholarship_ids,
  })

  if (!relations.ok) {
    return {
      ok: false,
      message: `The changes were saved, but the categories or links could not be updated: ${relations.message}`,
    }
  }

  await supabase.rpc('write_audit_log', {
    p_action: 'article.update',
    p_entity_type: 'article',
    p_entity_id: id,
    p_before: before ?? null,
    p_after: {
      title: value.title,
      slug: value.slug,
      status: value.status,
      featured_image_id: value.featured_image_id,
    },
  })

  revalidate(value.slug)
  // The warnings are surfaced alongside the success rather than swallowed: the
  // sitemap inclusion was changed on the editor's behalf, and a silent correction
  // is how a record ends up indexable in a way nobody chose.
  return {
    ok: true,
    message: 'Changes saved.',
    ...(warnings.length > 0 ? { warnings } : {}),
  }
}

/* -------------------------------------------------------------------------- */
/* Workflow                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Move an article to a new status.
 *
 * Author-role restrictions are enforced by RLS, not here: an author who
 * attempts to publish their own draft is refused by the UPDATE policy, and
 * this action surfaces that as a plain error rather than a crash.
 */
export async function setArticleStatusAction(
  id: string,
  next: ArticleStatus,
): Promise<ArticleActionResult> {
  await requirePermission('article.manage')

  if (!ARTICLE_STATUSES.includes(next)) {
    return { ok: false, message: 'Unknown status.' }
  }

  const supabase = await createClient()

  const { data: current, error: loadError } = await supabase
    .from('articles')
    .select('id, slug, title, status, content, scheduled_for')
    .eq('id', id)
    .maybeSingle()

  if (loadError || !current) {
    return { ok: false, message: 'That article could not be found.' }
  }

  const now = new Date().toISOString()
  const patch: ArticleUpdate = { status: next }

  if (next === 'published') {
    // Publish against the SANITISED body, not the stored draft.
    const { content: sanitised } = deriveArticleContent(current.content)
    if (sanitised.trim().length === 0) {
      return {
        ok: false,
        message: 'This article has no readable content yet.',
      }
    }
    patch.published_at = now
    patch.scheduled_for = null
    patch.archived_at = null
  }

  if (next === 'scheduled') {
    if (!current.scheduled_for) {
      return {
        ok: false,
        message: 'Choose a publication date before scheduling.',
      }
    }
    patch.published_at = null
  }

  if (next === 'archived') patch.archived_at = now
  if (next === 'draft') patch.archived_at = null

  const { error } = await supabase.from('articles').update(patch).eq('id', id)

  if (error) {
    if (error.code === '42501') {
      return {
        ok: false,
        message:
          'You are not allowed to make that change. Authors can only edit their own drafts.',
      }
    }
    return { ok: false, message: friendlyWriteError(error.code, error.message) }
  }

  await supabase.rpc('write_audit_log', {
    p_action: 'article.status_change',
    p_entity_type: 'article',
    p_entity_id: id,
    p_before: { status: current.status },
    p_after: { status: next },
  })

  revalidate(current.slug)
  return { ok: true, message: `Moved to ${next.replace('_', ' ')}.` }
}

/** Record a review decision. Requires `article.review`. */
export async function submitReviewAction(
  id: string,
  decision: 'approved' | 'changes_requested' | 'rejected',
  notes: string,
): Promise<ArticleActionResult> {
  const { user } = await requirePermission('article.review')

  const parsed = reviewSchema.safeParse({ id, decision, notes })
  if (!parsed.success) {
    return { ok: false, message: 'Choose a valid review decision and provide no more than 4,000 characters of notes.' }
  }

  const supabase = await createClient()

  const { error } = await supabase.from('article_reviews').insert({
    article_id: parsed.data.id,
    reviewer_id: user.id,
    decision: parsed.data.decision,
    notes: parsed.data.notes || null,
  })

  if (error) {
    return { ok: false, message: friendlyWriteError(error.code, error.message) }
  }

  await supabase.rpc('write_audit_log', {
    p_action: 'article.review',
    p_entity_type: 'article',
    p_entity_id: parsed.data.id,
    p_after: { decision: parsed.data.decision, notes: parsed.data.notes || null },
  })

  const nextStatus = parsed.data.decision === 'changes_requested'
    ? 'draft'
    : parsed.data.decision === 'rejected'
      ? 'archived'
      : 'in_review'
  const { error: statusError } = await supabase
    .from('articles')
    .update({ status: nextStatus, reviewed_at: new Date().toISOString() })
    .eq('id', parsed.data.id)
  if (statusError) return { ok: false, message: 'The review was recorded, but the article status could not be updated.' }

  revalidate()
  return { ok: true, message: `Review recorded: ${parsed.data.decision.replace('_', ' ')}.` }
}

/** Save the editable title and body without changing lifecycle state. */
export async function autosaveArticleAction(
  id: string,
  title: string,
  content: string,
): Promise<ArticleActionResult> {
  const { user } = await requirePermission('article.manage')
  const parsed = autosaveSchema.safeParse({ id, title, content })
  if (!parsed.success) return { ok: false, message: 'Autosave skipped because the draft is invalid.' }

  const derived = deriveArticleContent(parsed.data.content)
  const supabase = await createClient()
  const { error } = await supabase
    .from('articles')
    .update({
      title: parsed.data.title,
      content: derived.content,
      content_plain: derived.content_plain,
      word_count: derived.word_count,
      reading_time_minutes: derived.reading_time_minutes,
      updated_by: user.id,
    })
    .eq('id', parsed.data.id)

  if (error) return { ok: false, message: 'Autosave could not be completed.' }
  revalidatePath(`/admin/articles/${parsed.data.id}`)
  return { ok: true, message: 'Draft autosaved.' }
}

/**
 * Delete an article.
 *
 * Requires `article.delete`. Revisions and join rows cascade in the database.
 * Deletion is permanent, so archiving is normally preferred.
 */
export async function deleteArticleAction(
  id: string,
): Promise<ArticleActionResult> {
  await requirePermission('article.delete')

  const supabase = await createClient()

  const { data: current } = await supabase
    .from('articles')
    .select('title, slug')
    .eq('id', id)
    .maybeSingle()

  if (!current) {
    return { ok: false, message: 'That article could not be found.' }
  }

  const { error } = await supabase.from('articles').delete().eq('id', id)

  if (error) {
    return { ok: false, message: friendlyWriteError(error.code, error.message) }
  }

  await supabase.rpc('write_audit_log', {
    p_action: 'article.delete',
    p_entity_type: 'article',
    p_entity_id: id,
    p_before: { title: current.title, slug: current.slug },
  })

  revalidate(current.slug)
  return { ok: true, message: 'Deleted.' }
}
