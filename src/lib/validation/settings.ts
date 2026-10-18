import type { Json } from '@/types/database'

/**
 * Site settings value handling.
 *
 * `site_settings.value` is `jsonb`, which means the browser sends strings and
 * the column stores typed JSON. Getting that conversion wrong is not cosmetic:
 * a boolean written as the string `"false"` is TRUTHY in JavaScript, so the
 * newsletter switch would read as on while the screen showed it off.
 *
 * `value_type` is therefore authoritative — it is the same column the seed
 * populates, and the write path trusts nothing else about the incoming value.
 *
 * Pure and framework-free so the conversion table can be unit tested directly.
 */

export const SETTING_VALUE_TYPES = ['string', 'text', 'number', 'boolean', 'url'] as const

export type SettingValueType = (typeof SETTING_VALUE_TYPES)[number]

/**
 * Parse a submitted form value into the JSON the column expects.
 *
 * Returns a discriminated result rather than throwing, because every caller is a
 * form that needs to show the problem against a field.
 */
export function parseSettingValue({
  raw,
  valueType,
}: {
  raw: string
  valueType: string
}): { ok: true; value: Json } | { ok: false; message: string } {
  switch (valueType) {
    case 'boolean': {
      // An unchecked checkbox is absent from the form entirely, so the caller
      // passes 'false' explicitly. Only these two literals are accepted: a
      // free-text 'yes' would have to be guessed at.
      if (raw === 'true') return { ok: true, value: true }
      if (raw === 'false') return { ok: true, value: false }
      return { ok: false, message: 'Choose on or off.' }
    }

    case 'number': {
      if (!/^-?\d+(\.\d+)?$/.test(raw.trim())) {
        return { ok: false, message: 'Enter a number.' }
      }
      const parsed = Number(raw)
      if (!Number.isFinite(parsed)) {
        return { ok: false, message: 'Enter a number.' }
      }
      return { ok: true, value: parsed }
    }

    case 'url': {
      const trimmed = raw.trim()
      if (trimmed === '') return { ok: true, value: '' }
      // HTTPS only. A plain `http://` social or canonical URL would be served
      // over an insecure connection, and the value is rendered into the page.
      if (!/^https:\/\/[^\s]+$/.test(trimmed)) {
        return { ok: false, message: 'Enter a full https:// address.' }
      }
      return { ok: true, value: trimmed }
    }

    case 'string':
    case 'text':
    default: {
      // An unknown type is treated as a string rather than rejected: refusing to
      // save a setting because its type drifted would be a worse failure than
      // storing it as text.
      return { ok: true, value: raw }
    }
  }
}

/** Render a stored JSON value back into the string a form input expects. */
export function settingValueToInput(value: Json | undefined): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)
  // Objects and arrays are not editable by these forms; showing the JSON is
  // honest about what is stored rather than showing an empty box.
  return JSON.stringify(value)
}

/**
 * Settings the SEO screens may edit.
 *
 * A closed list on purpose. `site_settings` also holds private switches —
 * `newsletter.enabled`, `ads.enabled`, `site.maintenance_mode` — and this screen
 * is not the place to flip those: they belong to their own features, and a
 * single generic settings form is how a maintenance switch gets flipped by
 * accident. Adding a key here is a deliberate act, not a discovery.
 */
export const EDITABLE_SETTING_KEYS = [
  'seo.default_title',
  'seo.default_description',
  'seo.twitter_handle',
  'social.facebook_url',
  'social.instagram_url',
  'social.linkedin_url',
  'social.youtube_url',
  'general.site_name',
  'general.tagline',
  'general.description',
] as const

export type EditableSettingKey = (typeof EDITABLE_SETTING_KEYS)[number]

export function isEditableSettingKey(key: string): key is EditableSettingKey {
  return (EDITABLE_SETTING_KEYS as readonly string[]).includes(key)
}