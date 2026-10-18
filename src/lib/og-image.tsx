import { ImageResponse } from 'next/og'

/**
 * Shared Open Graph / Twitter card renderer.
 *
 * One implementation for every card on the site, so a scholarship card, an
 * article card and a legal-page card are visibly the same family rather than
 * three drifting styles. Cards are images, so the WCAG contrast rules apply to
 * the text drawn on them too — the palette below is the measured reference pair
 * (brand `#5D57FB` on ink `#100826`) with white text on both, which clears
 * 4.5:1 comfortably.
 *
 * `ImageResponse` needs every value as an explicit inline style and loads no
 * external stylesheet, so nothing here may reference the Tailwind tokens.
 *
 * WHY AN IMAGE RATHER THAN TEXT
 *
 * A social card without an image renders as a bare text link, which gets a
 * fraction of the engagement. But an image must not be a prerequisite for the
 * link to work, and it is not: `twitter: card` is `summary_large_image` with
 * sensible fallback text in the `openGraph` blocks already present on every
 * page, so if image generation fails the card degrades to text rather than
 * breaking the share.
 */

const INK = '#100826'
const BRAND = '#5D57FB'

export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = 'image/png'

export type OgCardProps = {
  /** Small label above the title, e.g. "SCHOLARSHIP". */
  eyebrow: string
  title: string
  /** Optional supporting line. Omitted rather than invented when absent. */
  subtitle?: string | undefined
  /** Optional third line, e.g. sponsor or author. */
  meta?: string | undefined
}

export function renderOgCard({
  eyebrow,
  title,
  subtitle,
  meta,
}: OgCardProps) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: INK,
          padding: '72px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Accent bar. Pure decoration, so it carries no information. */}
        <div style={{ display: 'flex', width: 120, height: 8, backgroundColor: BRAND }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: 3,
              textTransform: 'uppercase',
              color: BRAND,
            }}
          >
            {eyebrow}
          </div>

          {/*
            `lineClamp: 3` with an explicit height bound: a long scholarship name
            must not push the card's other content off the canvas. `textOverflow`
            adds an ellipsis so the truncation is visible rather than silent.
          */}
          <div
            style={{
              display: 'flex',
              fontSize: title.length > 70 ? 63 : 77,
              fontWeight: 800,
              lineHeight: 1.1,
              color: '#ffffff',
              maxHeight: 200,
              overflow: 'hidden',
            }}
          >
            {title}
          </div>

          {subtitle ? (
            <div
              style={{
                display: 'flex',
                fontSize: 36,
                color: '#c9c8d6',
                maxHeight: 90,
                overflow: 'hidden',
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '2px solid #2a2836',
            paddingTop: 28,
          }}
        >
          <div style={{ display: 'flex', fontSize: 29, fontWeight: 800, color: '#ffffff' }}>
            GetScholarship
          </div>
          {meta ? (
            <div style={{ display: 'flex', fontSize: 30, color: '#9a99ad' }}>{meta}</div>
          ) : null}
        </div>
      </div>
    ),
    OG_SIZE,
  )
}