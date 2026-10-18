/**
 * Featured-image selection rules.
 *
 * Pure and framework-free. Two jobs:
 *
 *   1. validate an asset id coming from a form before it reaches a foreign key;
 *   2. decide how the chosen image is rendered, which is where the alt-text work
 *      from Phase 5 increment 5 finally becomes user-facing.
 */

/** An asset as the picker sees it. */
export type SelectableAsset = {
  id: string
  fileName: string
  altText: string | null
  isDecorative: boolean
  displayUrl: string | null
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Validate a submitted image id.
 *
 * Empty is a valid answer — "no featured image" is a legitimate state — and
 * anything that is not a UUID is refused before it can become a PostgREST filter
 * or a foreign-key lookup against the wrong table.
 */
export function parseImageId(
  raw: string | null | undefined,
): { ok: true; id: string | null } | { ok: false; message: string } {
  const value = (raw ?? '').trim()
  if (value === '') return { ok: true, id: null }
  if (!UUID.test(value)) {
    return { ok: false, message: 'That image could not be identified.' }
  }
  return { ok: true, id: value }
}

/**
 * The `alt` attribute for a chosen image.
 *
 * This is the single place the rule is expressed, so the picker, the article
 * detail page and any future renderer cannot disagree:
 *
 *   - a DESCRIBED image gets its alt text verbatim;
 *   - a DECORATIVE image gets `''`, which tells a screen reader to SKIP it —
 *     which is different from omitting the attribute, where a browser exposes
 *     the file name as its accessible name;
 *   - an undescribed, non-decorative image falls back to the file name rather
 *     than an empty alt, because silently hiding a meaningful image is worse
 *     than naming it badly. The database CHECK makes this unreachable; the
 *     fallback exists so a schema change cannot make it silent.
 */
export function altAttributeFor(asset: {
  altText: string | null
  isDecorative: boolean
  fileName: string
}): string {
  if (asset.isDecorative) return ''
  const alt = asset.altText?.trim()
  if (alt) return alt
  return asset.fileName
}