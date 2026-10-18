import { EmptyState } from '@/components/ui/empty-state'
import { RedirectManager } from '@/features/redirects/components/redirect-manager'
import { listRedirects } from '@/features/redirects/queries'
import { requirePermission } from '@/lib/auth/guards'

/**
 * Redirect manager.
 *
 * The `redirects` table shipped in Phase 2 with policies, an index and a set of
 * CHECK constraints — and nothing read it. Until now a rule could be inserted
 * directly into the database and had no effect on any request, which is the
 * clearest possible example of a control that looks real and does nothing.
 *
 * Enforcement lives in `src/proxy.ts`, which resolves rules before any auth
 * work; this screen is the only way a rule is created, so the CMS and the
 * request path cannot disagree about what exists.
 *
 * `hit_count` is deliberately NOT displayed. It exists in the schema but is not
 * maintained, and showing a permanently-zero counter would be a fabricated
 * statistic (`AGENTS.md` §2.7). Wiring it up means a database write per redirect
 * on a public path, which is an abuse vector as much as a cost.
 */
export const metadata = { title: 'Redirects' }

export default async function AdminRedirectsPage() {
  await requirePermission('seo.manage')

  const result = await listRedirects()

  if (!result.ok) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-ink-900">Redirects</h1>
        </header>
        <EmptyState
          title="Redirects could not be loaded"
          description="Something went wrong while reading the redirect map. Please try again."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-ink-900">Redirects</h1>
        <p className="mt-1 text-sm text-ink-600">
          Permanent or temporary redirects applied before a page renders. Use one
          when a scholarship or article moves to a new address.
        </p>
        {/*
          Stated rather than left to be discovered. The proxy holds the rule map
          in its own process with a 15-second refresh, and an action cannot clear
          another process's cache — so "saved" genuinely does not mean "live"
          for the first few seconds. An editor who checks the old URL immediately
          and sees a 404 would otherwise conclude the feature is broken.
        */}
        <p className="mt-2 rounded-sm bg-ink-50 px-3 py-2 text-xs text-ink-600">
          Changes reach live traffic within about 15 seconds, because the
          request path holds its own copy of this map. Pausing or deleting a
          redirect may take the same window to stop firing.
        </p>
      </header>

      <RedirectManager initial={result.data.items} />
    </div>
  )
}