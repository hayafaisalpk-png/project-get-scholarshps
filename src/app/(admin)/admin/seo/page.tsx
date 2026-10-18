import Link from 'next/link'

import { EmptyState } from '@/components/ui/empty-state'
import { SeoRecordList } from '@/features/seo/components/seo-record-list'
import { getSeoOverview } from '@/features/seo/queries'
import { requirePermission } from '@/lib/auth/guards'

/**
 * SEO overview.
 *
 * One screen answering "is anything wrong with how this site presents itself to a
 * crawler", across scholarships, articles and content pages at once. Problems of
 * this kind are rarely confined to one table, and an audit you have to run three
 * times is an audit nobody runs.
 *
 * It reports; it does not enforce. The guardrails live in
 * `src/features/seo/guardrails.ts` and are applied by `setIndexAction` on save —
 * nothing here can make an unpublishable record indexable, and this screen shows
 * what the database actually holds rather than what a checkbox claims.
 *
 * `seo.manage` is required. RLS backs it up: the reads behind this screen are
 * filtered by the same permissions as the CMS forms that edit those records.
 */
export const metadata = { title: 'SEO' }

export default async function AdminSeoPage() {
  await requirePermission('seo.manage')

  const result = await getSeoOverview()

  if (!result.ok) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-ink-900">SEO</h1>
        </header>
        <EmptyState
          title="The SEO overview could not be loaded"
          description="Something went wrong while reading the content. Please try again."
        />
      </div>
    )
  }

  const { records, issues, totals, media } = result.data
  const warnings = issues.filter((issue) => issue.severity === 'warning')

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-ink-900">SEO</h1>
        <p className="mt-1 text-sm text-ink-600">
          Indexing across every record on the site. A record that is not published
          cannot be made indexable — publish it first.
        </p>
      </header>

      <dl className="grid gap-3 sm:grid-cols-4">
        <Stat label="Indexable" value={totals.indexable} />
        <Stat label="Excluded (no-index)" value={totals.noindex} />
        <Stat label="Not on the site yet" value={totals.unreachable} />
        <Stat label="Contradictions" value={totals.warnings} tone={totals.warnings > 0 ? 'warning' : 'default'} />
      </dl>

      {warnings.length > 0 ? (
        <section aria-labelledby="seo-issues-heading">
          <h2 id="seo-issues-heading" className="text-base font-semibold text-ink-900">
            Contradictions to fix
          </h2>
          <ul className="mt-3 space-y-2">
            {warnings.map((issue) => {
              const record = records.find((r) => issue.key.includes(r.id))
              return (
                <li
                  key={issue.key}
                  className="rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                >
                  {record ? (
                    <>
                      <span className="font-semibold">{record.title}: </span>
                      <span className="text-ink-700">{issue.message}</span>
                      <Link
                        href={
                          record.kind === 'scholarship'
                            ? `/admin/scholarships/${record.id}`
                            : record.kind === 'article'
                              ? `/admin/articles/${record.id}`
                              : '/admin/settings'
                        }
                        className="ml-2 underline underline-offset-4"
                      >
                        Open
                      </Link>
                    </>
                  ) : (
                    issue.message
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {/*
        Alt-text coverage. Since migration 030 the database refuses an asset that
        is neither described nor explicitly decorative, so `missing` should always
        be zero — it is displayed precisely so that it cannot quietly become
        non-zero after a schema change.

        NOTE: no image is rendered on the public site yet, so this number
        describes the library rather than the visitor's experience. The
        featured-image picker (Phase 4) is what puts it in front of anyone.
      */}
      <section aria-labelledby="media-coverage-heading">
        <h2 id="media-coverage-heading" className="text-base font-semibold text-ink-900">
          Image alt text
        </h2>
        <p className="mt-1 text-sm text-ink-600">
          {media.total === 0
            ? 'No images in the library yet.'
            : `${media.described} of ${media.total} described, ${media.decorative} marked decorative.`}
        </p>
        {media.missing > 0 ? (
          <p role="alert" className="mt-2 text-sm font-medium text-red-700">
            {media.missing} image{media.missing === 1 ? '' : 's'} have neither alt
            text nor a decorative flag. The database is supposed to refuse this.
          </p>
        ) : null}
      </section>

      <SeoRecordList records={records} issues={issues} />
    </div>
  )
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'warning'
}) {
  return (
    <div
      className={`rounded-sm border p-4 ${
        tone === 'warning' ? 'border-red-200 bg-red-50' : 'border-ink-200 bg-white'
      }`}
    >
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-bold text-ink-900">{value.toLocaleString('en-US')}</dd>
    </div>
  )
}