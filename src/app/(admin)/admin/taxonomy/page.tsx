import { requirePermission } from '@/lib/auth/guards'
import { listTaxonomy } from '@/features/taxonomy/queries'
import { TaxonomyManager } from '@/features/taxonomy/components/taxonomy-manager'

export const metadata = { title: 'Taxonomy' }

const KINDS = ['categories', 'tags', 'education_levels', 'academic_fields', 'locations'] as const

export default async function AdminTaxonomyPage() {
  await requirePermission('taxonomy.manage')

  const lists = await Promise.all(KINDS.map((k) => listTaxonomy(k)))
  const byKind = Object.fromEntries(KINDS.map((k, i) => [k, lists[i]]))

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-ink-900">Taxonomy</h1>
        <p className="mt-1 text-sm text-ink-600">
          Manage categories, tags, education levels, academic fields and locations.
          Deletes are immediate; rows in use may fail with a constraint error.
        </p>
      </header>

      <div className="space-y-10">
        {KINDS.map((k) => (
          <TaxonomyManager key={k} kind={k} items={byKind[k] ?? []} />
        ))}
      </div>
    </div>
  )
}