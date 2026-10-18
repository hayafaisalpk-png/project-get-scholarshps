import { Alert } from '@/components/ui/alert'
import { CreateArticleForm } from '@/features/articles/admin/components/article-form'
import { getArticleFormOptions } from '@/features/articles/admin/queries'
import { listSelectableAssets } from '@/features/media/queries'
import { requirePermission } from '@/lib/auth/guards'

export const metadata = { title: 'New article' }

const EMPTY_RELATIONS = {
  category_ids: [] as string[],
  tag_ids: [] as string[],
  scholarship_ids: [] as string[],
}

/**
 * Create an article.
 *
 * Requires `article.create`. Reference lists are resolved on the server so the
 * editor opens with everything populated rather than fetching after mount.
 */
export default async function NewArticlePage() {
  await requirePermission('article.create')

  const [options, images] = await Promise.all([
    getArticleFormOptions(),
    listSelectableAssets({ page: 1 }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">New article</h1>
        <p className="mt-1 text-sm text-ink-600">
          Saved as a draft. Nothing appears on the public site until you publish
          it.
        </p>
      </div>

      {!options.ok ? (
        <Alert tone="error">
          Authors, categories and tags could not be loaded, so they cannot be
          assigned on this save. ({options.error.userMessage})
        </Alert>
      ) : null}

      <CreateArticleForm
        options={
          options.ok
            ? options.data
            : { authors: [], categories: [], tags: [], scholarships: [] }
        }
        relations={EMPTY_RELATIONS}
        images={images.ok ? { items: images.data.items, total: images.data.total } : { items: [], total: 0 }}
        selectedImage={null}
      />
    </div>
  )
}