import { Alert } from '@/components/ui/alert'
import { CreateScholarshipForm } from '@/features/scholarships/admin/components/scholarship-form'
import { getTaxonomyOptions } from '@/features/scholarships/admin/queries'
import { requirePermission } from '@/lib/auth/guards'

export const metadata = { title: 'New scholarship' }

const EMPTY_TAXONOMY = {
  category_ids: [] as string[],
  education_level_ids: [] as string[],
  field_ids: [] as string[],
  location_ids: [] as string[],
}

/**
 * Create a scholarship.
 *
 * Requires `scholarship.manage`. The taxonomy options are fetched here rather
 * than in the form so the select lists are populated without a client fetch.
 */
export default async function NewScholarshipPage() {
  await requirePermission('scholarship.manage')

  const options = await getTaxonomyOptions()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">New scholarship</h1>
        <p className="mt-1 text-sm text-ink-600">
          Records are saved as drafts. Nothing reaches the public site until you
          publish.
        </p>
      </div>

      {!options.ok ? (
        <Alert tone="error">
          The classification lists could not be loaded, so categories, levels
          and locations cannot be assigned yet. You can still save the rest of
          the record. ({options.error.userMessage})
        </Alert>
      ) : null}

      <CreateScholarshipForm
        taxonomyOptions={
          options.ok
            ? options.data
            : { categories: [], educationLevels: [], fields: [], locations: [] }
        }
        selected={EMPTY_TAXONOMY}
      />
    </div>
  )
}