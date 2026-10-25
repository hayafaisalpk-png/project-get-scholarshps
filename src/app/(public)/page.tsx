import Image from 'next/image'
import { Award, GraduationCap, MapPin, Search, TrendingUp } from 'lucide-react'
import Link from 'next/link'

import { Container, Section, SectionHeading } from '@/components/layout/container'
import { ButtonLink } from '@/components/ui/button'
import { ArticleCard } from '@/features/articles/components/article-card'
import { listPublishedArticles } from '@/features/articles/queries'
import { ScholarshipRow } from '@/features/scholarships/components/scholarship-row'
import {
  getClosingSoonScholarships,
  getFeaturedScholarships,
  getRecentScholarships,
} from '@/features/scholarships/queries'
import { getHomepageSections } from '@/lib/homepage'
import {
  getAcademicFields,
  getEducationLevels,
  getLocations,
  getScholarshipCategories,
  getSiteStats,
} from '@/lib/taxonomy'

/**
 * Homepage.
 *
 * Assembled from `homepage_sections`, so editors control which blocks appear,
 * their order, headings and item limits without a redeploy.
 *
 * Composition follows the measured reference (docs/REFERENCE_ANALYSIS.md):
 *   1. Tinted hero, gradient headline, one dominant search affordance.
 *   2. A four-up statistics band.
 *   3. Scholarship **row** cards, stacked — the reference's listing anatomy.
 *   4. A single browse block expressed as a field of pill chips, rather than
 *      four separate card grids.
 *   5. Recently added, FAQ, and featured articles.
 *
 * Two rules hold throughout:
 *
 *   1. Every number is a real aggregate from the database.
 *   2. A block with no content is omitted rather than rendered as an empty
 *      shell. The genuine "nothing here yet" case is handled once, in the hero.
 */

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const sections = await getHomepageSections()
  const byKey = new Map(sections.map((s) => [s.key, s]))

  const [stats, featured, closingSoon, recent, levels, fields, locations, categories, articleResult] =
    await Promise.all([
      getSiteStats(),
      getFeaturedScholarships(byKey.get('featured')?.config.limit ?? 6),
      getClosingSoonScholarships(byKey.get('deadlines')?.config.limit ?? 6),
      getRecentScholarships(byKey.get('recent')?.config.limit ?? 8),
      getEducationLevels(),
      getAcademicFields(),
      getLocations(),
      getScholarshipCategories(),
      listPublishedArticles({ page: 1 }),
    ])

  const hero = byKey.get('hero')
  const isEmpty = stats.totalScholarships === 0
  const articles = articleResult.ok
    ? articleResult.data.items.slice(0, 3)
    : []

  // Taxonomy landing pages intentionally return 404 when they have no
  // published scholarships. Do not render links to those thin pages while the
  // catalogue is empty; otherwise the homepage creates dead-end navigation.
  const browseGroups = isEmpty
    ? []
    : [
    {
      key: 'by-level',
      heading: byKey.get('by-level')?.heading ?? 'By education level',
      items: levels.map((l) => ({
        name: l.name,
        href: `/scholarships/education-level/${l.slug}`,
      })),
    },
    {
      key: 'by-field',
      heading: byKey.get('by-field')?.heading ?? 'By field of study',
      items: fields.map((f) => ({
        name: f.name,
        href: `/scholarships/field/${f.slug}`,
      })),
    },
    {
      key: 'by-category',
      heading: byKey.get('by-category')?.heading ?? 'By type',
      items: categories.map((c) => ({
        name: c.name,
        href: `/scholarships/category/${c.slug}`,
      })),
    },
    {
      key: 'by-location',
      heading: byKey.get('by-location')?.heading ?? 'By location',
      items: locations.slice(0, 12).map((l) => ({
        name: l.name,
        href: `/scholarships/location/${l.slug}`,
      })),
    },
      ].filter((group) => group.items.length > 0)

  return (
    <>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden p-0">
        <div className="relative min-h-[560px] w-full sm:min-h-[580px] lg:min-h-[600px]">
          <Image
            src="/hero-image.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/35 to-black/60" />
          <div className="absolute inset-0 flex items-center justify-center px-4 py-12 sm:py-20">
            <div className="mx-auto w-full max-w-3xl text-center">
              <h1 className="text-[2.25rem] font-extrabold leading-[1.15] text-white drop-shadow-sm sm:text-5xl lg:text-[3.9375rem]">
                {hero?.heading ?? 'Find scholarships that actually fit you'}
              </h1>

              {hero?.subheading ? (
                <p className="mx-auto mt-5 max-w-2xl text-[1.0125rem] leading-relaxed text-white/90">
                  {hero.subheading}
                </p>
              ) : null}

              <form action="/scholarships" method="get" className="mt-9">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <label htmlFor="hero-search" className="sr-only-focusable">
                        Search scholarships by keyword or sponsor
                      </label>
                      <Search
                        className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400"
                        aria-hidden="true"
                      />
                      <input
                        id="hero-search"
                        type="search"
                        name="q"
                        placeholder="Search by keyword, sponsor or subject"
                        className="h-16 w-full rounded-md border border-ink-200 bg-white p-4 pl-12 text-base text-ink-900 placeholder:text-ink-400 focus:border-brand-500"
                      />
                    </div>
                    <ButtonLink
                      href="/scholarships"
                      size="lg"
                      className="h-16"
                    >
                      Search scholarships
                    </ButtonLink>
                  </div>
              </form>

              {isEmpty ? (
                <div className="mx-auto mt-8 max-w-xl rounded-xl bg-white p-6 text-left ring-1 ring-ink-200">
                  <h2 className="text-base font-semibold text-ink-900">
                    Our scholarship database is being prepared
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">
                    We publish a scholarship only after an editor has confirmed the
                    award amount, deadline and official application link with the
                    provider. We would rather show you nothing than show you
                    something wrong. Listings appear here as they are verified.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------- Stats */}
      {stats.totalScholarships > 0 ? (
        <Section className="py-10 sm:py-12">
          <Container>
            <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-4">
              <Stat
                icon={<Award className="h-10 w-10" aria-hidden="true" />}
                value={stats.totalScholarships.toLocaleString('en-US')}
                label="Scholarships listed"
              />
              <Stat
                icon={<TrendingUp className="h-10 w-10" aria-hidden="true" />}
                value={stats.openScholarships.toLocaleString('en-US')}
                label="Applications still open"
              />
              <Stat
                icon={<GraduationCap className="h-10 w-10" aria-hidden="true" />}
                value={stats.educationLevels.toLocaleString('en-US')}
                label="Education levels"
              />
              <Stat
                icon={<MapPin className="h-10 w-10" aria-hidden="true" />}
                value={stats.locations.toLocaleString('en-US')}
                label="Locations covered"
              />
            </dl>
          </Container>
        </Section>
      ) : null}

      {/* ------------------------------------------------------------ Featured */}
      {featured.length > 0 ? (
        <Section>
          <Container>
            <SectionHeading
              title={byKey.get('featured')?.heading ?? 'Featured scholarships'}
              description={byKey.get('featured')?.subheading}
              action={
                <Link
                  href="/scholarships"
                  className="text-sm font-semibold text-brand-700 hover:underline underline-offset-4"
                >
                  View all
                  <span aria-hidden="true"> &rarr;</span>
                </Link>
              }
            />
            <div className="space-y-4">
              {featured.map((s) => (
                <ScholarshipRow key={s.id} scholarship={s} />
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      {/* -------------------------------------------------------- Closing soon */}
      {closingSoon.length > 0 ? (
        <Section className="bg-ink-50">
          <Container>
            <div className="space-y-4">
              {closingSoon.map((s) => (
                <ScholarshipRow key={s.id} scholarship={s} />
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      {/* ------------------------------------------------------------- Browse */}
      {browseGroups.length > 0 ? (
        <Section>
          <Container>
            <div className="pl-2.5">
              <SectionHeading title="Explore scholarships" />
            </div>

            <div className="grid gap-x-8 gap-y-0 sm:grid-cols-2 lg:grid-cols-4">
              {browseGroups.map((group) => (
                <div key={group.key} className="flex flex-col bg-white px-2 py-2">
                  <h3 className={`mb-2.5 min-h-10 border-b border-brand-500 text-sm font-bold leading-5 tracking-wide text-ink-900 uppercase ${group.key === 'by-level' || group.key === 'by-field' || group.key === 'by-category' || group.key === 'by-location' ? 'pl-2.5' : ''}`}>
                    {group.heading}
                  </h3>
                  <ul className="mt-1 space-y-0">
                    {group.items.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className="block rounded-sm px-2 py-1 text-sm font-medium text-ink-700 transition-colors duration-200 hover:bg-brand-50 hover:text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
                        >
                          {item.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      {/* --------------------------------------------------------- Recently added */}
      {recent.length > 0 ? (
        <Section className="bg-ink-50">
          <Container>
            <SectionHeading
              title={byKey.get('recent')?.heading ?? 'Recently added'}
              description={byKey.get('recent')?.subheading}
            />
            <div className="space-y-4">
              {recent.map((s) => (
                <ScholarshipRow key={s.id} scholarship={s} />
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      {/* ------------------------------------------------------------------- FAQ */}
      <FaqSection />

      {/* ------------------------------------------------------ Feature articles */}
      {articles.length > 0 ? (
        <Section className="bg-ink-50">
          <Container>
            <SectionHeading
              title="Feature articles"
              description="Practical guidance for finding and applying for scholarships."
              action={
                <Link
                  href="/articles"
                  className="text-sm font-semibold text-brand-700 hover:underline underline-offset-4"
                >
                  View all
                  <span aria-hidden="true"> &rarr;</span>
                </Link>
              }
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

    </>
  )
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode
  value: string
  label: string
}) {
  return (
    <div className="text-center">
      <span
        aria-hidden="true"
        className="mx-auto mb-3 inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-600"
      >
        {icon}
      </span>
      <dd className="text-3xl font-extrabold tracking-tight text-ink-900">{value}</dd>
      <dt className="mt-1 text-sm text-ink-600">{label}</dt>
    </div>
  )
}

/**
 * Frequently asked questions.
 *
 * Wrapped in `<details>` elements, which are keyboard operable and work without
 * JavaScript — a better choice here than a custom accordion that needs state.
 */
function FaqSection() {
  const faqs = [
    {
      q: 'Are the scholarships on this site real?',
      a: 'Yes. Each listing is entered by an editor who has checked the award amount, deadline and application link against the official provider page. The source we checked and the date we last reviewed it are shown on every scholarship page.',
    },
    {
      q: 'Does GetScholarship charge a fee to apply?',
      a: 'We never charge to search or to apply. Where a scholarship has its own application fee, that is stated on the listing so you are not surprised.',
    },
    {
      q: 'Why is a scholarship marked as closed?',
      a: 'Its deadline has passed. We keep the page so the information stays available, and so we can point you to similar opportunities that are still open.',
    },
    {
      q: 'How often is the information checked?',
      a: 'Scholarships nearing their deadline are reviewed first. The date each listing was last reviewed appears on its page, and you can report anything that looks wrong.',
    },
  ]

  return (
    <Section>
      <Container>
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            title="Frequently asked questions"
            description="Common questions from students."
          />

          <div className="divide-y divide-ink-200 rounded-xl bg-white ring-1 ring-ink-200">
            {faqs.map((faq) => (
              <details key={faq.q} className="group px-5 py-4">
                <summary className="cursor-pointer list-none font-semibold text-ink-900 marker:hidden">
                  <span className="flex items-start justify-between gap-4">
                    {faq.q}
                    <span
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-ink-400 transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-ink-600">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  )
}
