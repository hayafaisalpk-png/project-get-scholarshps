import Image from 'next/image'

import {
  BRAND_MARK,
  BRAND_MARK_FOOTER_HEIGHT_PX,
  BRAND_MARK_HEADER_HEIGHT_PX,
  BRAND_MARK_MAX_WIDTH_PX,
  BRAND_NAME_SIZE_TOKEN,
  BRAND_WORDMARK,
} from '@/lib/brand'

/**
 * The brand lockup: [mark] GetScholarship
 *
 * A Server Component — there is nothing interactive in it.
 *
 * WHY THE NAME IS TEXT AND NOT PICTURE
 *
 * The supplied logo is a single bitmap containing both the illustration and the
 * wordmark. Rendering that bitmap would make the site's name unselectable,
 * untranslatable, invisible to a screen reader as words, and impossible to restyle —
 * and the name needs two weights anyway, with "Get" regular and "Scholarship" bold.
 * So only the illustration is an image and the name is marked up as text.
 *
 * The consequence for accessibility is the important part: because the visible text
 * IS the name, the image's `alt` is empty. A `alt="GetScholarship"` here would make
 * the home link announce "GetScholarship GetScholarship" — once from the image and
 * once from the text beside it.
 *
 * SIZE AND ALIGNMENT
 *
 * The `variant` decides BOTH the mark's height and the name's size, so a caller
 * cannot pass a size that disagrees with the geometry. The name size comes from the
 * `--text-brand-name-*` tokens, which are `rem` so the name still scales with the
 * reader's browser font-size preference.
 *
 * The mark is sized in pixels rather than a Tailwind height class so the geometry
 * documented in `src/lib/brand.ts` and the geometry actually rendered cannot drift
 * apart. `height` binds and `width: auto` follows from the file's own ratio, so the
 * illustration is never stretched; `object-contain` makes the width ceiling safe, and
 * `flex-none` stops the mark being squeezed when the bar runs out of room.
 */
export function BrandLockup({
  variant,
  className,
}: {
  /** Which documented geometry to occupy: header or footer. */
  variant: 'header' | 'footer'
  /** Colour and any caller-specific styling. Size is NOT the caller's to choose. */
  className?: string
}) {
  const height = variant === 'header' ? BRAND_MARK_HEADER_HEIGHT_PX : BRAND_MARK_FOOTER_HEIGHT_PX

  return (
    <span className="flex min-w-0 items-center gap-2">
      <Image
        src={BRAND_MARK.src}
        alt=""
        width={BRAND_MARK.width}
        height={BRAND_MARK.height}
        className="flex-none object-contain"
        style={{ height, width: 'auto', maxWidth: BRAND_MARK_MAX_WIDTH_PX }}
      />
      {/*
        The name. Two spans rather than one string so the two halves can carry
        different weights: "Get" in the NORMAL weight and "Scholarship" in a bold
        one, which is how the supplied wordmark is drawn. `font-extrabold` rather
        than `font-bold` because at this size the heavier cut matches the artwork's
        own chunky strokes, and the 400-vs-800 gap is what makes the split legible.
      */}
      <span className={`truncate font-normal ${BRAND_NAME_SIZE_TOKEN[variant]} ${className ?? ''}`}>
        {BRAND_WORDMARK.lead}
        <span className="font-extrabold">{BRAND_WORDMARK.bold}</span>
        <span className="text-sm font-normal">{BRAND_WORDMARK.suffix}</span>
      </span>
    </span>
  )
}