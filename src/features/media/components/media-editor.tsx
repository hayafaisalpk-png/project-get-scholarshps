'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

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
 * A disclosure rather than a modal: the grid behind it stays visible, so an
 * editor can compare an alt-text change against the image without losing their
 * place. The toggle is a real `<button>` carrying `aria-expanded` and
 * `aria-controls`, so the state is announced rather than inferred.
 *
 * Archive is a two-step inline confirmation for the same reason as
 * `ArticleRowActions` — `window.confirm` cannot be styled and handles focus
 * poorly, and the destructive choice must never be the default.
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
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`media-editor-${id}`}
        className="text-sm font-medium text-brand-700 underline underline-offset-4 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
      >
        {open ? 'Close details' : 'Edit details'}
        <span className="sr-only-focusable"> for {fileName}</span>
      </button>

      {open ? (
        <div
          id={`media-editor-${id}`}
          className="mt-3 space-y-4 rounded-sm border border-ink-200 bg-ink-50 p-4"
        >
          {message ? (
            <Alert tone={message.ok ? 'success' : 'error'}>{message.text}</Alert>
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
            className="space-y-3"
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

          <div className="border-t border-ink-200 pt-3">
            {confirming ? (
              <div className="space-y-2">
                <p className="text-sm text-ink-700">
                  Archive <span className="font-semibold">{fileName}</span>? It
                  will be hidden from the library, but the file stays in the
                  bucket.
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    onClick={archive}
                    disabled={pending}
                  >
                    {pending ? 'Archiving…' : 'Yes, archive it'}
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
                Archive
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}