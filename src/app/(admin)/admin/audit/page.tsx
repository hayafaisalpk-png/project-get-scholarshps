import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { requirePermission } from '@/lib/auth/guards'
import { formatTimestamp } from '@/lib/format'
import { listAuditLog } from '@/features/audit/queries'

export const metadata = { title: 'Audit log' }

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  await requirePermission('audit.view')

  const params = await searchParams
  const page = Number.parseInt(params.page ?? '1', 10)
  const result = await listAuditLog(Number.isFinite(page) ? page : 1)

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-ink-900">Audit log</h1>
        <p className="mt-1 text-sm text-ink-600">
          The most recent administrative actions, newest first. Read-only.
        </p>
      </header>

      {result.items.length === 0 ? (
        <EmptyState
          title="No administrative actions recorded"
          description="Actions appear here as editors manage content."
        />
      ) : (
        <div className="overflow-x-auto rounded-sm border border-ink-200 bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Administrative audit log</caption>
            <thead className="border-b border-ink-200 bg-ink-50 text-xs tracking-wide text-ink-600 uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">When</th>
                <th scope="col" className="px-4 py-3 font-semibold">Action</th>
                <th scope="col" className="px-4 py-3 font-semibold">Entity</th>
                <th scope="col" className="px-4 py-3 font-semibold">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {result.items.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-600">
                    {formatTimestamp(entry.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-medium text-ink-900">
                    {entry.action}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        buildHref={(p) => `/admin/audit?page=${p}`}
      />
    </div>
  )
}