import { OG_SIZE, renderOgCard } from '@/lib/og-image'
import { getScholarshipBySlug } from '@/features/scholarships/queries'
import { formatAwardAmount, formatDateShort } from '@/lib/format'

/**
 * Social card for a scholarship.
 *
 * A route-level `opengraph-image.tsx` is the file convention: Next.js wires the
 * generated URL into the page's metadata automatically, so there is no
 * hand-maintained `openGraph.images` entry that could drift from the card.
 *
 * Values come from the record, never invented: an award with no stated amount
 * renders "Amount not specified" (the same honest wording the page uses) rather
 * than a fabricated figure.
 *
 * If the slug does not resolve to a publicly visible scholarship, a neutral card
 * is returned. `notFound()` is deliberately NOT used: a crawler asking for an
 * image of an unpublished record should get an image, not a 404 that could be
 * read as the page existing at all.
 */
export const alt = 'GetScholarship scholarship'

export const size = OG_SIZE
export const contentType = 'image/png'

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const scholarship = await getScholarshipBySlug(slug)

  if (!scholarship) {
    return renderOgCard({
      eyebrow: 'Scholarship',
      title: 'Scholarship details',
      subtitle: 'This record is not available.',
    })
  }

  const amount = formatAwardAmount(
    scholarship.award_amount_min_cents,
    scholarship.award_amount_max_cents,
    scholarship.award_amount_text,
    scholarship.award_currency,
  )

  // A deadline that has passed is stated as closed, matching the page.
  const deadline = scholarship.deadline
    ? formatDateShort(scholarship.deadline)
    : null
  const closed =
    !scholarship.is_rolling &&
    scholarship.deadline !== null &&
    new Date(scholarship.deadline) < new Date()

  return renderOgCard({
    eyebrow: closed ? 'Closed scholarship' : 'Scholarship',
    title: scholarship.title,
    subtitle: scholarship.sponsor_name,
    meta: [
      amount,
      deadline ? `Deadline ${deadline}` : 'Rolling deadline',
    ].join('  ·  '),
  })
}