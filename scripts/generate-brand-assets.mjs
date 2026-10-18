#!/usr/bin/env node
import sharp from 'sharp'

/**
 * Generate the derived brand assets from the operator-supplied master.
 *
 *   npm run brand:assets
 *
 * THE MASTER IS NEVER MODIFIED. Everything this writes is derived from it.
 *
 * WHERE THE MASTER LIVES
 *
 * `logo-getscholarship.jpg` in the project root is the canonical location. That
 * file was removed during this work, so the script also accepts the byte-identical
 * provenance copy at `public/brand/logo-getscholarship.jpg` and says loudly which
 * one it used. The two are interchangeable precisely because the root file was
 * never written to — but the fallback is announced, never silent, because quietly
 * promoting a derived artefact back to "the master" is exactly the kind of thing
 * that goes unnoticed until someone edits the wrong file.
 *
 * Three artefacts are produced:
 *
 *   1. public/brand/logo-getscholarship.jpg — a byte-for-byte copy, kept for
 *      provenance. The master is NOT rendered by the site.
 *   2. public/brand/getscholarship-mark.png — the cap-and-scroll MARK alone:
 *      background removed, margin trimmed, and the wordmark cropped off. The site
 *      draws the name as live text beside it, so only the illustration is an image.
 *      The master is a JPEG, which cannot carry transparency, so using it directly
 *      would draw an opaque rectangle on any surface that is not the same pale tint.
 *   3. src/app/icon.png — the mark squared and padded, for the favicon.
 *
 * Re-run this after replacing the master, then update the intrinsic size and ratio
 * in `src/lib/brand.ts` — the header's rendered width is derived from them.
 *
 * Also clear `.next/cache/images` afterwards: Next's image optimizer caches
 * derivatives by URL, so an overwritten file keeps serving the old artwork.
 */

import { access, copyFile, mkdir } from 'node:fs/promises'

const ROOT_MASTER = 'logo-getscholarship.jpg'
const PROVENANCE_COPY = 'public/brand/logo-getscholarship.jpg'
const MARK_OUTPUT = 'public/brand/getscholarship-mark.png'

/** True if the path exists. */
async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

const rootMasterPresent = await exists(ROOT_MASTER)

let SOURCE
if (rootMasterPresent) {
  SOURCE = ROOT_MASTER
} else if (await exists(PROVENANCE_COPY)) {
  SOURCE = PROVENANCE_COPY
  console.warn(
    `\n  NOTE  ${ROOT_MASTER} is not in the project root.\n` +
      `        Using the preserved provenance copy at ${PROVENANCE_COPY} as the master.\n` +
      `        It is byte-identical to the original, so the derived assets are\n` +
      `        unchanged — but restore ${ROOT_MASTER} if you have it.\n`,
  )
} else {
  console.error(
    `\n  No master logo found.\n` +
      `  Looked for ${ROOT_MASTER} (project root) and ${PROVENANCE_COPY}.\n` +
      `  Place the operator-supplied JPEG at either path and re-run.\n`,
  )
  process.exit(1)
}

/**
 * How far a pixel may stray from white and still count as background, 0-100.
 *
 * Deliberately low. A higher value eats the anti-aliased edge of the mark and
 * leaves it visibly chewed; this was set by inspecting the output, not guessed.
 */
const TRIM_THRESHOLD = 12

/**
 * Transparency ramp for the background.
 *
 * THE MASTER IS NOT WHITE. Its background is a very pale blue-grey, so trimming
 * alone produced a PNG with the tint still baked in — which renders as a visible
 * tinted rectangle on the white header. That was caught by looking at a
 * screenshot, not by an assertion.
 *
 * So the background colour is SAMPLED from the top-left corner and every pixel is
 * given an alpha based on how far it strays from it:
 *
 *   distance <= T0  -> fully transparent
 *   distance >= T1  -> fully opaque
 *
 * The ramp is wide rather than a hard cut, because the mark's edge pixels are
 * anti-aliased mixes of navy and background. A single cut-off threshold either
 * leaves a halo of background colour around the art or chews into it; a ramp keeps
 * the anti-aliasing, which is the whole reason to do this in pixels at all.
 */
const ALPHA_INVISIBLE_DISTANCE = 26
const ALPHA_OPAQUE_DISTANCE = 62

/** Strip the background out of an image, preserving anti-aliased edges. */
async function makeBackgroundTransparent(input) {
  const { data, info } = await sharp(input)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  // Sampled from the corner rather than hard-coded: the master's background is not
  // a colour anyone chose deliberately, so it must not be assumed either.
  const bg = [data[0], data[1], data[2]]

  const pixels = info.width * info.height
  const out = Buffer.alloc(pixels * 4)

  for (let i = 0; i < pixels; i++) {
    const r = data[i * 3]
    const g = data[i * 3 + 1]
    const b = data[i * 3 + 2]

    // Weighted to approximate perceived difference: the eye is most sensitive to
    // green, least to blue.
    const dr = r - bg[0]
    const dg = g - bg[1]
    const db = b - bg[2]
    const distance = Math.sqrt(0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db)

    const alpha =
      distance <= ALPHA_INVISIBLE_DISTANCE
        ? 0
        : distance >= ALPHA_OPAQUE_DISTANCE
          ? 255
          : Math.round(
              ((distance - ALPHA_INVISIBLE_DISTANCE) /
                (ALPHA_OPAQUE_DISTANCE - ALPHA_INVISIBLE_DISTANCE)) *
                255,
            )

    out[i * 4] = r
    out[i * 4 + 1] = g
    out[i * 4 + 2] = b
    out[i * 4 + 3] = alpha
  }

  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer()
}

await mkdir('public/brand', { recursive: true })

// Only write the provenance copy when the master came from somewhere else —
// copying a file onto itself is an error, and there is nothing to refresh anyway.
if (SOURCE !== PROVENANCE_COPY) {
  await copyFile(SOURCE, PROVENANCE_COPY)
}

const meta = await sharp(SOURCE).metadata()
const width = meta.width ?? 0
const height = meta.height ?? 0

if (!width || !height) {
  console.error(`Could not read the dimensions of ${SOURCE}.`)
  process.exit(1)
}

/* -------------------------------------------------------------------------- */
/* The mark — the picture WITHOUT the wordmark                                  */
/* -------------------------------------------------------------------------- */

/*
 * The site renders `[mark] GetScholarship`, with the name as live text so it stays
 * selectable, translatable and stylable ("Get" regular, "Scholarship" bold). Only
 * the cap-and-scroll illustration is an image, so that is all this emits.
 *
 * Trim first (against the background colour family), THEN make the background
 * transparent: trimming after the alpha ramp would trim against transparency and
 * cut into the anti-aliased edge.
 */
const trimmed = await sharp(SOURCE)
  .trim({ background: '#ffffff', threshold: TRIM_THRESHOLD })
  .toBuffer()

const transparent = await makeBackgroundTransparent(trimmed)

/*
 * The boundary between the mark and the wordmark is FOUND, not hard-coded.
 *
 * Three attempts, and the reasoning matters because two were wrong in ways that only
 * showed up in the rendered result:
 *
 *   1. "the first fully-blank column past the left sixth" — found a gap at x=163,
 *      which turned out to be BETWEEN TWO LETTERS, so the crop kept the whole
 *      wordmark.
 *   2. "the widest run of blank columns" — also wrong: it found that same gap at
 *      x=470, between letters, further from the boundary than the real one.
 *   3. Both assumed a background column has ZERO ink. It does not. The master's
 *      background is not perfectly uniform, and JPEG noise plus the alpha ramp leave
 *      2-4 ink pixels in a genuinely empty column, while a letter stroke runs 15-30
 *      and the cap runs 70-90. So "blank" has to mean LOW COVERAGE, not nothing.
 *
 * With that correction the real boundary appears at x=121, six columns of noise, and
 * the leading "G" is excluded — which is what the rendered mark and the favicon now
 * show.
 */
const ALPHA_IS_INK = 8

/** A run shorter than this is noise, not the gap between two elements. */
const MIN_GAP_PX = 3

/**
 * A column counts as blank at up to this share of the artwork's height.
 *
 * Chosen from the measured profile: empty columns carry 2-4 rows of noise out of 101
 * (~3%), a letter stroke carries 15+ (~15%), and solid artwork 70+. A threshold of
 * 8% sits in the empty space between those populations with room on both sides.
 */
const BLANK_MAX_INK_RATIO = 0.08

/** The mark must be at least this fraction of the lockup, or the crop is suspect. */
const MIN_MARK_FRACTION = 0.15

/** ...and at most this much, or the "mark" has swallowed the wordmark. */
const MAX_MARK_FRACTION = 0.6

const art = await sharp(transparent).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const channels = art.info.channels
const stride = art.info.width * channels

/** Number of rows carrying ink in each column. */
const inkPerColumn = new Uint32Array(art.info.width)
for (let x = 0; x < art.info.width; x++) {
  let ink = 0
  for (let y = 0; y < art.info.height; y++) {
    if (art.data[y * stride + x * channels + 3] > ALPHA_IS_INK) ink++
  }
  inkPerColumn[x] = ink
}

const BLANK_MAX_INK = Math.max(1, Math.round(art.info.height * BLANK_MAX_INK_RATIO))

/** First gap of at least MIN_GAP_PX low-coverage columns, past MIN_MARK_FRACTION. */
function findGap() {
  const searchFrom = Math.round(art.info.width * MIN_MARK_FRACTION)
  let runStart = -1

  for (let x = searchFrom; x <= art.info.width; x++) {
    const blank = x < art.info.width && inkPerColumn[x] <= BLANK_MAX_INK

    if (blank && runStart === -1) runStart = x

    if (!blank && runStart !== -1) {
      const length = x - runStart
      if (length >= MIN_GAP_PX) return { start: runStart, length }
      runStart = -1
    }
  }
  return null
}

const gap = findGap()

if (!gap) {
  console.error(
    'Could not find a gap of at least ' +
      MIN_GAP_PX +
      'px between the mark and the wordmark.\n' +
      '  Refusing to guess a crop — check that the master is the horizontal lockup.',
  )
  process.exit(1)
}

/* Crop one pixel into the gap so the mark keeps a clean edge. */
const markRight = gap.start - 1

/*
 * Sanity-check the split. Ink immediately before the gap means the left side is real
 * artwork; ink immediately after means there IS a wordmark on the right, so the crop
 * is a split rather than a truncation. Either check failing means the assumption
 * above no longer holds for this master.
 */
const inkBefore = inkPerColumn[Math.max(0, markRight - 2)]
const inkAfter = inkPerColumn[Math.min(art.info.width - 1, gap.start + gap.length + 2)]

if (inkBefore <= BLANK_MAX_INK || inkAfter <= BLANK_MAX_INK) {
  console.error(
    `The detected gap does not sit between two elements ` +
      `(ink before: ${inkBefore}, ink after: ${inkAfter}).\n` +
      '  Refusing to guess a crop.',
  )
  process.exit(1)
}

if (markRight > art.info.width * MAX_MARK_FRACTION) {
  console.error(
    `The "mark" would be ${((markRight / art.info.width) * 100).toFixed(0)}% of the ` +
      'lockup width, which means the gap was not found.\n' +
      '  Refusing to guess a crop.',
  )
  process.exit(1)
}

console.log(
  `gap     : ${gap.length}px at x=${gap.start}..${gap.start + gap.length - 1} ` +
    `(ink before ${inkBefore}, after ${inkAfter}); mark cropped at x=${markRight}`,
)

/*
 * `extract` and `trim` run as TWO pipelines. Chained in one, sharp validates the
 * extract area against the un-trimmed input and rejects a valid region.
 */
const markRegion = await sharp(transparent)
  .extract({ left: 0, top: 0, width: Math.max(1, markRight), height: art.info.height })
  .toBuffer()

// Trim the sides the crop left behind, so the mark is tight against its own edges.
const mark = await sharp(markRegion).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 2 }).toBuffer()

await sharp(mark).png({ compressionLevel: 9 }).toFile(MARK_OUTPUT)

const markMeta = await sharp(mark).metadata()
const markW = markMeta.width ?? 1
const markH = markMeta.height ?? 1

console.log(
  `mark     : ${width}x${height} -> ${markW}x${markH} ` +
    `(ratio ${(markW / markH).toFixed(4)}, wordmark starts at x=${markRight})`,
)

/* -------------------------------------------------------------------------- */
/* The square favicon                                                          */
/* -------------------------------------------------------------------------- */

/*
 * Built from the TRANSPARENT MARK, not from the master. Two defects came from
 * deriving it from the JPEG instead, and both were only visible by measuring the
 * file rather than trusting the code:
 *
 *   - it kept the master's pale background, so 81.5% of the pixels were opaque and
 *     the favicon showed as a tinted square in a tab bar;
 *   - `extend` and `resize` chained in one pipeline produced 512x531 — not a
 *     square. Geometry operations are run as separate awaited steps below, the
 *     same lesson the header pipeline already forced.
 */

// Step 1: pad to a square with transparency, so the mark is optically centred
// rather than stretched. Odd remainders are given to the BOTTOM/RIGHT so the
// artwork does not sit a half-pixel high.
const side = Math.max(markW, markH)
const padX = Math.round((side - markW) / 2)
const padY = Math.round((side - markH) / 2)

const squared = await sharp(mark)
  .extend({
    top: padY,
    bottom: side - markH - padY,
    left: padX,
    right: side - markW - padX,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer()

// Step 2: scale to the size browsers expect, as its own operation.
//
// Written as an 8-bit PALETTE png with an alpha channel. The artwork is one navy
// on transparent, so a palette cuts the file from ~261 KB to a fraction of that —
// and a favicon is fetched by every visitor on every page. `quality: 90` keeps the
// anti-aliased edges of the mark from banding, which is where quantisation would
// otherwise show first.
await sharp(squared)
  .resize(512, 512)
  .png({ compressionLevel: 9, palette: true, quality: 90, effort: 10 })
  .toFile('src/app/icon.png')

console.log(`favicon  : mark ${markW}x${markH} -> ${side}x${side} square -> 512x512`)
console.log(`
Update src/lib/brand.ts if the mark changed:
  width:  ${markW},
  height: ${markH},
  ratio:  ${(markW / markH).toFixed(4)},`)