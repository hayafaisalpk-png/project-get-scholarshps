import { notFound } from 'next/navigation'
import Link from 'next/link'

import { Alert } from '@/components/ui/alert'
import { EditScholarshipForm } from '@/features/scholarships/admin/components/scholarship-form'
import {
  getAdminScholarship,
  getTaxonomyOptions,
} from '@/features/scholarships/admin/queries'
import { requirePermission } from '@/lib/auth/guards'
import { formatDate } from '@/lib/format'

export const metadata = { title: 'Edit scholarship' }

/**
 * Edit a scholarship.
 *
 * `params` is a Promise in Next.js 16 and must be awaited.
 */
export default async function EditScholarshipPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermission('scholarship.manage')

  const { id } = await params

  const [detail, options] = await Promise.all([
    getAdminScholarship(id),
    getTaxonomyOptions(),
  ])

  // RLS already hides records this viewer may not see, so a miss here means
  // either "gone" or "not permitted" — both are a 404 rather than a 403 that
  // would confirm the record exists.
  if (!detail.ok) {
    throw new Error(detail.error.message)
  }

  if (!detail.data) {
    notFound()
  }

  const { record, taxonomy } = detail.data

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">{record.title}</h1>
          <p className="mt-1 text-sm text-ink-600">
            {record.sponsor_name} ·{' '}
            <span className="capitalize">{record.status.replace('_', ' ')}</span>
          </p>
          <p className="mt-1 text-xs text-ink-500">
            Last updated {formatDate(record.updated_at)}
            {record.published_at
              ? ` · published ${formatDate(record.published_at)}`
              : ''}
          </p>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <Link
            href="/admin/scholarships"
            className="font-medium text-ink-600 hover:text-brand-700 hover:underline"
          >
            All scholarships
          </Link>
          {record.status === 'published' ? (
            <Link
              href={`/scholarships/${record.slug}`}
              className="font-medium text-brand-700 hover:underline"
            >
              View public page →
            </Link>
          ) : null}
        </div>
      </div>

      {/*
        Changing the slug of a published record breaks its URL. The schema
        requires a redirect entry, which is Phase 5 work, so it is called out
        here rather than silently allowed.
      */}
      {record.published_at ? (
        <Alert tone="warning" title="This record is live">
          Changing the slug changes its public address. A redirect must be
          created separately so existing links keep working.
        </Alert>
      ) : null}

      {!options.ok ? (
        <Alert tone="error">
          The classification lists could not be loaded, so categories, levels
          and locations cannot be edited on this save. ({options.error.userMessage}
          )
        </Alert>
      ) : null}

      <EditScholarshipForm
        record={record}
        taxonomyOptions={
          options.ok
            ? options.data
            : { categories: [], educationLevels: [], fields: [], locations: [] }
        }
        selected={taxonomy}
      />
    </div>
  )
}