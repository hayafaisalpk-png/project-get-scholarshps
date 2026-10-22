import { describe, expect, it } from 'vitest'

import { BRAND_MARK } from '@/lib/brand'

import {
  articleLd,
  breadcrumbLd,
  collectionPageLd,
  faqLd,
  graph,
  itemListLd,
  personLd,
  serializeJsonLd,
  siteGraph,
  webPageLd,
} from '@/lib/structured-data'

/**
 * Schema.org JSON-LD builders.
 *
 * Two things are being tested here, and the second matters more than the first.
 *
 * The obvious one is shape: every node carries `@context`-compatible types and
 * absolute URLs, and every `position` is 1-based.
 *
 * The important one is RESTRAINT. A builder that always returns something looks
 * fine until you notice it describing pages that have asked not to be indexed, or
 * an article with no author, or a breadcrumb trail of one. `AGENTS.md` §2.5 calls
 * a control that does nothing a fake feature; structured data that claims
 * something untrue is the same defect wearing a search-engine costume. So
 * several tests below assert that a builder returns `null`.
 */

const ORIGIN = 'https://getscholarship.test'

function parse(doc: Parameters<typeof serializeJsonLd>[0]) {
  return JSON.parse(serializeJsonLd(doc))
}

/**
 * Node accessor.
 *
 * `JsonLdNode` is deliberately `Record<string, unknown>`, and this project runs
 * `noUncheckedIndexedAccess`, so a bare `graph[0].logo` is both `unknown` and
 * possibly `undefined`. These two helpers keep the assertions readable instead
 * of scattering casts through every expectation.
 */
function nodes(doc: Parameters<typeof serializeJsonLd>[0]): Record<string, unknown>[] {
  return parse(doc)['@graph'] as Record<string, unknown>[]
}

function at(
  doc: Parameters<typeof serializeJsonLd>[0],
  index: number,
): Record<string, unknown> {
  const found = nodes(doc)[index]
  if (!found) throw new Error(`graph has no node at index ${index}`)
  return found
}

/** Read a property that is itself an object, e.g. `isPartOf` or `author`. */
function object(node: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = node[key]
  if (typeof value !== 'object' || value === null) {
    throw new Error(`${key} is not an object: ${JSON.stringify(value)}`)
  }
  return value as Record<string, unknown>
}

/** Read a list property as an array of nodes. */
function list(node: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const value = node[key]
  if (!Array.isArray(value)) throw new Error(`${key} is not an array`)
  return value as Record<string, unknown>[]
}

describe('serializeJsonLd', () => {
  it('produces parseable JSON with the schema.org context', () => {
    const doc = graph({ '@type': 'WebPage', name: 'Test' })
    expect(doc).not.toBeNull()

    const parsed = parse(doc!)
    expect(parsed['@context']).toBe('https://schema.org')
    expect(parsed['@graph']).toHaveLength(1)
  })

  /**
   * THE SECURITY TEST.
   *
   * Values here are editor-controlled — article titles, author names, alt text.
   * `JSON.stringify` does not escape `<`, so a title of `</script><script>…`
   * would close this script element early and execute. The escaping below is what
   * prevents that, and `JSON.parse` must still return the original string.
   */
  it('escapes < so an editor-controlled value cannot break out of the script tag', () => {
    const hostile = '</script><script>fetch("https://evil.test")</script>'
    const doc = graph({ '@type': 'WebPage', name: hostile })!

    const serialized = serializeJsonLd(doc)

    expect(serialized).not.toContain('</script>')
    expect(serialized).toContain('\\u003c')
    // And the value survives intact for the consumer that parses it.
    expect(parse(doc)['@graph'][0].name).toBe(hostile)
  })

  it('escapes > and & because the block is embedded in HTML, not JSON', () => {
    const doc = graph({ '@type': 'WebPage', name: 'Tom & Jerry > Best' })!
    const serialized = serializeJsonLd(doc)

    expect(serialized).not.toContain('&')
    expect(serialized).not.toContain('>')
    expect(parse(doc)['@graph'][0].name).toBe('Tom & Jerry > Best')
  })
})

describe('graph', () => {
  it('drops null nodes rather than emitting an empty node', () => {
    const doc = graph(
      null,
      { '@type': 'WebPage' },
      undefined,
      { '@type': 'BreadcrumbList' },
    )!
    expect(doc['@graph']).toHaveLength(2)
  })

  it('returns null when every node was declined', () => {
    expect(graph(null, undefined)).toBeNull()
  })
})

describe('siteGraph', () => {
  const base = { name: 'GetScholarship', description: 'Scholarships.' }

  it('emits Organization and WebSite with stable ids', () => {
    const doc = siteGraph(base)!
    const organization = at(doc, 0)
    const website = at(doc, 1)

    expect(organization['@type']).toBe('Organization')
    expect(organization['@id']).toBe(`${ORIGIN}/#organization`)
    expect(website['@type']).toBe('WebSite')
    expect(object(website, 'publisher')['@id']).toBe(organization['@id'])
  })

  /**
   * The logo was deliberately ABSENT while the project had no brand asset: a logo
   * URL that 404s is a fabricated claim about the publisher. The operator-supplied
   * master now exists, so the assertion is inverted — the property must be present,
   * absolute, and carry the intrinsic size.
   *
   * The size is asserted against `BRAND_MARK` rather than a literal: the master is
   * operator-supplied and was legitimately replaced during this work, so a hardcoded
   * pixel count would test only whether the logo had ever been updated.
   * `brand.test.ts` separately asserts that those constants match the file on disk,
   * so the chain is still checked end to end.
   */
  it('emits the logo, now that a real brand asset exists', () => {
    const organization = at(siteGraph(base)!, 0)

    expect(organization.logo).toMatchObject({
      '@type': 'ImageObject',
      url: `${ORIGIN}${BRAND_MARK.src}`,
      width: BRAND_MARK.width,
      height: BRAND_MARK.height,
    })
    expect(organization.image).toBe(`${ORIGIN}${BRAND_MARK.src}`)
  })

  it('never points at the JPEG master, which cannot be transparent', () => {
    const organization = at(siteGraph(base)!, 0)
    const logo = object(organization, 'logo')
    expect(String(logo.url ?? '')).not.toMatch(/\.jpg$/)
  })

  it('includes only real https social URLs, never the empty seeded defaults', () => {
    const doc = siteGraph({
      ...base,
      socialUrls: ['', 'https://facebook.com/getscholarship', null],
    })!
    expect(at(doc, 0).sameAs).toEqual(['https://facebook.com/getscholarship'])
  })

  it('omits sameAs entirely when nothing usable is configured', () => {
    expect(at(siteGraph({ ...base, socialUrls: [''] })!, 0).sameAs).toBeUndefined()
  })

  it('emits a ContactPoint only when an email exists', () => {
    const withEmail = at(
      siteGraph({ ...base, email: 'hello@getscholarship.online' })!,
      0,
    )
    expect(object(withEmail, 'contactPoint')['@type']).toBe('ContactPoint')

    expect(at(siteGraph(base)!, 0).contactPoint).toBeUndefined()
  })
})

describe('webPageLd', () => {
  const base = { name: 'A page', path: '/scholarships' }

  it('emits a WebPage linked to the site entities', () => {
    const node = webPageLd(base)!
    expect(node['@type']).toBe('WebPage')
    expect(node.url).toBe(`${ORIGIN}/scholarships`)
    expect(object(node, 'isPartOf')['@id']).toBe(`${ORIGIN}/#website`)
  })

  /**
   * The contradiction this prevents: a page asking not to be indexed, while
   * structured data asks a consumer to treat it as notable.
   */
  it('declines to describe a noindex page', () => {
    expect(webPageLd({ ...base, noindex: true })).toBeNull()
  })

  it('drops absent optional properties rather than emitting empty strings', () => {
    const node = webPageLd({ ...base, datePublished: null })!
    expect(node.datePublished).toBeUndefined()
    expect(node.description).toBeUndefined()
  })
})

describe('collectionPageLd', () => {
  const base = { name: 'Merit-based scholarships', path: '/scholarships/category/merit-based' }

  it('emits a CollectionPage that reuses the #webpage id a WebPage would take', () => {
    // Sharing the fragment means a consumer resolving `#webpage` on this URL gets
    // one node whether the page describes itself as a WebPage or a CollectionPage.
    const node = collectionPageLd(base)!
    expect(node['@type']).toBe('CollectionPage')
    expect(node['@id']).toBe(`${ORIGIN}/scholarships/category/merit-based#webpage`)
    expect(node.isPartOf).toEqual({ '@id': `${ORIGIN}/#website` })
  })

  it('declines for a noindex page', () => {
    expect(collectionPageLd({ ...base, noindex: true })).toBeNull()
  })
})

describe('breadcrumbLd', () => {
  const trail = [
    { name: 'Home', path: '/' },
    { name: 'Scholarships', path: '/scholarships' },
    { name: 'A specific award', path: '/scholarships/a-specific-award' },
  ]

  it('emits 1-based positions with absolute item URLs', () => {
    const node = breadcrumbLd(trail)!
    const items = list(node, 'itemListElement')

    expect(items.map((i) => i.position)).toEqual([1, 2, 3])
    expect(items.map((i) => i.item)).toEqual([
      `${ORIGIN}/`,
      `${ORIGIN}/scholarships`,
      `${ORIGIN}/scholarships/a-specific-award`,
    ])
  })

  it('declines for a trail of one, which describes nothing', () => {
    expect(breadcrumbLd([{ name: 'Home', path: '/' }])).toBeNull()
  })

  it('declines for an empty trail', () => {
    expect(breadcrumbLd([])).toBeNull()
  })
})

describe('itemListLd', () => {
  it('emits ordered list items', () => {
    const node = itemListLd({
      name: 'Scholarships',
      path: '/scholarships',
      items: [{ name: 'One', path: '/scholarships/one' }],
    })!

    expect(node['@type']).toBe('ItemList')
    expect(node.numberOfItems).toBe(1)
    expect(list(node, 'itemListElement').map((i) => i.position)).toEqual([1])
  })

  it('declines for an empty list rather than claiming to enumerate something', () => {
    expect(itemListLd({ name: 'Scholarships', path: '/scholarships', items: [] })).toBeNull()
  })
})

describe('personLd', () => {
  it('emits a Person when a name exists', () => {
    const node = personLd({ name: 'Editorial Team', path: '/articles/how-to-apply' })!
    expect(node['@type']).toBe('Person')
    expect(node.name).toBe('Editorial Team')
  })

  it('declines without a name — an empty Person is a false claim', () => {
    expect(personLd({ name: null })).toBeNull()
    expect(personLd({ name: '   ' })).toBeNull()
    expect(personLd({ name: undefined })).toBeNull()
  })
})

describe('articleLd', () => {
  const base = {
    title: 'How to write a scholarship essay',
    path: '/articles/how-to-write-a-scholarship-essay',
    datePublished: '2026-10-01T00:00:00.000Z',
    authorName: 'Editorial Team',
    wordCount: 1200,
  }

  it('emits a BlogPosting pointing at the page node it describes', () => {
    const node = articleLd(base)!
    expect(node['@type']).toBe('BlogPosting')
    expect(object(node, 'mainEntityOfPage')['@id']).toBe(
      `${ORIGIN}/articles/how-to-write-a-scholarship-essay#webpage`,
    )
    expect(object(node, 'author').name).toBe('Editorial Team')
    expect(node.wordCount).toBe(1200)
  })

  it('truncates the headline to the documented 110-character limit', () => {
    const node = articleLd({ ...base, title: 'x'.repeat(400) })!
    expect((node.headline as string).length).toBe(110)
  })

  it('declines for a noindex article', () => {
    expect(articleLd({ ...base, noindex: true })).toBeNull()
  })

  it('omits the author rather than emitting an empty one', () => {
    expect(articleLd({ ...base, authorName: null })!.author).toBeUndefined()
  })

  it('omits wordCount when it is zero or absent', () => {
    expect(articleLd({ ...base, wordCount: 0 })!.wordCount).toBeUndefined()
    expect(articleLd({ ...base, wordCount: null })!.wordCount).toBeUndefined()
  })
})
describe('faqLd', () => {
  const path = '/articles/how-to-write-a-scholarship-essay'

  const faqs = [
    { question: 'How long should my essay be?', answer: 'Five hundred words.' },
    { question: 'Who reads it?', answer: 'The admissions panel.' },
  ]

  it('emits an FAQPage whose mainEntity is a list of Questions', () => {
    const node = faqLd({ faqs, path })!
    expect(node['@type']).toBe('FAQPage')
    expect(node['@id']).toBe(`${ORIGIN}${path}#faq`)
    expect(node.url).toBe(`${ORIGIN}${path}`)

    const questions = list(node, 'mainEntity')
    expect(questions).toHaveLength(2)
    expect(questions[0]!['@type']).toBe('Question')
    expect(questions[0]!.name).toBe('How long should my essay be?')
  })

  it('gives every question an acceptedAnswer of type Answer', () => {
    const node = faqLd({ faqs, path })!
    const answer = object(list(node, 'mainEntity')[0]!, 'acceptedAnswer')
    expect(answer['@type']).toBe('Answer')
    expect(answer.text).toBe('Five hundred words.')
  })

  it('declines when the article has no questions', () => {
    expect(faqLd({ faqs: [], path })).toBeNull()
  })

  it('declines for a noindex article, like every other builder here', () => {
    expect(faqLd({ faqs, path, noindex: true })).toBeNull()
  })

  /**
   * A malformed row in the database must not become an empty Question in the
   * markup. Google treats a `Question` with a blank name as invalid, and an
   * empty answer is a claim the page cannot support.
   */
  it('drops a malformed item rather than emitting an empty Question', () => {
    const node = faqLd({
      faqs: [
        { question: '   ', answer: 'An answer to nothing.' },
        { question: 'Real question?', answer: 'Real answer.' },
      ],
      path,
    })!

    const questions = list(node, 'mainEntity')
    expect(questions).toHaveLength(1)
    expect(questions[0]!.name).toBe('Real question?')
  })

  it('survives serialisation with quotes and angle brackets in the text', () => {
    const hostile = 'Is it "really" <b>free</b> & fast?'
    const node = faqLd({
      faqs: [{ question: hostile, answer: 'Yes — it is.' }],
      path,
    })!

    const doc = graph(node)!
    const serialized = serializeJsonLd(doc)

    expect(serialized).not.toContain('<')
    expect(parse(doc)['@graph'][0].mainEntity[0].name).toBe(hostile)
  })
})
