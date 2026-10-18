import { notFound } from 'next/navigation'
import { getAdminArticle } from '@/features/articles/admin/queries'
import { requirePermission } from '@/lib/auth/guards'
import { sanitizeArticleHtml } from '@/lib/sanitize'

export const metadata = { title: 'Article preview' }

export default async function ArticlePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('article.create')
  const { id } = await params
  const result = await getAdminArticle(id)
  if (!result.ok || !result.data) notFound()
  const { record } = result.data
  const content = sanitizeArticleHtml(record.content)

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-brand-700">Preview · {record.status.replace('_', ' ')}</p>
      <h1 className="text-4xl font-bold text-ink-900">{record.title}</h1>
      {record.excerpt ? <p className="mt-4 text-lg text-ink-600">{record.excerpt}</p> : null}
      <div className="prose-editorial mt-8" dangerouslySetInnerHTML={{ __html: content }} />
    </main>
  )
}
