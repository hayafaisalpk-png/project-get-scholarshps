import { requirePermission } from '@/lib/auth/guards'
import { listNavigationItems } from '@/features/navigation/queries'
import { NavigationManager } from '@/features/navigation/components/navigation-manager'

export const metadata = { title: 'Navigation' }

export default async function AdminNavigationPage() {
  await requirePermission('navigation.manage')

  const items = await listNavigationItems()

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-ink-900">Navigation</h1>
        <p className="mt-1 text-sm text-ink-600">
          Manage header, footer and legal navigation items. Edits go live
          immediately.
        </p>
      </header>
      <NavigationManager items={items} />
    </div>
  )
}