import { z } from 'zod'

/**
 * Media upload validation.
 *
 * Pure and framework-free so it is unit testable, and shared by the Server Action
 * and the upload form. The server re-validates regardless — a client check is a
 * usability feature, never a security control.
 *
 * WHY VALIDATE AT ALL WHEN THE BUCKET ALSO CONSTRAINS THIS
 *
 * Migration 011 sets `allowed_mime_types` and a 5 MB `file_size_limit` on both
 * buckets, and Storage rejects anything else. So this is genuinely defence in
 * depth — but it is the FIRST defence, and it is the one that produces a useful
 * message. Storage's rejection arrives as a generic PostgREST error after the
 * bytes have already been uploaded, which is slow and tells the editor nothing
 * about which part of their file was wrong.
 *
 * The allowed list is kept identical to migration 011. If one changes, the other
 * must, or the form will accept a file the bucket then rejects.
 */

/** Must match `storage.buckets.allowed_mime_types` in migration 011. */
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/svg+xml',
] as const

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number]

/** Must match the buckets' `file_size_limit` in migration 011. */
export const MAX_BYTES = 5_242_880 // 5 MB

/**
 * MIME types that must never be accepted regardless of what the browser claims.
 *
 * `image/svg+xml` IS in the allowed list because the buckets permit it, but an
 * SVG is an XML document that can carry `<script>`. Where it is rendered matters:
 * an SVG referenced by `<img src>` is inert in every current browser, but one
 * served from a different path, or inlined, is not. The upload path therefore
 * stores SVGs in the PRIVATE bucket by default, and the note on the field below
 * records that promoting one to public is a deliberate act.
 */
export const SCRIPTABLE_MIME_TYPES: readonly string[] = ['image/svg+xml']

/** Folder names offered in the UI. Free text is allowed but these are suggested. */
export const MEDIA_FOLDERS = [
  'general',
  'scholarships',
  'articles',
  'authors',
] as const

const FOLDER_PATTERN = /^[a-z0-9][a-z0-9_-]{0,40}$/i

export const mediaMetadataSchema = z.object({
  altText: z
    .string()
    .trim()
    .max(300, 'Alt text is too long.')
    .optional()
    .default(''),
  caption: z
    .string()
    .trim()
    .max(500, 'That caption is too long.')
    .optional()
    .default(''),
  attribution: z
    .string()
    .trim()
    .max(200, 'That attribution is too long.')
    .optional()
    .default(''),
  folder: z
    .string()
    .trim()
    .regex(
      FOLDER_PATTERN,
      'Use letters, numbers, dashes or underscores only.',
    )
    .optional()
    .default('general'),
  /** Explicitly opt in to the public bucket. Off unless requested. */
  isPublic: z.coerce.boolean().optional().default(false),
  /**
   * The image carries no information and must be hidden from assistive
   * technology.
   *
   * Without this flag, "decorative" and "nobody wrote the alt text" are the same
   * `NULL`, so the database cannot require either. The CHECK
   * `media_assets_alt_or_decorative` (migration 030) makes an asset either
   * described or explicitly decorative; this field is how an editor says which.
   */
  isDecorative: z.coerce.boolean().optional().default(false),
})

export type MediaMetadataInput = z.infer<typeof mediaMetadataSchema>

export type FileCheck =
  | { ok: true; mimeType: AllowedMimeType; scriptable: boolean }
  | { ok: false; message: string }

/**
 * Identify an image by its leading bytes.
 *
 * `file.type` and the filename are both attacker-controlled, so agreeing with each
 * other proves nothing. This is the check that actually looks at the content, and
 * it is what stops a file of HTML named `photo.png` and declared as `image/png`
 * from being stored: a type/extension pair can be made to agree, magic bytes
 * cannot be faked without producing a valid image.
 *
 * Returns null when the bytes match none of the accepted formats. Callers must
 * treat null as a rejection, not as "unknown, allow it".
 */
export function sniffImageMime(bytes: Uint8Array): AllowedMimeType | null {
  // Container formats have fixed signatures.
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return 'image/png'
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return 'image/gif'
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && ascii(bytes, 8, 4) === 'WEBP')
    return 'image/webp'
  // AVIF is an ISO-BMFF container: `....ftypavif` at offset 4.
  if (ascii(bytes, 4, 4) === 'ftyp') {
    const brand = ascii(bytes, 8, 4)
    if (brand === 'avif' || brand === 'avis') return 'image/avif'
  }
  // SVG is text; XML may carry a BOM, a doctype or a comment before <svg>.
  if (looksLikeSvg(bytes)) return 'image/svg+xml'

  return null
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false
  return signature.every((byte, i) => bytes[i] === byte)
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let out = ''
  for (let i = offset; i < offset + length && i < bytes.length; i++) {
    const byte = bytes[i]
    // `noUncheckedIndexedAccess` makes this `number | undefined`; a missing
    // byte cannot be represented as a character, so it is skipped.
    if (typeof byte === 'number') out += String.fromCharCode(byte)
  }
  return out
}

/**
 * SVG is text, so it is identified by decoding the head rather than by signature.
 *
 * `TextDecoder` is used rather than `String.fromCharCode` because the BOM is a
 * three-byte UTF-8 sequence: `fromCharCode` maps those bytes to U+00EF U+00BB
 * U+00BF, so stripping U+FEFF afterwards would never match.
 *
 * An XML prolog, a doctype or a comment may legally precede the `<svg>` root
 * element, so those are walked past rather than required to be absent.
 */
function looksLikeSvg(bytes: Uint8Array): boolean {
  let head: string
  try {
    head = new TextDecoder('utf-8', { fatal: false }).decode(
      bytes.subarray(0, Math.min(bytes.length, 1024)),
    )
  } catch {
    return false
  }

  /*
   * Strip the byte-order mark, then walk past everything that legally precedes
   * the root element in an XML document: whitespace, an XML declaration, a
   * doctype and comments.
   */
  head = head.replace(/^\uFEFF/, '').trim()

  let rest = head
  for (let i = 0; i < 8; i++) {
    const before = rest
    if (rest.startsWith('<?')) {
      const end = rest.indexOf('?>')
      if (end === -1) return false
      rest = rest.slice(end + 2)
    } else if (rest.startsWith('<!--')) {
      const end = rest.indexOf('-->')
      if (end === -1) return false
      rest = rest.slice(end + 3)
    } else if (rest.startsWith('<!')) {
      const close = rest.indexOf('>')
      if (close === -1) return false
      rest = rest.slice(close + 1)
    }
    rest = rest.trim()
    if (rest === before) break
  }

  /*
   * The ROOT element must be `<svg`. Requiring an `<svg>` element to appear
   * *somewhere* is not enough: an HTML page whose body happens to contain the
   * literal text "<svg>" would be accepted, and SVG is the one accepted format
   * that can carry script.
   */
  return /^<svg[\s>/]/i.test(rest)
}

/**
 * Validate an uploaded file.
 *
 * Checks the declared type, then the size, then the extension, then the actual
 * bytes — in that order, because a user who picks a 40 MB TIFF has more use for
 * "that file type is not supported" than for "too big".
 *
 * `bytes` is optional so the pure logic stays unit testable, but the Server Action
 * always supplies it: without it, only the attacker-controlled fields are checked,
 * which is the case this function was extended to cover.
 */
export function checkUploadFile(file: {
  type: string
  size: number
  name: string
  bytes?: Uint8Array | undefined
}): FileCheck {
  const allowed = ALLOWED_MIME_TYPES as readonly string[]

  if (!allowed.includes(file.type)) {
    return {
      ok: false,
      message: `That file type is not supported. Use one of: ${allowed
        .map((type) => type.replace('image/', ''))
        .join(', ')}.`,
    }
  }

  if (file.size > MAX_BYTES) {
    const mb = (file.size / 1_048_576).toFixed(1)
    return {
      ok: false,
      message: `That file is ${mb} MB. The limit is 5 MB.`,
    }
  }

  // SVG and friends are XML: a filename ending in `.svg` claiming to be a PNG is
  // the shape of a content-sniffing attack, so the extension has to agree.
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  const expected: Record<string, string[]> = {
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/webp': ['webp'],
    'image/avif': ['avif'],
    'image/gif': ['gif'],
    'image/svg+xml': ['svg'],
  }
  const allowedExtensions = expected[file.type] ?? []

  if (!allowedExtensions.includes(extension)) {
    return {
      ok: false,
      message: `The file extension does not match its type. Expected .${allowedExtensions.join(' or .')}.`,
    }
  }

  if (file.bytes) {
    const detected = sniffImageMime(file.bytes)

    if (detected === null) {
      return {
        ok: false,
        message:
          'That file does not look like an image. The contents do not match its file type.',
      }
    }

    if (detected !== file.type) {
      return {
        ok: false,
        message: `That file is really a ${detected.replace('image/', '').toUpperCase()} image, not a ${file.type.replace('image/', '').toUpperCase()}. Rename it to match its contents, or convert it.`,
      }
    }
  }

  return {
    ok: true,
    mimeType: file.type as AllowedMimeType,
    scriptable: SCRIPTABLE_MIME_TYPES.includes(file.type),
  }
}

/**
 * Build the storage object path.
 *
 * The original filename is NOT reused. It is attacker-controlled and can contain
 * path separators, a leading dot, or Unicode that normalises to something else
 * downstream. A generated name removes that whole class of problem, and the
 * original is preserved in `media_assets.file_name` for display.
 *
 * The extension is derived from the VALIDATED MIME type rather than from the
 * uploaded filename, so a renamed file cannot end up served under an extension
 * that does not match its bytes.
 */
export function buildStoragePath(input: {
  id: string
  mimeType: AllowedMimeType
  bucket: 'public-media' | 'private-media'
  folder: string
}): string {
  const extension = EXTENSION_BY_MIME[input.mimeType]
  const folder = FOLDER_PATTERN.test(input.folder)
    ? input.folder.toLowerCase()
    : 'general'
  return `${input.bucket}/${folder}/${input.id}.${extension}`
}

const EXTENSION_BY_MIME: Record<AllowedMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
}

export { fieldErrorsFrom } from '@/lib/validation/auth'
