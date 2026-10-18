/**
 * Brand.
 *
 * One module so the header, the footer and the structured data cannot disagree about
 * which file is the mark, how large it may be, or how the name is set.
 *
 * WHAT THE SITE RENDERS
 *
 *     [mark] GetScholarship
 *
 * Only the cap-and-scroll illustration is an image. The name is LIVE TEXT, which is
 * why the lockup as a single bitmap was dropped: baked-in text is not selectable,
 * not translatable, not readable by a screen reader as words, and cannot be restyled
 * — and the brand needs two weights in the name anyway, with "Get" regular and
 * "Scholarship" bold.
 *
 * THE SOURCING ASSET
 *
 * The operator-supplied master is a 527x114 JPEG: the mark beside the wordmark, on a
 * very pale blue-grey background. It is never modified and never served directly. A
 * JPEG cannot carry transparency, so rendering the master into the chrome would draw
 * an opaque rectangle that reads as a box on any surface that is not the same tint.
 *
 * The canonical location is `logo-getscholarship.jpg` in the project root; the
 * byte-identical provenance copy at `public/brand/logo-getscholarship.jpg` is
 * accepted as an equally valid master. The root file was removed during this work,
 * so the two are currently interchangeable — see `scripts/generate-brand-assets.mjs`.
 *
 * Artefacts DERIVED from it:
 *
 *   - `public/brand/logo-getscholarship.jpg` — a byte-for-byte copy of the master,
 *     kept for provenance. Never rendered.
 *   - `public/brand/getscholarship-mark.png` — the mark alone: background removed,
 *     margin trimmed, and the wordmark cropped off. What the site renders, and what
 *     `Organization.logo` points at.
 *   - `src/app/icon.png` — the mark squared and padded, for the favicon.
 *
 * Regenerate with `npm run brand:assets` after replacing the master, then clear
 * `.next/cache/images` — Next's optimizer caches derivatives by URL and would keep
 * serving the previous artwork. Nothing here is redrawn, recoloured or invented.
 */

/** The mark. Trimmed, transparent, 120x101 (ratio 1.1881). */
export const BRAND_MARK = {
  src: '/brand/getscholarship-mark.png',
  /** Intrinsic pixels of the file above. */
  width: 120,
  height: 101,
  /** The file's own aspect ratio, to 4 decimal places. */
  ratio: 1.1881,
} as const

/**
 * The name, split for typography.
 *
 * "Get" is set in the regular weight and "Scholarship" in the bold one, which is how
 * the supplied wordmark is drawn. This is brand typography rather than CMS content,
 * so it is declared here — but it MUST track the `site.name` setting, which is what
 * the rest of the site (footer copyright, structured data, page titles) uses. A unit
 * test asserts the two agree, so an editor changing the name in the CMS cannot leave
 * the header quietly disagreeing with the footer.
 */
export const BRAND_WORDMARK = {
  lead: 'Get',
  bold: 'Scholarship',
  /** Domain suffix rendered beside the wordmark in a smaller size. */
  suffix: '.online',
} as const

/** The name as one string, for accessible names and metadata. */
export const BRAND_WORDMARK_TEXT = `${BRAND_WORDMARK.lead}${BRAND_WORDMARK.bold}`

/**
 * The size the name was set at before the brand was enlarged, in px.
 *
 * Kept only so the 1.3x multiplier below is checkable rather than asserted. These
 * correspond to Tailwind's `text-lg` (18px) and `text-base` (16px).
 */
const PREVIOUS_NAME_SIZE_PX = {
  header: 18,
  footer: 16,
  admin: 16,
} as const

/** How much larger the name is than it was. */
export const BRAND_NAME_SCALE = 1.243125

/**
 * Name size per placement, in px.
 *
 * 18 -> 23.4 in the header, 16 -> 20.8 in the footer and the admin sidebar. Exported
 * in px because that is what a test can compare against a measured `font-size`; the
 * CSS itself uses the `--text-brand-name-*` rem tokens in `globals.css`, which a unit
 * test asserts resolve to the same numbers. The two halves have to agree or the name
 * renders at a different size from the one documented here.
 */
export const BRAND_NAME_SIZE_PX = {
  header: PREVIOUS_NAME_SIZE_PX.header * BRAND_NAME_SCALE,
  footer: PREVIOUS_NAME_SIZE_PX.footer * BRAND_NAME_SCALE,
  admin: PREVIOUS_NAME_SIZE_PX.admin * BRAND_NAME_SCALE,
} as const

/** The `--text-brand-name-*` token each placement uses. */
export const BRAND_NAME_SIZE_TOKEN = {
  header: 'text-brand-name-md',
  footer: 'text-brand-name-sm',
  admin: 'text-brand-name-sm',
} as const

/**
 * Height the mark is allowed to occupy.
 *
 * These are the boxes the placeholder mark occupied before the real artwork existed —
 * `h-8` in the header and `h-7` in the footer — so introducing it does not change the
 * height of the bar or shift the rest of the chrome. The header is `h-16`; a 32px
 * mark inside a 64px bar keeps the original vertical rhythm.
 */
export const BRAND_MARK_HEADER_HEIGHT_PX = 32
export const BRAND_MARK_FOOTER_HEIGHT_PX = 28

/**
 * Width ceiling for the header mark: 48px.
 *
 * At 32px tall the mark wants ~38px, so the ceiling does not bind on any normal
 * viewport and it renders at its natural width. It exists for a future, wider mark:
 * a fixed height with no width bound can push the navigation off a small screen.
 *
 * It is paired with `object-contain` rather than trusted on its own: clamping the
 * width of an image whose height is fixed would otherwise distort it.
 */
export const BRAND_MARK_MAX_WIDTH_PX = 48

/**
 * Rendered width at the given height, rounded.
 *
 * Exported so the intended geometry is a tested value rather than something a
 * reviewer has to infer from a CSS class: if the master is ever replaced with a
 * differently-proportioned file, the header width follows it and this is where that
 * shows up.
 */
export function brandMarkWidth(heightPx: number): number {
  return Math.round(heightPx * BRAND_MARK.ratio)
}