import 'server-only'

import { cache } from 'react'

import { DatabaseError, type DbResult, toDatabaseError } from '@/lib/db/errors'
import { createAdminClient } from '@/lib/supabase/admin'
import { NEWSLETTER_STATUSES } from '@/lib/validation/newsletter'

/**
 * Administration query for newsletter subscribers.
 *
 * READ-ONLY, and this one is more consequential than the other inboxes: the rows
 * hold real people's email addresses together with a record of what they
 * consented to and when. `newsletter_subscribers` is revoked from every client
 * role, so it is read through the SERVICE-ROLE client rather than the session
 * client — there is no RLS policy to lean on.
 *
 * That makes `requirePermission('newsletter.manage')` in the route the ONLY
 * application-level gate, and it is why the page must not be reachable by
 * anything but a direct call. The permission check is therefore not a
 * presentation detail here; it is the boundary.
 *
 * No DELETE and no export. A list of subscribers is exportable personal data,
 * and an accidental bulk export is not a mistake worth being able to make.
 */
export const SUBSCRIBER_PAGE_SIZE = 50

export type SubscriberRow = {
  id: string
  email: string
  status: string
  source: string | null
  consentGivenAt: string | null
  createdAt: string
}

export type SubscriberListResult = {
  items: SubscriberRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export const listSubscribers = cache(
  async (params: {
    status?: string | undefined
    page?: number | undefined
  }): Promise<DbResult<SubscriberListResult>> => {
    if (!hasServiceRole()) {
      // A typed DatabaseError rather than a thrown Error, so the page can render
      // the same "could not be loaded" state it uses for any other failure.
      return {
        ok: false,
        error: new DatabaseError(
          'unavailable',
          'SUPABASE_SERVICE_ROLE_KEY is not configured.',
        ),
      }
    }

    const admin = createAdminClient()
    const pageSize = SUBSCRIBER_PAGE_SIZE
    const page = Math.max(1, params.page ?? 1)
    const from = (page - 1) * pageSize
    const status = NEWSLETTER_STATUSES.find((s) => s === params.status)

    let query = admin
      .from('newsletter_subscribers')
      .select('id, email, status, source, consent_given_at, created_at', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)

    if (status) query = query.eq('status', status)

    const { data, error, count } = await query

    if (error) return { ok: false, error: toDatabaseError(error) }

    const total = count ?? 0
    const rows = (data ?? []) as {
      id: string
      email: string
      status: string
      source: string | null
      consent_given_at: string | null
      created_at: string
    }[]

    return {
      ok: true,
      data: {
        items: rows.map((row) => ({
          id: row.id,
          email: row.email,
          status: row.status,
          source: row.source,
          consentGivenAt: row.consent_given_at,
          createdAt: row.created_at,
        })),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    }
  },
)

/** Counts per status, for the filter tabs. */
export const subscriberStatusCounts = cache(
  async (): Promise<Record<string, number>> => {
    const counts: Record<string, number> = {}
    for (const status of NEWSLETTER_STATUSES) counts[status] = 0

    if (!hasServiceRole()) return counts

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('newsletter_subscribers')
      .select('status')

    if (error) return counts

    for (const row of data ?? []) {
      const key = String(row.status)
      if (key in counts) counts[key] = (counts[key] ?? 0) + 1
    }

    return counts
  },
)

/** Whether the service-role key is configured, so callers degrade gracefully. */
function hasServiceRole(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
}