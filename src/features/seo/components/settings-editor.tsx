'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { updateSettingAction } from '@/features/seo/actions'

/**
 * Settings editor.
 *
 * One form per setting rather than one big form, so a validation failure on the
 * social URLs cannot discard an unrelated edit to the site description.
 *
 * The `valueType` travels with the row and decides how the submitted string is
 * stored: a boolean switch and a text field both send strings, and `value` is
 * JSONB, so the conversion has to be right or a switch reads as "on" in
 * JavaScript while the screen shows it off.
 */
export function SettingsEditor({
  settings,
}: {
  settings: {
    key: string
    label: string
    description: string | null
    valueType: string
    value: string
  }[]
}) {
  const router = useRouter()

  return (
    <ul className="space-y-3">
      {settings.map((setting) => (
        <li key={setting.key}>
          <SettingField setting={setting} onSaved={() => router.refresh()} />
        </li>
      ))}
    </ul>
  )
}

function SettingField({
  setting,
  onSaved,
}: {
  setting: {
    key: string
    label: string
    description: string | null
    valueType: string
    value: string
  }
  onSaved: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null)

  const id = `setting-${setting.key.replace(/[^a-z0-9]+/gi, '-')}`

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await updateSettingAction(null, formData)
      setState({ ok: result.ok, message: result.message })
      if (result.ok) onSaved()
    })
  }

  return (
    <form
      action={submit}
      className="rounded-sm border border-ink-200 bg-white p-4"
    >
      <input type="hidden" name="key" value={setting.key} />
      {/*
        The value TYPE is deliberately not submitted. The Server Action reads
        `value_type` from the row itself, because a client that can name the
        type of the column it is writing has already defeated the validation —
        which is exactly how an `http://` address got stored in a `url` setting
        in the first version of this screen.
      */}

      {setting.valueType === 'boolean' ? (
        <div className="flex items-start gap-3">
          {/*
            A checkbox that is NOT checked is absent from the submitted form
            entirely. Without this hidden field ahead of it, unchecking a switch
            would submit no `value` at all and the stored setting would keep its
            old value while the screen showed it off — a control that looks like
            it saved and did not.
          */}
          <input type="hidden" name="value" value="false" />
          <input
            id={id}
            name="value"
            type="checkbox"
            value="true"
            defaultChecked={setting.value === 'true'}
            className="mt-1 h-4 w-4 rounded-sm border-ink-300 text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500"
          />
          <div>
            <label htmlFor={id} className="block text-sm font-medium text-ink-800">
              {setting.label}
            </label>
            {setting.description ? (
              <p className="mt-0.5 text-xs text-ink-500">{setting.description}</p>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <label htmlFor={id} className="block text-sm font-medium text-ink-800">
            {setting.label}
          </label>
          {setting.description ? (
            <p className="mt-0.5 text-xs text-ink-500">{setting.description}</p>
          ) : null}
          {/*
            A checkbox is absent from the form when unchecked, so a boolean needs
            a hidden field carrying "false" ahead of it — otherwise unchecking a
            switch would submit nothing and leave the stored value untouched.
          */}
          {setting.valueType === 'text' ? (
            <textarea
              id={id}
              name="value"
              rows={3}
              defaultValue={setting.value}
              className="mt-1.5 w-full rounded-sm border border-ink-300 px-2.5 py-2 text-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-200 focus:outline-none"
            />
          ) : (
            <input
              id={id}
              name="value"
              type={setting.valueType === 'number' ? 'number' : 'text'}
              defaultValue={setting.value}
              className="mt-1.5 w-full rounded-sm border border-ink-300 px-2.5 py-2 text-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-200 focus:outline-none"
            />
          )}
        </>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-sm bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy/90 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>

        {state ? (
          <p
            role={state.ok ? 'status' : 'alert'}
            className={`text-xs ${state.ok ? 'text-ink-500' : 'text-red-700'}`}
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  )
}