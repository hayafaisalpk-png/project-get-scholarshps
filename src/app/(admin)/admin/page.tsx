import type { Metadata } from 'next'
import {
  FileText,
  GraduationCap,
  Images,
  Layers,
  MapPin,
  ScrollText,
  Tags,
  Users,
} from 'lucide-react'

import { StatCard } from '@/features/admin/components/stat-card'
import { getDashboardStats } from '@/lib/admin/stats'
import { requireCmsUser } from '@/lib/auth/guards'
import { formatTimestamp } from '@/lib/format'

export const metadata: Metadata = { title: 'Dashboard' }

/**
 * Administration dashboard.
 *
 * Every figure below comes from a live database query. On a fresh installation
 * they legitimately read zero, and the page says so plainly rather than
 * inventing sample content to make itself look populated.
 *
 * This route is intentionally narrow: it summarises what already exists. It
 * deliberately links only to the dashboard, because linking to scholarship,
 * article and media screens that do not exist yet would produce 404s.
 */
export default async function AdminDashboardPage() {
  const { user, roles, permissions } = await requireCmsUser({
    redirectTo: '/admin',
  })

  const stats = await getDashboardStats(permissions)

  const hasContent =
    (stats.scholarships?.total ?? 0) > 0 || (stats.articles?.total ?? 0) > 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Dashboard</h1>
        <p className="mt-1 text-sm text-ink-600">
          Signed in as {user.email ?? 'an authenticated account'}
          {roles.length > 0 ? (
            <>
              {' '}
              with{' '}
              <span className="font-medium text-ink-800">{roles.join(', ')}</span>
            </>
          ) : null}
          .
        </p>
      </div>

      {!hasContent ? (
        <div className="rounded-sm border border-brand-200 bg-brand-50 p-6">
          <h2 className="text-base font-semibold text-brand-900">
            No content has been published yet
          </h2>
          <p className="mt-2 text-sm text-brand-800">
            The database currently holds reference data only — roles,
            permissions, taxonomy and site settings. Scholarship and article
            management is the next phase to be built; until then there is
            nothing to create, and no records have been invented to fill the
            gap.
          </p>
        </div>
      ) : null}

      {stats.unavailable.length > 0 ? (
        <p className="rounded-sm bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200 ring-inset">
          Some figures could not be read: {stats.unavailable.join(', ')}. They
          are shown as “—” rather than as zero, because zero would be a claim
          about the data.
        </p>
      ) : null}

      <section aria-labelledby="content-heading" className="space-y-4">
        <h2
          id="content-heading"
          className="text-sm font-semibold tracking-wide text-ink-500 uppercase"
        >
          Content
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Scholarships"
            value={stats.scholarships?.total ?? null}
            icon={GraduationCap}
            hint={
              stats.scholarships
                ? `${stats.scholarships.published} published · ${stats.scholarships.draft} draft`
                : undefined
            }
          />
          <StatCard
            label="Articles"
            value={stats.articles?.total ?? null}
            icon={FileText}
            hint={
              stats.articles
                ? `${stats.articles.published} published · ${stats.articles.draft} draft`
                : undefined
            }
          />
          <StatCard
            label="Media assets"
            value={stats.media.total}
            icon={Images}
          />
          <StatCard label="Users" value={stats.users.total} icon={Users} />
        </div>
      </section>

      <section aria-labelledby="taxonomy-heading" className="space-y-4">
        <h2
          id="taxonomy-heading"
          className="text-sm font-semibold tracking-wide text-ink-500 uppercase"
        >
          Taxonomy
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Categories"
            value={stats.taxonomy.categories}
            icon={Layers}
          />
          <StatCard label="Tags" value={stats.taxonomy.tags} icon={Tags} />
          <StatCard
            label="Education levels"
            value={stats.taxonomy.educationLevels}
            icon={GraduationCap}
          />
          <StatCard
            label="Locations"
            value={stats.taxonomy.locations}
            icon={MapPin}
          />
        </div>
      </section>

      {permissions.includes('audit.view') ? (
        <section aria-labelledby="activity-heading" className="space-y-4">
          <h2
            id="activity-heading"
            className="text-sm font-semibold tracking-wide text-ink-500 uppercase"
          >
            Recent activity
          </h2>

          {stats.recentActivity.length === 0 ? (
            <p className="rounded-sm border border-ink-200 bg-white p-6 text-sm text-ink-600">
              No administrative actions have been recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-sm border border-ink-200 bg-white">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">
                  The ten most recent administrative actions
                </caption>
                <thead className="border-b border-ink-200 bg-ink-50 text-xs tracking-wide text-ink-600 uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Action
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Entity
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Actor
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      When
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {stats.recentActivity.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-4 py-3 font-medium text-ink-900">
                        <span className="inline-flex items-center gap-2">
                          <ScrollText
                            className="size-4 text-ink-400"
                            aria-hidden="true"
                          />
                          {entry.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink-700">
                        {entry.entityType}
                        {entry.entityId ? (
                          <span className="ml-1 text-xs text-ink-400">
                            ({entry.entityId.slice(0, 8)})
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-ink-700">
                        {entry.actorEmail ?? '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-ink-600">
                        {formatTimestamp(entry.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}