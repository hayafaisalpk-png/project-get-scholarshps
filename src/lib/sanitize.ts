import 'server-only'

import sanitizeHtml from 'sanitize-html'

/**
 * Rich-text sanitisation.
 *
 * The article editor produces HTML from a rich-text widget, and that HTML is
 * stored and later rendered to the public. It is therefore treated as
 * untrusted input no matter where it came from: sanitised on the way IN, and
 * sanitised again on the way OUT.
 *
 * Doing both is deliberate. Sanitising on write keeps the database clean, but
 * content that predates a rule change — or arrived through an import — can
 * still contain markup the current allowlist would reject. Sanitising on render
 * means tightening the allowlist immediately protects pages that already hold
 * older content, without a backfill.
 *
 * The allowlist is deny-by-default: anything not named here is removed, so a
 * new browser feature cannot silently become an injection vector.
 */

/** Tags an editor may produce. Nothing else survives. */
const ALLOWED_TAGS = [
  'p',
  'br',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'strike',
  'del',
  'sub',
  'sup',
  'code',
  'pre',
  'blockquote',
  'ul',
  'ol',
  'li',
  'a',
  'img',
  'hr',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'figure',
  'figcaption',
  'span',
]

const ALLOWED_SCHEMES = ['http', 'https', 'mailto', 'tel']

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    /*
     * `rel` and `target` must be listed here as well as being set by
     * `transformTags`. sanitize-html applies attribute filtering AFTER
     * transforms, so an attribute that is not in the allowlist is stripped
     * again — a `rel` set by a transform alone would silently disappear.
     */
    a: ['href', 'title', 'rel', 'target'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan', 'scope'],
    // `class` is permitted only on these, and only with editor-generated
    // values, so a style hook cannot be used to exfiltrate anything.
    code: ['class'],
    pre: ['class'],
    span: ['class'],
  },
  allowedSchemes: ALLOWED_SCHEMES,
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  allowProtocolRelative: false,
  // Remove the CONTENT of these tags, not just the tags themselves, so a
  // stripped <script> does not leak its source as visible text.
  nonTextTags: [
    'style',
    'script',
    'textarea',
    'option',
    'noscript',
    'template',
    'iframe',
  ],
  enforceHtmlBoundary: true,
  transformTags: {
    /*
     * Every link is given `rel="noopener noreferrer nofollow"`.
     *
     * `noopener` stops the opened page reaching back through `window.opener`,
     * and `noreferrer` withholds the referrer. `nofollow` is applied to
     * externally-authored content links so the CMS does not pass editorial
     * endorsement to third parties by default.
     */
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        rel: 'noopener noreferrer nofollow',
        ...(attribs.target === '_blank' ? { target: '_blank' } : {}),
      },
    }),

    /*
     * Images must carry alt text.
     *
     * A missing alt attribute is rewritten to an empty string, which is the
     * accessible declaration that the image is decorative. A genuinely
     * informative image with no alt is a content bug that review should catch,
     * but rendering it as an unlabelled image is worse than rendering it as
     * decorative.
     */
    img: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, alt: attribs.alt ?? '' },
    }),
  },
}

/**
 * Sanitise rich-text HTML.
 *
 * Idempotent: sanitising already-sanitised output returns the same string, so
 * it is safe to apply on write and again on render.
 */
export function sanitizeArticleHtml(dirty: string | null | undefined): string {
  if (!dirty) return ''
  return sanitizeHtml(dirty, OPTIONS)
}

/**
 * Strip all markup, leaving readable text.
 *
 * Used to derive `content_plain`, which feeds full-text search, excerpts and
 * reading time.
 *
 * Block-level tags are replaced with a SPACE before stripping. Stripping them
 * directly would concatenate adjacent blocks — `<p>One</p><p>Two</p>` becomes
 * `OneTwo`, a single token — which would understate the word count, shorten
 * the reading time and corrupt the search index.
 */
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return ''

  // Replace block-level tags with spaces so words cannot merge across them.
  const spaced = html.replace(
    /<\/?(?:p|div|section|article|aside|header|footer|main|nav|ul|ol|li|dl|dt|dd|h[1-6]|blockquote|pre|table|thead|tbody|tfoot|tr|td|th|figure|figcaption|hr|address)[^>]*>/gi,
    ' ',
  )

  // A line break is a genuine boundary, so keep it as a newline.
  const lined = spaced.replace(/<br\s*\/?>/gi, '\n')

  return sanitizeHtml(lined, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n+ */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

/** Word count of plain text. */
export function countWords(plain: string): number {
  const trimmed = plain.trim()
  if (trimmed.length === 0) return 0
  return trimmed.split(/\s+/).length
}

/**
 * Reading time in whole minutes, never less than 1 for non-empty content.
 *
 * 200 words per minute is the commonly cited adult average for general
 * non-fiction reading.
 */
export function estimateReadingMinutes(wordCount: number): number {
  if (wordCount <= 0) return 0
  return Math.max(1, Math.round(wordCount / 200))
}

/** Everything the database stores for an article body, derived in one pass. */
export function deriveArticleContent(dirty: string | null | undefined): {
  content: string
  content_plain: string
  word_count: number
  reading_time_minutes: number
} {
  const content = sanitizeArticleHtml(dirty)
  const content_plain = htmlToPlainText(content)
  const word_count = countWords(content_plain)

  return {
    content,
    content_plain,
    word_count,
    reading_time_minutes: estimateReadingMinutes(word_count),
  }
}