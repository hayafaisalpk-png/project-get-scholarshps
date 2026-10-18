import { EmptyState } from '@/components/ui/empty-state'
import { SettingsEditor } from '@/features/seo/components/settings-editor'
import { listSeoSettings } from '@/features/seo/queries'
import { requirePermission } from '@/lib/auth/guards'
import { isEditableSettingKey, settingValueToInput } from '@/lib/validation/settings'

/**
 * Site settings — SEO and social groups only, for now.
 *
 * Phase 4 lists a general settings screen as remaining work, and this is the same
 * screen for the subset of settings that Phase 5 needs: the default title and
 * description, the Twitter handle and the social profile URLs. Extending it to
 * the other groups is the Phase 4 increment; keeping one screen rather than two
 * means an editor does not have to learn where a setting lives.
 *
 * **Private switches are deliberately absent.** `newsletter.enabled`,
 * `ads.enabled` and `site.maintenance_mode` live in the same table and are read
 * by the query, but `EDITABLE_SETTING_KEYS` refuses them, so this screen cannot
 * flip a maintenance switch by accident. A generic settings form is exactly how
 * that happens.
 */
export const metadata = { title: 'Site settings' }

export default async function AdminSettingsPage() {
  await requirePermission('settings.manage')

  const result = await listSeoSettings()

  if (!result.ok) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-ink-900">Site settings</h1>
        </header>
        <EmptyState
          title="Settings could not be loaded"
          description="Something went wrong while reading the settings table. Please try again."
        />
      </div>
    )
  }

  const editable = result.data
    .filter((setting) => isEditableSettingKey(setting.key))
    .map((setting) => ({
      key: setting.key,
      label: setting.label ?? setting.key,
      description: setting.description,
      valueType: setting.valueType,
      value: settingValueToInput(setting.value as never),
    }))

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-ink-900">Site settings</h1>
        <p className="mt-1 text-sm text-ink-600">
          Search and social defaults. These feed the page metadata across the
          whole site.
        </p>
      </header>

      {editable.length === 0 ? (
        <EmptyState
          title="No editable settings"
          description="None of the SEO settings are present in the database."
        />
      ) : (
        <SettingsEditor settings={editable} />
      )}
    </div>
  )
}