import { describe, expect, it } from 'vitest'

import {
  ALLOWED_MIME_TYPES,
  buildStoragePath,
  checkUploadFile,
  MAX_BYTES,
  MEDIA_FOLDERS,
  mediaMetadataSchema,
  sniffImageMime,
} from '@/features/media/validation'

/**
 * Media upload validation.
 *
 * The storage path is the security-relevant part. `buildStoragePath` must never
 * return a path derived from a user-supplied filename, because a filename is
 * attacker-controlled and can contain path separators — `../../public-media/x.png`
 * would let an upload escape its folder, and in some storage backends escape its
 * bucket entirely.
 */
describe('checkUploadFile', () => {
  // One real file per accepted format, so the byte-sniffing tests exercise the
  // same code path a real upload takes.
  const SAMPLES: Record<string, { name: string; bytes: number[] }> = {
    'image/png': {
      name: 'logo.png',
      bytes: [
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      ],
    },
    'image/jpeg': {
      name: 'photo.jpg',
      bytes: [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46],
    },
    'image/gif': {
      name: 'loop.gif',
      bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00],
    },
    'image/webp': {
      name: 'shot.webp',
      bytes: [
        0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
        0x56, 0x50, 0x38, 0x20,
      ],
    },
    'image/avif': {
      name: 'modern.avif',
      bytes: [
        0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66,
        0x00, 0x00, 0x00, 0x00,
      ],
    },
    'image/svg+xml': {
      name: 'logo.svg',
      bytes: [
        0x3c, 0x73, 0x76, 0x67, 0x20, 0x78, 0x6d, 0x6c, 0x6e, 0x73, 0x3d, 0x22,
        0x73, 0x76, 0x67, 0x3e,
      ],
    },
  }

  const sampleFor = (mime: string) => new Uint8Array(SAMPLES[mime]!.bytes)

  it('accepts every allowed type with a matching extension', () => {
    for (const mime of ALLOWED_MIME_TYPES) {
      const sample = SAMPLES[mime]!
      const check = checkUploadFile({
        type: mime,
        size: 1024,
        name: sample.name,
      })
      expect(check.ok, `${mime} should be accepted`).toBe(true)
    }
  })

  /*
   * The reason `bytes` exists. Both `file.type` and the filename are supplied by
   * the client and can be made to agree with each other, so a field-only check
   * accepts an HTML document named `photo.png` declared as `image/png`.
   */
  it('rejects HTML content declared as image/png', () => {
    const html = new Uint8Array([
      0x3c, 0x68, 0x74, 0x6d, 0x6c, 0x3e, 0x3c, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74,
      0x3e, 0x61, 0x6c, 0x65, 0x72, 0x74, 0x28, 0x31, 0x29, 0x3c, 0x2f, 0x73,
      0x63, 0x72, 0x69, 0x70, 0x74, 0x3e, 0x3c, 0x2f, 0x68, 0x74, 0x6d, 0x6c, 0x3e,
    ])
    const check = checkUploadFile({
      type: 'image/png',
      size: html.length,
      name: 'payload.png',
      bytes: html,
    })
    expect(check.ok).toBe(false)
    if (!check.ok) expect(check.message).toMatch(/does not look like an image/i)
  })

  it('rejects bytes that match a DIFFERENT image type than declared', () => {
    // A real JPEG named .png and declared image/png.
    const check = checkUploadFile({
      type: 'image/png',
      size: 1024,
      name: 'sneaky.png',
      bytes: sampleFor('image/jpeg'),
    })
    expect(check.ok).toBe(false)
    if (!check.ok) expect(check.message).toMatch(/really a JPEG/i)
  })

  it('accepts genuine bytes for every allowed type', () => {
    for (const mime of ALLOWED_MIME_TYPES) {
      const sample = SAMPLES[mime]!
      const bytes = sampleFor(mime)
      const check = checkUploadFile({
        type: mime,
        size: bytes.length,
        name: sample.name,
        bytes,
      })
      expect(check.ok, `${mime} should pass byte sniffing`).toBe(true)
    }
  })

  it('rejects an empty or truncated file', () => {
    expect(
      checkUploadFile({
        type: 'image/png',
        size: 0,
        name: 'empty.png',
        bytes: new Uint8Array(0),
      }).ok,
    ).toBe(false)
    expect(
      checkUploadFile({
        type: 'image/png',
        size: 2,
        name: 'stub.png',
        bytes: new Uint8Array([0x89, 0x50]),
      }).ok,
    ).toBe(false)
  })

  it('still performs the field checks when bytes are supplied', () => {
    const bytes = sampleFor('image/png')
    expect(
      checkUploadFile({
        type: 'image/png',
        size: bytes.length,
        name: 'wrong.svg',
        bytes,
      }).ok,
    ).toBe(false)
    expect(
      checkUploadFile({
        type: 'application/pdf',
        size: bytes.length,
        name: 'doc.pdf',
        bytes,
      }).ok,
    ).toBe(false)
  })

  it('rejects a type outside the allowlist', () => {
    // The two shapes that matter: an executable, and an HTML file that browsers
    // will happily render as a document.
    expect(checkUploadFile({ type: 'application/pdf', size: 1024, name: 'a.pdf' }).ok).toBe(false)
    expect(checkUploadFile({ type: 'text/html', size: 1024, name: 'a.html' }).ok).toBe(false)
    expect(checkUploadFile({ type: 'image/svg+xml', size: 1024, name: 'a.svg' }).ok).toBe(true)
  })

  it('rejects a file over the size limit', () => {
    const check = checkUploadFile({
      type: 'image/png',
      size: MAX_BYTES + 1,
      name: 'big.png',
    })
    expect(check.ok).toBe(false)
    if (!check.ok) expect(check.message).toMatch(/limit is 5 MB/)
  })

  it('accepts a file exactly at the limit', () => {
    expect(
      checkUploadFile({ type: 'image/png', size: MAX_BYTES, name: 'exact.png' })
        .ok,
    ).toBe(true)
  })

  it('rejects an extension that disagrees with the claimed type', () => {
    // Content-sniffing shape: claims to be a PNG, named .svg.
    const check = checkUploadFile({
      type: 'image/png',
      size: 1024,
      name: 'payload.svg',
    })
    expect(check.ok).toBe(false)
    if (!check.ok) expect(check.message).toMatch(/extension does not match/)
  })

  it('reports the type problem before the size problem', () => {
    // A 40 MB TIFF has more use for "type not supported" than "too big".
    const check = checkUploadFile({
      type: 'image/tiff',
      size: 40 * 1024 * 1024,
      name: 'scan.tiff',
    })
    expect(check.ok).toBe(false)
    if (!check.ok) expect(check.message).toMatch(/file type is not supported/i)
  })

  it('flags an SVG as scriptable', () => {
    const svg = checkUploadFile({ type: 'image/svg+xml', size: 100, name: 'a.svg' })
    expect(svg.ok && svg.scriptable).toBe(true)

    const png = checkUploadFile({ type: 'image/png', size: 100, name: 'a.png' })
    expect(png.ok && png.scriptable).toBe(false)
  })

  it('matches the extension case-insensitively', () => {
    expect(
      checkUploadFile({ type: 'image/jpeg', size: 100, name: 'PHOTO.JPEG' }).ok,
    ).toBe(true)
  })
})

describe('sniffImageMime', () => {
  const bytesOf = (...b: number[]) => new Uint8Array(b)
  const asciiOf = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)))

  it('identifies PNG by its 8-byte signature', () => {
    expect(sniffImageMime(bytesOf(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)))
      .toBe('image/png')
  })

  it('identifies JPEG and GIF', () => {
    expect(sniffImageMime(bytesOf(0xff, 0xd8, 0xff))).toBe('image/jpeg')
    expect(sniffImageMime(bytesOf(0x47, 0x49, 0x46, 0x38))).toBe('image/gif')
  })

  it('identifies WebP by RIFF + WEBP', () => {
    // RIFF alone is not enough — it is also the signature of WAV and AVI.
    expect(sniffImageMime(bytesOf(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4))).toBeNull()
    expect(
      sniffImageMime(bytesOf(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50)),
    ).toBe('image/webp')
  })

  it('identifies AVIF by its ftyp brand', () => {
    const head = bytesOf(0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66)
    expect(sniffImageMime(head)).toBe('image/avif')
    // A non-AVIF ISO-BMFF container must not be accepted as AVIF.
    const mp4 = bytesOf(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32)
    expect(sniffImageMime(mp4)).toBeNull()
  })

  it('identifies SVG past a BOM or an XML prolog', () => {
    expect(sniffImageMime(asciiOf('<?xml version="1.0"?><svg width="1">'))).toBe(
      'image/svg+xml',
    )
    /*
     * The BOM must be supplied as its three UTF-8 BYTES (EF BB BF). Building it
     * with `charCodeAt` on U+FEFF would produce 0xFEFF, which is not a UTF-8
     * encoding of anything and is not what a real file contains.
     */
    expect(
      sniffImageMime(
        bytesOf(0xef, 0xbb, 0xbf, ...asciiOf('<svg xmlns="http://www.w3.org/2000/svg">')),
      ),
    ).toBe('image/svg+xml')
  })

  it('rejects an HTML document that merely mentions <svg>', () => {
    expect(
      sniffImageMime(asciiOf('<html><body>an <svg> icon appeared</body></html>')),
    ).toBeNull()
  })

  it('returns null for anything unrecognised', () => {
    expect(sniffImageMime(asciiOf('<html><body>hi</body></html>'))).toBeNull()
    expect(sniffImageMime(asciiOf('GIF but not quite'))).toBeNull()
    expect(sniffImageMime(new Uint8Array(0))).toBeNull()
  })
})

describe('buildStoragePath', () => {
  const base = {
    id: '0d106230-2688-4a92-a0f0-cf9c3a6bede3',
    mimeType: 'image/png',
    bucket: 'private-media',
    folder: 'articles',
  } as const

  it('derives the extension from the validated MIME type, not the filename', () => {
    const path = buildStoragePath(base)
    expect(path).toBe(
      'private-media/articles/0d106230-2688-4a92-a0f0-cf9c3a6bede3.png',
    )
  })

  it('writes into the requested bucket', () => {
    expect(buildStoragePath({ ...base, bucket: 'public-media' }).startsWith(
      'public-media/',
    )).toBe(true)
  })

  /*
   * The folder is user-supplied. Anything that is not a plain slug must be
   * replaced with the default rather than interpolated, or a folder of
   * `../../public-media` would redirect the write into the other bucket.
   */
  it('refuses a folder containing a path traversal', () => {
    for (const hostile of [
      '../../public-media',
      '../secrets',
      'a/b',
      'a\\b',
      '.',
      '..',
      '-leading-dash',
      '',
    ]) {
      const path = buildStoragePath({ ...base, folder: hostile })
      expect(path, hostile).toBe(
        'private-media/general/0d106230-2688-4a92-a0f0-cf9c3a6bede3.png',
      )
      expect(path, hostile).not.toContain('..')
    }
  })

  it('accepts a plain slug folder', () => {
    expect(buildStoragePath({ ...base, folder: 'General' })).toContain(
      '/general/',
    )
    expect(buildStoragePath({ ...base, folder: 'a_b-1' })).toContain('/a_b-1/')
  })

  it('produces a path with exactly two slashes', () => {
    const path = buildStoragePath(base)
    expect(path.split('/')).toHaveLength(3)
  })
})

describe('mediaMetadataSchema', () => {
  it('applies the general folder default', () => {
    const parsed = mediaMetadataSchema.safeParse({})
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.folder).toBe('general')
      expect(parsed.data.isPublic).toBe(false)
    }
  })

  it('rejects an oversized alt text', () => {
    expect(
      mediaMetadataSchema.safeParse({ altText: 'a'.repeat(301) }).success,
    ).toBe(false)
  })

  it('rejects a folder that is not a slug', () => {
    expect(
      mediaMetadataSchema.safeParse({ folder: '../etc' }).success,
    ).toBe(false)
  })

  it('keeps the offered folders free of duplicates', () => {
    expect(new Set(MEDIA_FOLDERS).size).toBe(MEDIA_FOLDERS.length)
  })
})