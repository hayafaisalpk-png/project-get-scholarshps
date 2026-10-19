'use client'

/*
 * `@next/next/no-img-element` is disabled for this file.
 *
 * The rule is right about public, LCP-critical images and wrong here: every
 * thumbnail below is an ADMIN-only preview of an asset that may be served from a
 * ten-minute SIGNED URL. `next/image` would try to optimise through a path that
 * does not exist for a signed URL, and the optimiser would cache a URL that has
 * already expired. The number of images is capped at one page, so bandwidth is not
 * the concern the rule is about.
 */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useId, useRef, useState, useTransition } from 'react'

import { searchSelectableAssets, uploadMediaAction } from '@/features/media/actions'
import type { SelectableAsset } from '@/features/media/selection'
import { altAttributeFor } from '@/features/media/selection'

/**
 * Featured-image picker.
 *
 * An `<img>` is used rather than `next/image`, deliberately:
 *
 *   - a PRIVATE asset is served from a SIGNED URL with a ten-minute lifetime, and
 *     `next/image`'s optimiser would cache or fetch it through a path that does
 *     not exist for a signed URL;
 *   - these are admin-only thumbnails of at most 24 items, not a public image
 *     pipeline, so the optimiser buys nothing here.
 *
 * The `alt` attribute comes from `altAttributeFor`, which is the same function
 * the public renderer will use. That is the point of the picker: it is where an
 * editor can SEE what a screen reader will be told, before publishing a page that
 * uses the image.
 */
export function MediaPicker({
  name,
  label,
  selected,
  initialAssets,
  initialTotal,
  allowLibrarySelection = true,
}: {
  /** Form field name, e.g. `featuredImageId` or `image_id`. */
  name: string
  label: string
  selected: SelectableAsset | null
  initialAssets: SelectableAsset[]
  initialTotal: number
  allowLibrarySelection?: boolean
}) {
  const [current, setCurrent] = useState<SelectableAsset | null>(selected)
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [assets, setAssets] = useState<SelectableAsset[]>(initialAssets)
  const [total, setTotal] = useState(initialTotal)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [uploadAlt, setUploadAlt] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const uploadFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (uploadPreview) URL.revokeObjectURL(uploadPreview)
    }
  }, [uploadPreview])

  function beginUpload(file: File, altText: string) {
    if (uploading || !altText.trim()) return
    setUploading(true)
    const formData = new FormData()
    formData.set('file', file)
    formData.set('folder', 'articles')
    formData.set('altText', altText)
    formData.set('caption', '')
    formData.set('attribution', '')
    formData.set('isDecorative', 'off')
    formData.set('isPublic', 'on')

    startTransition(async () => {
      const result = await uploadMediaAction(null, formData)
      setUploading(false)
      if (!result.ok) {
        setUploadMessage(result.message)
        return
      }
      if (!result.asset) {
        setUploadMessage('The image could not be selected.')
        return
      }

      setCurrent(result.asset)
      setSelectedFile(null)
      setUploadMessage('Image uploaded. Click Save changes to attach it.')
      if (uploadFileRef.current) uploadFileRef.current.value = ''
    })
  }
  const panelId = useId()

  /*
   * The library is searched through a Server Action rather than by filtering the
   * list in the browser: `media_assets` is `server-only` and RLS decides which
   * assets this user may see at all. Shipping the whole library to the client and
   * filtering there would both defeat RLS and leak the full asset list into the
   * page payload.
   */
  function search(next: string) {
    setTerm(next)
    startTransition(async () => {
      const result = await searchSelectableAssets(next)
      if (!result.ok) {
        setError('The library could not be loaded.')
        return
      }
      setAssets(result.items)
      setTotal(result.total)
      setError(null)
    })
  }

  return (
    <fieldset
      className={
        allowLibrarySelection
          ? 'rounded-sm border border-ink-200 bg-white p-4'
          : 'p-0'
      }
    >
      {allowLibrarySelection ? (
        <legend className="px-1 text-sm font-medium text-ink-800">{label}</legend>
      ) : null}

      {/* The id is submitted as a real form field; the picker is only a nicer way
          to choose it. */}
      <input type="hidden" name={name} value={current?.id ?? ''} />

      {current ? (
        <div className="mt-2 flex flex-wrap items-start gap-4">
          {current.displayUrl ? (
            /*
             * `<img>`, not `next/image`: an admin-only thumbnail of a possibly
             * SIGNED URL. The optimiser would try to fetch it through a path that
             * does not exist for a ten-minute signed URL, and these are not
             * public LCP-critical images.
             */
            <img
              src={current.displayUrl}
              alt={altAttributeFor(current)}
              width={160}
              height={120}
              className="h-28 w-40 rounded-sm border border-ink-200 object-cover"
            />
          ) : null}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink-800">{current.fileName}</p>
            <p className="mt-1 text-xs text-ink-500">
              {current.isDecorative ? (
                <>Decorative — hidden from screen readers.</>
              ) : (
                <>
                  Screen readers will hear:{' '}
                  <span className="font-medium text-ink-800">
                    “{current.altText ?? 'no alt text yet'}”
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            {allowLibrarySelection ? (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-controls={panelId}
                className="rounded-sm border border-ink-300 px-2.5 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-100 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
              >
                {open ? 'Close library' : 'Change image'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setCurrent(null)
                setOpen(false)
              }}
              className="rounded-sm border border-ink-300 px-2.5 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-100 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
            >
              Remove
            </button>
          </div>
        </div>
      ) : allowLibrarySelection ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className="mt-2 rounded-sm border border-dashed border-ink-300 px-4 py-3 text-sm font-semibold text-ink-700 hover:border-brand-400 hover:bg-ink-50 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
        >
          Choose an image
        </button>
      ) : null}

      {open && allowLibrarySelection ? (
        <div id={panelId} className="mt-4 border-t border-ink-100 pt-3">
          <label htmlFor={`${name}-search`} className="block text-xs font-medium text-ink-700">
            Search the library
          </label>
          <input
            id={`${name}-search`}
            type="search"
            value={term}
            onChange={(event) => search(event.target.value)}
            placeholder="File name or alt text"
            className="mt-1 w-full rounded-sm border border-ink-300 px-2.5 py-1.5 text-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-200 focus:outline-none"
          />

          {pending ? (
            <p className="mt-3 text-sm text-ink-500">Loading…</p>
          ) : assets.length === 0 ? (
            <p className="mt-3 text-sm text-ink-600">
              No images available.
              {total > 0 ? '' : ' Upload one in the media library first.'}
            </p>
          ) : (
            <ul className="mt-3 grid gap-3 sm:grid-cols-3">
              {assets.map((asset) => (
                <li key={asset.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrent(asset)
                      setOpen(false)
                    }}
                    aria-pressed={current?.id === asset.id}
                    className={`w-full overflow-hidden rounded-sm border text-left transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none ${
                      current?.id === asset.id
                        ? 'border-brand-500 ring-2 ring-brand-200'
                        : 'border-ink-200 hover:border-brand-400'
                    }`}
                  >
                    {asset.displayUrl ? (
                      // Same reasoning as the preview above: signed URLs, admin use.
                      <img
                        src={asset.displayUrl}
                        alt={altAttributeFor(asset)}
                        width={240}
                        height={160}
                        loading="lazy"
                        className="h-24 w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-24 items-center justify-center bg-ink-100 text-xs text-ink-500">
                        No preview
                      </span>
                    )}
                    <span className="block px-2 py-1.5 text-xs text-ink-700">
                      <span className="block truncate font-medium">{asset.fileName}</span>
                      <span className="block truncate text-ink-500">
                        {asset.isDecorative ? 'Decorative' : (asset.altText ?? 'No alt text')}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {error ? (
            <p role="alert" className="mt-2 text-xs text-red-700">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      <div
        className={
          allowLibrarySelection
            ? 'mt-4 border-t border-ink-100 pt-3'
            : 'mt-0'
        }
      >
          <div
            className={`${allowLibrarySelection ? 'w-full' : 'w-1/2'} space-y-3 rounded-sm border border-ink-300 bg-white p-3`}
          >
            <div className="overflow-hidden rounded-sm border border-ink-300 bg-white">
              <div className="flex h-48 items-center justify-center bg-ink-50 p-3">
                {uploadPreview ? (
                  <img
                    src={uploadPreview}
                    alt="Selected upload preview"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-sm text-ink-500">Image preview</span>
                )}
              </div>
              <label
                htmlFor={`${name}-upload-file`}
                className="flex cursor-pointer items-center justify-center border-t border-ink-300 px-4 py-3 text-sm font-semibold text-brand-700 hover:bg-brand-50 focus-within:ring-2 focus-within:ring-brand-500"
              >
                Upload Image
                <input
                  ref={uploadFileRef}
                  id={`${name}-upload-file`}
                  name="featuredImageFile"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/svg+xml"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) {
                      setUploadMessage(null)
                      setSelectedFile(file)
                      setUploadPreview(URL.createObjectURL(file))
                      beginUpload(file, uploadAlt)
                    }
                  }}
                />
              </label>
            </div>
            <div>
              <label
                htmlFor={`${name}-upload-alt`}
                className="block text-xs font-medium text-ink-800"
              >
                Alt text
              </label>
              <input
                id={`${name}-upload-alt`}
                name="featuredImageAlt"
                type="text"
                value={uploadAlt}
                onChange={(event) => {
                  const value = event.target.value
                  setUploadAlt(value)
                  if (selectedFile) beginUpload(selectedFile, value)
                }}
                placeholder="Describe the image"
                className="mt-1 block w-full rounded-sm border border-ink-300 bg-white px-2.5 py-1.5 text-sm text-ink-900 focus:border-brand-600 focus:ring-2 focus:ring-brand-200 focus:outline-none"
              />
            </div>
            {uploadMessage ? (
              <p role="status" className="text-xs text-ink-700">
                {uploadMessage}
              </p>
            ) : null}
          </div>
      </div>
    </fieldset>
  )
}
