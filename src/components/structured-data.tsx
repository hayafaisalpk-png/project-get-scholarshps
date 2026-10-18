import { type JsonLdDocument, serializeJsonLd } from '@/lib/structured-data'

/**
 * Renders a JSON-LD document.
 *
 * A Server Component. It is not interactive, so `'use client'` would only add
 * bundle weight — the markup it produces is static apart from the data.
 *
 * The `<` escaping happens in `serializeJsonLd`, not here, so it applies to
 * every caller rather than depending on each page remembering to do it. See the
 * security note in `src/lib/structured-data.ts`: article titles and author names
 * are editor-controlled, and an unescaped `</script>` inside this element would
 * be an XSS vector.
 *
 * `null` is accepted and renders nothing, which is how a builder that declines
 * to describe something stays invisible at the call site:
 *
 * ```tsx
 * <JsonLd data={graph(webPageLd({ ... }), breadcrumbLd(trail))} />
 * ```
 */
export function JsonLd({ data }: { data: JsonLdDocument | null }) {
  if (!data) return null

  return (
    <script
      type="application/ld+json"
      // Serialised and escaped above. React escapes string children, but that
      // would escape the JSON's own quotes and produce invalid JSON-LD.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  )
}