import 'server-only'

import { cache } from 'react'

import { type DbResult, toDatabaseError } from '@/lib/db/errors'
import { createClient } from '@/lib/supabase/server'
import { CONTACT_STATUSES, REPORT_STATUSES } from '@/lib/validation/inbox'

/**
 * Administration queries for submitted messages and content reports.
 *
 * SELECT-only. `contact_submissions` and `content_reports` are both private
 * tables whose SELECT policies require a permission (migration 022 and 010
 * respectively), so RLS decides who sees what — there is no filter here that a
 * caller could forget.
 *
 * The writes live in `./actions`. Neither table grants DELETE, and correspondence
 * with a member of the public should not disappear through a single CMS action,
 * so triage is expressed as a status and never as removal.
 *
 * `CONTACT_STATUSES` and `REPORT_STATUSES` are re-exported from
 * `@/lib/validation/inbox` rather than redeclared: the filter tabs, the Server
 * Actions and the database enums must agree, and one list has one home.
 */

export const INBOX_PAGE_SIZE = 25

export { CONTACT_STATUSES, REPORT_STATUSES }

export type ContactSubmissionRow = {
  id: string
  name: string
  email: string
  subject: string
  message: string
  status: string
  created_at: string
  /** Set when a message is resolved; null again if it is reopened. */
  handled_at: string | null
}

export type ContentReportRow = {
  id: string
  reason: string
  details: string | null
  reporter_email: string | null
  status: string
  created_at: string
  resolved_at: string | null
  resolution_note: string | null
  scholarshipId: string | null
  articleId: string | null
  /** Denormalised for display, so the inbox can name the record. */
  targetTitle: string | null
  targetHref: string | null
}

export type InboxList<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type InboxParams = {
  status?: string | undefined
  page?: number | undefined
}

/* -------------------------------------------------------------------------- */
/* Contact messages                                                            */
/* -------------------------------------------------------------------------- */

export const listContactSubmissions = cache(
  async (params: InboxParams): Promise<DbResult<InboxList<ContactSubmissionRow>>> => {
    const supabase = await createClient()
    const pageSize = INBOX_PAGE_SIZE
    const page = Math.max(1, params.page ?? 1)
    const from = (page - 1) * pageSize
    const status = CONTACT_STATUSES.find((s) => s === params.status)

    let query = supabase
      .from('contact_submissions')
      .select('id, name, email, subject, message, status, created_at, handled_at', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)

    if (status) query = query.eq('status', status)

    const { data, error, count } = await query

    if (error) return { ok: false, error: toDatabaseError(error) }

    const total = count ?? 0

    return {
      ok: true,
      data: {
        items: (data ?? []) as ContactSubmissionRow[],
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    }
  },
)

/** Counts per status, for the filter tabs. */
export const contactStatusCounts = cache(async (): Promise<Record<string, number>> => {
  const supabase = await createClient()

  const counts: Record<string, number> = {}
  for (const status of CONTACT_STATUSES) counts[status] = 0

  const { data, error } = await supabase
    .from('contact_submissions')
    .select('status')

  if (error) return counts

  for (const row of data ?? []) {
    const key = row.status as string
    if (key in counts) counts[key] = (counts[key] ?? 0) + 1
  }

  return counts
})

/* -------------------------------------------------------------------------- */
/* Content reports                                                             */
/* -------------------------------------------------------------------------- */

type ReportJoinRow = {
  id: string
  reason: string
  details: string | null
  reporter_email: string | null
  status: string
  created_at: string
  resolved_at: string | null
  resolution_note: string | null
  scholarship_id: string | null
  article_id: string | null
  scholarships: { title: string; slug: string } | null
  articles: { title: string; slug: string } | null
}

export const listContentReports = cache(
  async (params: InboxParams): Promise<DbResult<InboxList<ContentReportRow>>> => {
    const supabase = await createClient()
    const pageSize = INBOX_PAGE_SIZE
    const page = Math.max(1, params.page ?? 1)
    const from = (page - 1) * pageSize
    const status = REPORT_STATUSES.find((s) => s === params.status)

    let query = supabase
      .from('content_reports')
      .select(
        'id, reason, details, reporter_email, status, created_at, resolved_at, resolution_note, scholarship_id, article_id, scholarships(title, slug), articles(title, slug)',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)

    if (status) query = query.eq('status', status)

    const { data, error, count } = await query

    if (error) return { ok: false, error: toDatabaseError(error) }

    const rows = (data ?? []) as unknown as ReportJoinRow[]
    const total = count ?? 0

    return {
      ok: true,
      data: {
        items: rows.map((row) => ({
          id: row.id,
          reason: row.reason,
          details: row.details,
          reporter_email: row.reporter_email,
          status: row.status,
          created_at: row.created_at,
          resolved_at: row.resolved_at,
          resolution_note: row.resolution_note,
          scholarshipId: row.scholarship_id,
          articleId: row.article_id,
          targetTitle: row.scholarships?.title ?? row.articles?.title ?? null,
          targetHref: row.scholarships
            ? `/scholarships/${row.scholarships.slug}`
            : row.articles
              ? `/articles/${row.articles.slug}`
              : null,
        })),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    }
  },
)

export const reportStatusCounts = cache(async (): Promise<Record<string, number>> => {
  const supabase = await createClient()

  const counts: Record<string, number> = {}
  for (const status of REPORT_STATUSES) counts[status] = 0

  const { data, error } = await supabase.from('content_reports').select('status')

  if (error) return counts

  for (const row of data ?? []) {
    const key = row.status as string
    if (key in counts) counts[key] = (counts[key] ?? 0) + 1
  }

  return counts
})