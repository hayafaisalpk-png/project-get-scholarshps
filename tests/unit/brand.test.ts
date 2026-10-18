import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import {
  BRAND_MARK,
  BRAND_MARK_FOOTER_HEIGHT_PX,
  BRAND_MARK_HEADER_HEIGHT_PX,
  BRAND_MARK_MAX_WIDTH_PX,
  BRAND_NAME_SCALE,
  BRAND_NAME_SIZE_PX,
  BRAND_NAME_SIZE_TOKEN,
  BRAND_WORDMARK,
  BRAND_WORDMARK_TEXT,
  brandMarkWidth,
} from '@/lib/brand'

/**
 * Brand geometry.
 *
 * The site renders `[mark] GetScholarship`: the cap-and-scroll illustration as an
 * image, the name as live text. These tests pin the geometry of both halves.
 *
 * THESE TESTS READ THE GENERATED FILES, not just the constants. Every defect found
 * while setting the brand up was invisible to a test that only inspected the
 * TypeScript: a PNG whose background was still the master's pale blue (it rendered
 * as a tinted rectangle on the white header), a favicon that came out 512x531
 * because two geometry operations were chained in one pipeline, and a "mark" that
 * still had the leading "G" of the wordmark attached to it.
 */

const MARK_PATH = path.join(process.cwd(), 'public', BRAND_MARK.src.replace(/^\//, ''))
const MASTER_PATH = path.join(process.cwd(), 'public', 'brand', 'logo-getscholarship.jpg')
const FAVICON_PATH = path.join(process.cwd(), 'src', 'app', 'icon.png')

/** Share of pixels that are fully clear, part-opaque, and opaque. */
async function alphaShare(file: string) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const pixels = info.width * info.height
  let clear = 0
  let partial = 0
  let opaque = 0

  for (let i = 0; i < pixels; i++) {
    const a = data[i * 4 + 3]
    if (a === 0) clear++
    else if (a === 255) opaque++
    else partial++
  }

  return { clear: clear / pixels, partial: partial / pixels, opaque: opaque / pixels }
}

/** Ink pixels per column — the signal the crop boundary is decided on. */
async function inkPerColumn(file: string) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  /** Alpha of one pixel, or 0 if the buffer is somehow short. */
  const alphaAt = (x: number, y: number): number => data[(y * info.width + x) * 4 + 3] ?? 0

  const ink: number[] = []
  for (let x = 0; x < info.width; x++) {
    let count = 0
    for (let y = 0; y < info.height; y++) {
      if (alphaAt(x, y) > 8) count++
    }
    ink.push(count)
  }
  return { ink, width: info.width, height: info.height }
}

/**
 * Runs of low-coverage columns at least MIN_GAP long, with their x range.
 *
 * "Low coverage" rather than zero ink, for the reason the generator learned the hard
 * way: JPEG noise and the alpha ramp leave a few ink pixels in a genuinely empty
 * column, so a zero test misses the real gap between two elements entirely.
 */
function lowCoverageRuns(
  ink: number[],
  height: number,
  minGap = 3,
): { start: number; end: number; length: number }[] {
  const blankMax = Math.max(1, Math.round(height * 0.08))
  const runs: { start: number; end: number; length: number }[] = []
  let start = -1

  for (let x = 0; x <= ink.length; x++) {
    // `x === ink.length` is the sentinel that closes a run that reaches the edge.
    const blank = x < ink.length && (ink[x] ?? Number.POSITIVE_INFINITY) <= blankMax
    if (blank && start === -1) start = x
    if (!blank && start !== -1) {
      if (x - start >= minGap) runs.push({ start, end: x - 1, length: x - start })
      start = -1
    }
  }
  return runs
}

describe('the brand mark', () => {
  it('points at the derived transparent PNG, never the JPEG master', () => {
    // The master is a flat-background JPEG: rendering it into the chrome would draw
    // an opaque rectangle on any surface that is not the same pale tint.
    expect(BRAND_MARK.src).toBe('/brand/getscholarship-mark.png')
    expect(BRAND_MARK.src.endsWith('.jpg')).toBe(false)
  })

  it('declares whole-pixel dimensions', () => {
    // Deliberately NOT the specific numbers. The master is operator-supplied and was
    // legitimately replaced during this work, so pinning a pixel count here would
    // only ever assert "nobody has ever updated the logo". The assertion that
    // matters — the constants matching the file on disk — is below.
    expect(Number.isInteger(BRAND_MARK.width)).toBe(true)
    expect(Number.isInteger(BRAND_MARK.height)).toBe(true)
    expect(BRAND_MARK.width).toBeGreaterThan(0)
    expect(BRAND_MARK.height).toBeGreaterThan(0)
  })

  it('records the file aspect ratio to four decimal places', () => {
    const actual = BRAND_MARK.width / BRAND_MARK.height
    expect(BRAND_MARK.ratio).toBeCloseTo(actual, 4)
  })

  it('is the mark alone — a compact block, not part of the 5:1 lockup', () => {
    // The supplied master is a wide lockup. If the crop ever swallowed the
    // wordmark, this ratio would climb towards 5 and the header would grow a text
    // silhouette it no longer needs.
    expect(BRAND_MARK.ratio).toBeLessThan(2)
  })
})

describe('the name', () => {
  it('splits into a regular-weight lead and a bold remainder', () => {
    expect(BRAND_WORDMARK.lead).toBe('Get')
    expect(BRAND_WORDMARK.bold).toBe('Scholarship')
  })

  it('composes back to one name, with nothing lost between the parts', () => {
    expect(BRAND_WORDMARK_TEXT).toBe(`${BRAND_WORDMARK.lead}${BRAND_WORDMARK.bold}`)
    expect(BRAND_WORDMARK_TEXT).toBe('GetScholarship')
  })

  it('gives the bold part more of the name than the regular part', () => {
    // A sanity check on the split itself: if these ever come out equal it is far more
    // likely that the boundary moved by accident than that the brand is symmetrical.
    expect(BRAND_WORDMARK.bold.length).toBeGreaterThan(BRAND_WORDMARK.lead.length)
  })

  it('splits the name so the two halves can be set in different weights', () => {
    // "Get" normal, "Scholarship" bold. If the two halves were emitted as a single
    // string there would be nothing to style differently, which is the whole reason
    // the name is text rather than part of the bitmap.
    expect(BRAND_WORDMARK.lead).not.toBe(BRAND_WORDMARK.bold)
    expect(BRAND_WORDMARK_TEXT.startsWith(BRAND_WORDMARK.lead)).toBe(true)
    expect(BRAND_WORDMARK_TEXT.endsWith(BRAND_WORDMARK.bold)).toBe(true)
  })
})

describe('the mark fits the header box it replaced', () => {
  it('is the same 32px the placeholder mark occupied', () => {
    expect(BRAND_MARK_HEADER_HEIGHT_PX).toBe(32)
  })

  it('occupies exactly half the 64px bar, as the placeholder mark did', () => {
    // Not "less than half": the old `h-8` square was precisely half of `h-16`, and
    // matching it is what keeps the bar's vertical rhythm unchanged.
    expect(BRAND_MARK_HEADER_HEIGHT_PX).toBe(64 / 2)
  })

  it('does not need its width clamp at that height', () => {
    // If this ever fails, the clamp starts binding and `object-contain` begins to
    // letterbox the mark.
    expect(brandMarkWidth(BRAND_MARK_HEADER_HEIGHT_PX)).toBeLessThanOrEqual(BRAND_MARK_MAX_WIDTH_PX)
  })

  it('leaves room for the name beside it', () => {
    // The mark plus a gap plus "GetScholarship" has to fit a 320px viewport. The
    // mark is the part this module controls, so its share of the bar is asserted.
    expect(brandMarkWidth(BRAND_MARK_HEADER_HEIGHT_PX)).toBeLessThan(BRAND_MARK_MAX_WIDTH_PX)
  })

  it('scales the footer mark by the same ratio', () => {
    expect(BRAND_MARK_FOOTER_HEIGHT_PX).toBe(28)
    expect(brandMarkWidth(BRAND_MARK_FOOTER_HEIGHT_PX)).toBe(
      Math.round(28 * BRAND_MARK.ratio),
    )
  })
})

describe('the enlarged name', () => {
  it('is 1.243125x the size it was before, in every placement', () => {
    // 18px header and 16px footer/admin, both multiplied by 1.243125
    // (1.3 brand enlargement x 1.125 global increase x 0.85 reduction).
    expect(BRAND_NAME_SCALE).toBe(1.243125)
    expect(BRAND_NAME_SIZE_PX.header).toBeCloseTo(22.37625, 5)
    expect(BRAND_NAME_SIZE_PX.footer).toBeCloseTo(19.89, 5)
    expect(BRAND_NAME_SIZE_PX.admin).toBeCloseTo(19.89, 5)
  })

  it('keeps the footer and the admin sidebar the same size', () => {
    // They were both 16px before, so enlarging one and not the other would be a
    // silent inconsistency between two places showing the same name.
    expect(BRAND_NAME_SIZE_PX.admin).toBe(BRAND_NAME_SIZE_PX.footer)
    expect(BRAND_NAME_SIZE_TOKEN.admin).toBe(BRAND_NAME_SIZE_TOKEN.footer)
  })

  it('is larger than the previous scale in every placement', () => {
    for (const size of Object.values(BRAND_NAME_SIZE_PX)) {
      expect(size).toBeGreaterThan(16)
    }
    expect(BRAND_NAME_SIZE_PX.header).toBeGreaterThan(BRAND_NAME_SIZE_PX.footer)
  })

  it('uses a distinct token per placement', () => {
    expect(BRAND_NAME_SIZE_TOKEN.header).not.toBe(BRAND_NAME_SIZE_TOKEN.footer)
  })
})

describe('the CSS tokens and the TypeScript constants agree', () => {
  /*
   * The rendered size comes from `--text-brand-name-*` in `globals.css`; the numbers
   * documented in `brand.ts` come from the arithmetic above. Nothing in the type
   * system connects them, so nothing would stop them drifting apart silently — the
   * name would simply render at a size nobody wrote down. Reading the stylesheet is
   * the only way to catch that.
   */
  const css = readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8')

  /** The px value a `--text-*: <n>rem` declaration resolves to at a 16px root. */
  function tokenPx(token: string): number {
    const declaration = new RegExp(`--${token}:\\s*([\\d.]+)rem`).exec(css)
    expect(declaration, `--${token} is not declared in globals.css`).not.toBeNull()
    return Number(declaration?.[1]) * 16
  }

  it('declares both name-size tokens', () => {
    expect(tokenPx('text-brand-name-sm')).toBeCloseTo(BRAND_NAME_SIZE_PX.footer, 5)
    expect(tokenPx('text-brand-name-md')).toBeCloseTo(BRAND_NAME_SIZE_PX.header, 5)
  })

  it('declares them in rem, not px', () => {
    // A px value here would opt the site's name out of the reader's browser
    // font-size preference, which is an accessibility regression.
    expect(css).toMatch(/--text-brand-name-sm:\s*[\d.]+rem;/)
    expect(css).toMatch(/--text-brand-name-md:\s*[\d.]+rem;/)
    expect(css).not.toMatch(/--text-brand-name-[a-z]+:\s*[\d.]+px;/)
  })
})

describe('brandMarkWidth', () => {
  it('derives width from height and the file ratio', () => {
    expect(brandMarkWidth(32)).toBe(Math.round(32 * BRAND_MARK.ratio))
  })

  it('rounds to whole pixels, because a fractional width is not renderable', () => {
    expect(Number.isInteger(brandMarkWidth(32))).toBe(true)
    expect(Number.isInteger(brandMarkWidth(28))).toBe(true)
  })

  it('collapses to zero at zero height rather than returning NaN', () => {
    expect(brandMarkWidth(0)).toBe(0)
  })
})

describe('the generated mark file on disk', () => {
  it('exists at the path the site renders', async () => {
    const meta = await sharp(MARK_PATH).metadata()
    expect(meta.format).toBe('png')
  })

  it('has the intrinsic size BRAND_MARK declares', async () => {
    // Catches a stale constant after the master is replaced.
    const meta = await sharp(MARK_PATH).metadata()
    expect(meta.width).toBe(BRAND_MARK.width)
    expect(meta.height).toBe(BRAND_MARK.height)
  })

  it('carries an alpha channel, which the JPEG master cannot', async () => {
    const meta = await sharp(MARK_PATH).metadata()
    expect(meta.hasAlpha).toBe(true)
  })

  it('has the background REMOVED, not merely trimmed', async () => {
    // The defect this catches: trimming alone left the master's pale blue baked in,
    // so the header drew an opaque tinted rectangle.
    const share = await alphaShare(MARK_PATH)
    expect(share.clear).toBeGreaterThan(0.2)
  })

  it('keeps anti-aliased edges rather than hard-cutting them', async () => {
    // A fully binary alpha channel is the signature of a hard threshold: it either
    // leaves a halo of background colour or chews into the artwork.
    const share = await alphaShare(MARK_PATH)
    expect(share.partial).toBeGreaterThan(0)
    expect(share.opaque).toBeGreaterThan(0.1)
  })

  it('contains no internal gap, so no fragment of the wordmark is still attached', async () => {
    /*
     * THE REGRESSION THIS GUARDS.
     *
     * Three crop rules were tried. The two that failed both left the leading "G" of
     * the wordmark stuck to the mark, and both looked plausible in the file listing —
     * they were only caught by looking at the image. The tell is structural: two
     * separate pieces of artwork have low-coverage columns BETWEEN them, while a
     * single mark does not.
     *
     * Runs touching an outer edge are allowed: the mark's left edge legitimately
     * thins out where the tassel tapers.
     */
    const { ink, width, height } = await inkPerColumn(MARK_PATH)
    const internal = lowCoverageRuns(ink, height).filter((r) => r.start > 0 && r.end < width - 1)

    expect(
      internal,
      `internal low-coverage gaps at ${JSON.stringify(internal)} — the crop looks like it ` +
        'includes part of the wordmark',
    ).toEqual([])
  })

  it('is far narrower than the master it was cut from', async () => {
    const master = await sharp(MASTER_PATH).metadata()
    expect(BRAND_MARK.width).toBeLessThan((master.width ?? 0) / 2)
  })
})

describe('the generated favicon on disk', () => {
  it('is exactly square, as a favicon must be', async () => {
    // The defect this catches: `extend` and `resize` chained in one sharp pipeline
    // emitted 512x531.
    const meta = await sharp(FAVICON_PATH).metadata()
    expect(meta.width).toBe(512)
    expect(meta.height).toBe(512)
  })

  it('is a PNG with the background removed', async () => {
    const meta = await sharp(FAVICON_PATH).metadata()
    expect(meta.format).toBe('png')
    expect(meta.hasAlpha).toBe(true)

    const share = await alphaShare(FAVICON_PATH)
    expect(share.clear).toBeGreaterThan(0.2)
  })

  it('stays small enough to be fetched on every page without thinking about it', async () => {
    // A 512x512 RGBA PNG of one navy shape on transparency is 261 KB at full colour
    // depth. It is written as an 8-bit palette for exactly this reason.
    //
    // Measured with `stat` rather than `sharp().toBuffer()`, which RE-ENCODES: that
    // reports ~101 KB for a 65 KB palette file, because re-encoding drops it back to
    // full-colour RGBA. The number that matters to a visitor is the one on disk.
    expect(statSync(FAVICON_PATH).size).toBeLessThan(100_000)
  })
})