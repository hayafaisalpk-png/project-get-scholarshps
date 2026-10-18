import Link from 'next/link'

import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { MediaEditor } from '@/features/media/components/media-editor'
import { MediaUploadForm } from '@/features/media/components/media-upload-form'
import {
  listMediaAssets,
  listMediaFolders,
} from '@/features/media/queries'
import { requirePermission } from '@/lib/auth/guards'
import { formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/utils/cn'

export const metadata = { title: 'Media library' }

/**
 * Media library.
 *
 * Upload, browse, and edit alt text / caption / attribution per asset.
 *
 * ASSETS ARE ARCHIVED, NEVER HARD-DELETED
 *
 * `scholarships.image_id` and `articles.featured_image_id` both reference this
 * table with `on delete set null`, so deleting an asset in use would silently
 * strip the image from a published record instead of failing loudly. Archiving
 * hides it from the library and from RLS for non-managers while leaving the row
 * and the file intact.
 *
 * PERMISSION SPLIT
 *
 * `media.upload` to add, `media.manage` to edit and archive. The upload panel is
 * hidden without the former and the editor without the latter — presentation
 * only; both actions re-check server-side and RLS enforces it independently.
 */
export default async function AdminMediaPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string; q?: string; page?: string; archived?: string }>
}) {
  const { permissions } = await requirePermission('media.upload')

  const params = await searchParams
  const page = Number.parseInt(params.page ?? '1', 10)
  const folder = params.folder?.trim() || undefined
  const q = params.q?.trim() || undefined
  const archived: 'active' | 'archived' | 'all' =
    params.archived === 'archived'
      ? 'archived'
      : params.archived === 'all'
        ? 'all'
        : 'active'

  const [result, folders] = await Promise.all([
    listMediaAssets({
      folder,
      q,
      page: Number.isFinite(page) ? page : 1,
      archived,
    }),
    listMediaFolders(),
  ])

  const canManage = permissions.includes('media.manage')

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-ink-900">Media library</h1>
        <p className="mt-1 text-sm text-ink-600">
          Images up to 5 MB. Uploads go to the private bucket unless you choose
          otherwise; archiving hides an asset without deleting the file.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[20rem_1fr]">
        <section aria-labelledby="upload-heading" className="lg:sticky lg:top-24 lg:self-start">
          <h2 id="upload-heading" className="text-base font-semibold text-ink-900">
            Upload an image
          </h2>
          <p className="mt-1 mb-4 text-sm text-ink-600">
            JPEG, PNG, WebP, AVIF, GIF or SVG, up to 5 MB.
          </p>
          <MediaUploadForm />
        </section>

        <section aria-labelledby="library-heading" className="min-w-0">
          <div className="mb-4 flex items-center gap-2 text-sm">
            <span className="text-ink-600">Show:</span>
            {(['active', 'archived', 'all'] as const).map((state) => {
              const href = `/admin/media?archived=${state}${folder ? `&folder=${encodeURIComponent(folder)}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`
              return (
                <Link
                  key={state}
                  href={href}
                  className={
                    state === archived
                      ? 'rounded-sm bg-navy px-2.5 py-1 text-xs font-semibold text-white'
                      : 'rounded-sm border border-ink-300 px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-ink-100'
                  }
                >
                  {state === 'active'
                    ? 'Active'
                    : state === 'archived'
                      ? 'Archived'
                      : 'All'}
                </Link>
              )
            })}
          </div>
          <h2 id="library-heading" className="sr-only-focusable">
            Uploaded assets
          </h2>

          <form
            action="/admin/media"
            method="get"
            className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            {folder ? (
              <input type="hidden" name="folder" value={folder} />
            ) : null}
            <div className="flex-1">
              <label
                htmlFor="q"
                className="block text-sm font-medium text-ink-800"
              >
                Search
              </label>
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={q ?? ''}
                placeholder="File name or alt text"
                className="mt-1.5 block w-full rounded-sm border border-ink-300 bg-white px-3 py-2.5 text-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-200 focus:outline-none"
              />
            </div>
            <ButtonLike>Search</ButtonLike>
          </form>

          {folders.length > 0 ? (
            <nav aria-label="Filter by folder" className="mb-6">
              <ul className="flex flex-wrap gap-2">
                <li>
                  <FolderChip href="/admin/media" active={!folder}>
                    All
                  </FolderChip>
                </li>
                {folders.map((name) => (
                  <li key={name}>
                    <FolderChip
                      href={buildHref({ folder: name })}
                      active={folder === name}
                    >
                      {name}
                    </FolderChip>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}

          {!result.ok ? (
            <EmptyState
              title="The library could not be loaded"
              description={`${result.error.userMessage} Try again in a moment.`}
            />
          ) : result.data.items.length === 0 ? (
            <EmptyState
              title={q || folder ? 'No assets match' : 'No images yet'}
              description={
                q || folder
                  ? 'Try a different search or folder.'
                  : 'Upload an image using the form on this page.'
              }
            />
          ) : (
            <>
              <p className="mb-4 text-sm text-ink-600" aria-live="polite">
                {result.data.total} asset
                {result.data.total === 1 ? '' : 's'}
              </p>

              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {result.data.items.map((asset) => (
                  <li key={asset.id}>
                    <article
                      className={cn(
                        'flex h-full flex-col rounded-sm border bg-white p-4',
                        asset.archivedAt
                          ? 'border-red-200 opacity-80'
                          : 'border-ink-200',
                      )}
                    >
                      <div className="mb-3 flex aspect-video items-center justify-center overflow-hidden rounded-sm bg-ink-100">
                        {asset.displayUrl ? (
                          /*
                            A plain `<img>` rather than `next/image`, on purpose.

                            The optimiser fetches and re-serves the bytes itself,
                            which does not work for a time-limited SIGNED URL: the
                            signature lives in the query string, so any re-fetch
                            with different parameters 404s. Private assets only ever
                            have a signed URL, which is precisely the case this
                            gallery has to show.

                            `alt` is empty when the asset has no alt text, because
                            that is the correct declaration for an unspecified
                            image; the card prompts the editor to confirm it is
                            decorative rather than silently shipping a filename.
                          */
                          // eslint-disable-next-line @next/next/no-img-element -- signed URLs cannot be re-fetched by the optimiser; see above
                          <img
                            src={asset.displayUrl}
                            alt={asset.altText ?? ''}
                            loading="lazy"
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <span className="text-xs text-ink-500">
                            No preview available
                          </span>
                        )}
                      </div>

                      <h3 className="truncate text-sm font-semibold text-ink-900">
                        {asset.fileName}
                      </h3>

                      <p className="mt-1 text-xs text-ink-500">
                        {asset.mimeType.replace('image/', '').toUpperCase()}
                        {' · '}
                        {formatBytes(asset.fileSize)}
                        {' · '}
                        {formatTimestamp(asset.createdAt)}
                      </p>

                      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                        {/*
                          An ARCHIVED asset is deliberately still listed: a media
                          manager can see it (migration 027), and hiding it would
                          make an archived filter impossible. So it must be clearly
                          marked — otherwise it sits in the grid looking exactly like
                          a live image and can be attached to a record by mistake.
                        */}
                        {asset.archivedAt ? (
                          <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-900 ring-1 ring-inset ring-red-200">
                            Archived
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 font-semibold ring-1 ring-inset',
                            asset.isPublic
                              ? 'bg-accent-50 text-accent-900 ring-accent-200'
                              : 'bg-ink-100 text-ink-700 ring-ink-200',
                          )}
                        >
                          {asset.isPublic ? 'Public' : 'Private'}
                        </span>
                      </p>

                      {/*
                        Since migration 030 an asset is EITHER described or
                        explicitly decorative — the database refuses the third
                        state — so an asset with no alt text here is a declared
                        decorative image, and that is worth saying rather than
                        leaving the editor to wonder.
                      */}
                      {!asset.altText && asset.isDecorative ? (
                        <p className="mt-2 text-xs font-medium text-ink-600">
                          Decorative — hidden from screen readers.
                        </p>
                      ) : null}

                      {/* A row with neither is impossible under the CHECK; this
                          branch exists so a future schema change cannot make it
                          silent. */}
                      {!asset.altText && !asset.isDecorative ? (
                        <p className="mt-2 text-xs font-medium text-red-700">
                          No alt text and not marked decorative.
                        </p>
                      ) : null}

                      {canManage ? (
                        <div className="mt-auto">
                          <MediaEditor
                            id={asset.id}
                            fileName={asset.fileName}
                            altText={asset.altText}
                            caption={asset.caption}
                            attribution={asset.attribution}
                            folder={asset.folder}
                            isPublic={asset.isPublic}
                            isDecorative={asset.isDecorative}
                          />
                        </div>
                      ) : null}
                    </article>
                  </li>
                ))}
              </ul>

              <Pagination
                page={result.data.page}
                totalPages={result.data.totalPages}
                buildHref={(target) =>
                  buildHref({ folder, q, page: target })
                }
              />
            </>
          )}
        </section>
      </div>
    </div>
  )
}

function buildHref({
  folder,
  q,
  page,
}: {
  folder?: string | undefined
  q?: string | undefined
  page?: number | undefined
}): string {
  const search = new URLSearchParams()
  if (folder) search.set('folder', folder)
  if (q) search.set('q', q)
  if (page && page > 1) search.set('page', String(page))
  const query = search.toString()
  return query ? `/admin/media?${query}` : '/admin/media'
}

function FolderChip({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-brand-500 text-white'
          : 'bg-ink-100 text-ink-700 hover:bg-ink-200',
      )}
    >
      {children}
    </Link>
  )
}

/** Submit button styled to match the admin controls, without the client boundary. */
function ButtonLike({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="inline-flex h-[42px] items-center justify-center rounded-md bg-navy px-5 text-sm font-semibold text-white transition-colors hover:bg-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
    >
      {children}
    </button>
  )
}

/** Human-readable byte size. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1_048_576).toFixed(1)} MB`
}