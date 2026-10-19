'use client'

import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { useEffect, useRef, useState, useTransition } from 'react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  describedBy,
  FormField,
  inputClasses,
} from '@/features/auth/components/form-field'

import { archiveMediaAction, updateMediaAction } from '../actions'
import { MEDIA_FOLDERS } from '../validation'

/**
 * Per-asset metadata editor.
 *
 * Opens the metadata editor in a modal so the asset grid remains compact.
 * Archive is presented as Delete in the UI, but remains a soft delete because
 * published records may still reference the asset.
 */
export function MediaEditor({
  id,
  fileName,
  altText,
  caption,
  attribution,
  folder,
  isPublic,
  isDecorative,
}: {
  id: string
  fileName: string
  altText: string | null
  caption: string | null
  attribution: string | null
  folder: string
  isPublic: boolean
  isDecorative: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  )
  const [confirming, setConfirming] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeButtonRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  function save(data: FormData) {
    setMessage(null)
    startTransition(async () => {
      const result = await updateMediaAction(id, {
        altText: String(data.get('altText') ?? ''),
        caption: String(data.get('caption') ?? ''),
        attribution: String(data.get('attribution') ?? ''),
        folder: String(data.get('folder') ?? 'general'),
        isPublic: data.get('isPublic') === 'on',
        isDecorative: data.get('isDecorative') === 'on',
      })
      setMessage({ ok: result.ok, text: result.message })
      if (result.ok) router.refresh()
    })
  }

  function archive() {
    setMessage(null)
    startTransition(async () => {
      const result = await archiveMediaAction(id)
      setMessage({ ok: result.ok, text: result.message })
      if (result.ok) {
        setConfirming(false)
        setOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => {
          setMessage(null)
          setConfirming(false)
          setOpen(true)
        }}
        className="text-sm font-medium text-brand-700 underline underline-offset-4 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
      >
        Edit details
        <span className="sr-only-focusable"> for {fileName}</span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`media-editor-title-${id}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/35 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false)
          }}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-sm bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <h2 id={`media-editor-title-${id}`} className="text-lg font-semibold text-ink-900">
                Edit media
              </h2>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label={`Close details for ${fileName}`}
                className="rounded-sm p-1.5 text-ink-600 hover:bg-ink-100 hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <p className="mt-1 truncate text-sm text-ink-600">{fileName}</p>

            {message ? (
              <Alert tone={message.ok ? 'success' : 'error'} className="mt-4">
                {message.text}
              </Alert>
            ) : null}

            {/*
            A plain form with `onSubmit`, NOT `<form action={…}>`. This panel is
            driven from a transition and must not trigger a navigation or the
            Server Action form protocol; the values are read from FormData and
            passed to `updateMediaAction` as plain arguments.
          */}
            <form
              onSubmit={(event) => {
                event.preventDefault()
                save(new FormData(event.currentTarget))
              }}
              className="mt-5 space-y-3"
            >
            {/* The decorative checkbox sits ABOVE the alt field on purpose: it is
                the question that decides whether alt text is required, so an editor
                should be able to answer it before being shown a field the answer
                makes optional — rather than leaving the field empty, failing to
                save, and only then learning what the other control was for. */}
            <label className="flex min-h-7 cursor-pointer items-start gap-2.5 text-sm text-ink-800">
              <input
                type="checkbox"
                name="isDecorative"
                defaultChecked={isDecorative}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink-300 text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
              />
              <span>
                Decorative image
                <span className="mt-0.5 block text-xs text-ink-500">
                  Tick this only if the image carries no information — a
                  decorative rule or flourish. Decorative images are hidden from
                  screen readers, so they need no alt text.
                </span>
              </span>
            </label>

            <FormField
              id={`alt-${id}`}
              label="Alt text"
              hint={
                isDecorative
                  ? 'Optional: this image is decorative and will be hidden from screen readers.'
                  : 'Required. Describe what the image shows, for someone who cannot see it.'
              }
            >
              <input
                id={`alt-${id}`}
                name="altText"
                type="text"
                defaultValue={altText ?? ''}
                maxLength={300}
                className={inputClasses}
                aria-describedby={describedBy(`alt-${id}`, undefined, undefined)}
              />
            </FormField>

            <FormField id={`caption-${id}`} label="Caption">
              <input
                id={`caption-${id}`}
                name="caption"
                type="text"
                defaultValue={caption ?? ''}
                maxLength={500}
                className={inputClasses}
              />
            </FormField>

            <FormField id={`attr-${id}`} label="Attribution">
              <input
                id={`attr-${id}`}
                name="attribution"
                type="text"
                defaultValue={attribution ?? ''}
                maxLength={200}
                className={inputClasses}
              />
            </FormField>

            <FormField id={`folder-${id}`} label="Folder">
              <select
                id={`folder-${id}`}
                name="folder"
                defaultValue={folder}
                className={inputClasses}
              >
                {MEDIA_FOLDERS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </FormField>

            <label className="flex min-h-7 cursor-pointer items-center gap-2.5 text-sm text-ink-800">
              <input
                type="checkbox"
                name="isPublic"
                defaultChecked={isPublic}
                className="h-4 w-4 shrink-0 rounded border-ink-300 text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
              />
              Public
            </label>

            <Button type="submit" size="sm" disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
            </form>

            <div className="mt-5 border-t border-ink-200 pt-4">
            {confirming ? (
              <div className="space-y-2">
                <p className="text-sm text-ink-700">
                  Delete <span className="font-semibold">{fileName}</span>? It
                  will be archived and hidden from the active library, but the
                  file will remain available to records that reference it.
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    onClick={archive}
                    disabled={pending}
                  >
                    {pending ? 'Deleting…' : 'Yes, delete it'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirming(false)}
                    disabled={pending}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setConfirming(true)}
                disabled={pending}
              >
                Delete
              </Button>
            )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
