import { requirePermission } from '@/lib/auth/guards'
import { listHomepageSections } from '@/features/homepage-admin/queries'
import { HomepageManager } from '@/features/homepage-admin/components/homepage-manager'

export const metadata = { title: 'Homepage' }

export default async function AdminHomepagePage() {
  await requirePermission('homepage.manage')

  const sections = await listHomepageSections()

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-ink-900">Homepage composition</h1>
        <p className="mt-1 text-sm text-ink-600">
          Reorder sections, edit headings and toggle visibility. Changes go live
          immediately.
        </p>
      </header>
      <HomepageManager sections={sections} />
    </div>
  )
}