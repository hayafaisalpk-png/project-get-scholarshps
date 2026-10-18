'use client'

import { useActionState, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  describedBy,
  FormField,
  inputClasses,
} from '@/features/auth/components/form-field'

import { uploadMediaAction } from '../actions'
import { MEDIA_FOLDERS } from '../validation'

/**
 * Media upload form.
 *
 * The file input is the only part that cannot be validated usefully in the
 * browser before the user picks something, so the size and type feedback is
 * deliberately AFTER submit — the Server Action is the authority, and a client
 * check that disagreed with it would be worse than none.
 *
 * The file input is cleared on success, not before, so a failed upload leaves the
 * selection in place and the editor does not have to find the file again.
 */
export function MediaUploadForm() {
  const [state, action] = useActionState(uploadMediaAction, null)
  const formRef = useRef<HTMLFormElement>(null)
  const [isPublic, setIsPublic] = useState(false)

  return (
    /*
     * No `encType` on this form. React supplies multipart encoding itself for a
     * form with a Server Action; passing it explicitly logs "Cannot specify an
     * encType or method for a form that specifies a function as the action", and
     * the attribute is ignored anyway.
     */
    <form
      ref={formRef}
      action={action}
      className="relative space-y-4"
      noValidate
    >
      {state ? (
        <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>
      ) : null}

      <FormField
        id="media-file"
        label="Image file"
        hint="JPEG, PNG, WebP, AVIF, GIF or SVG. Maximum 5 MB."
        error={state?.ok === false ? state.fieldErrors?.file : undefined}
      >
        <input
          id="media-file"
          name="file"
          type="file"
          required
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/svg+xml"
          className="block w-full cursor-pointer rounded-sm border border-ink-300 bg-white text-sm text-ink-700 file:mr-3 file:cursor-pointer file:rounded-none file:border-0 file:bg-ink-100 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-ink-800 focus:border-brand-600 focus:ring-2 focus:ring-brand-200 focus:outline-none"
          aria-describedby={describedBy(
            'media-file',
            undefined,
            'JPEG, PNG, WebP, AVIF, GIF or SVG. Maximum 5 MB.',
          )}
        />
      </FormField>

      <FormField
        id="media-folder"
        label="Folder"
        error={state?.ok === false ? state.fieldErrors?.folder : undefined}
      >
        <select id="media-folder" name="folder" defaultValue="general" className={inputClasses}>
          {MEDIA_FOLDERS.map((folder) => (
            <option key={folder} value={folder}>
              {folder}
            </option>
          ))}
        </select>
      </FormField>

      {/*
        Asked BEFORE the alt field, because it decides whether alt is required.
        Migration 030 makes an asset either described or explicitly decorative,
        and an upload that is neither is refused before the bytes are sent.
      */}
      <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink-800">
        <input
          type="checkbox"
          name="isDecorative"
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink-300 text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
        />
        <span>
          Decorative image
          <span className="mt-0.5 block text-xs text-ink-500">
            Tick this only if the image carries no information. Decorative images
            are hidden from screen readers, so they need no alt text.
          </span>
        </span>
      </label>

      <FormField
        id="media-alt"
        label="Alt text"
        hint="Describes the image for someone who cannot see it. Required unless the image is marked decorative."
        error={state?.ok === false ? state.fieldErrors?.altText : undefined}
      >
        <input
          id="media-alt"
          name="altText"
          type="text"
          maxLength={300}
          className={inputClasses}
          aria-describedby={describedBy(
            'media-alt',
            state?.ok === false ? state.fieldErrors?.altText : undefined,
            'Describes the image for someone who cannot see it. Required unless the image is marked decorative.',
          )}
        />
      </FormField>

      <FormField
        id="media-caption"
        label="Caption"
        error={state?.ok === false ? state.fieldErrors?.caption : undefined}
      >
        <input
          id="media-caption"
          name="caption"
          type="text"
          maxLength={500}
          className={inputClasses}
        />
      </FormField>

      <FormField
        id="media-attribution"
        label="Attribution"
        hint="Photographer or source, if this is not our own image."
        error={
          state?.ok === false ? state.fieldErrors?.attribution : undefined
        }
      >
        <input
          id="media-attribution"
          name="attribution"
          type="text"
          maxLength={200}
          className={inputClasses}
        />
      </FormField>

      {/*
        The public-bucket toggle is OFF by default. Public means a permanent,
        unauthenticated URL that nothing will ever revoke, and the alternative
        costs nothing but a later promotion.
      */}
      <div className="rounded-sm border border-ink-200 bg-ink-50 p-3">
        <label className="flex min-h-7 cursor-pointer items-center gap-2.5 text-sm text-ink-800">
          <input
            type="checkbox"
            name="isPublic"
            checked={isPublic}
            onChange={(event) => setIsPublic(event.target.checked)}
            className="h-4 w-4 shrink-0 rounded border-ink-300 text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
          />
          Make public
        </label>
        <p className="mt-1 text-xs text-ink-600">
          {isPublic
            ? 'This will be readable by anyone at a permanent URL. Review SVGs first — they can contain script.'
            : 'Uploads go to the private bucket and are only visible to media managers. You can promote it later.'}
        </p>
      </div>

      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Uploading…' : 'Upload image'}
    </Button>
  )
}