import { describe, expect, it } from 'vitest'

import {
  countWords,
  deriveArticleContent,
  estimateReadingMinutes,
  htmlToPlainText,
  sanitizeArticleHtml,
} from '@/lib/sanitize'

/**
 * Rich-text sanitisation.
 *
 * These are the tests that matter most in this increment. The editor produces
 * HTML that is stored and later rendered to the public, so the allowlist is a
 * security boundary and each case below is an attack that must not survive.
 *
 * `sanitizeArticleHtml` is also required to be idempotent, because it is
 * applied on write AND on render.
 */

describe('sanitizeArticleHtml — script and event handlers', () => {
  it('removes script tags and their contents', () => {
    const out = sanitizeArticleHtml(
      '<p>Hello</p><script>alert("xss")</script>',
    )
    expect(out).not.toContain('<script')
    expect(out).not.toContain('alert')
    expect(out).toContain('<p>Hello</p>')
  })

  it('removes inline event handlers', () => {
    const out = sanitizeArticleHtml(
      '<p onclick="steal()" onmouseover="x()">Text</p>',
    )
    expect(out).not.toContain('onclick')
    expect(out).not.toContain('onmouseover')
    expect(out).toContain('Text')
  })

  it('removes javascript: URLs', () => {
    const out = sanitizeArticleHtml(
      '<a href="javascript:alert(1)">Click</a>',
    )
    expect(out.toLowerCase()).not.toContain('javascript:')
  })

  it('removes data: URLs in image sources', () => {
    const out = sanitizeArticleHtml(
      '<img src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==" />',
    )
    expect(out.toLowerCase()).not.toContain('data:')
  })

  it('removes iframes and their contents', () => {
    const out = sanitizeArticleHtml(
      '<iframe src="https://evil.example"><p>fallback</p></iframe>',
    )
    expect(out).not.toContain('<iframe')
    expect(out).not.toContain('evil.example')
  })

  it('removes style tags', () => {
    const out = sanitizeArticleHtml('<style>body{display:none}</style><p>x</p>')
    expect(out).not.toContain('<style')
    expect(out).not.toContain('display:none')
  })

  it('removes form controls', () => {
    const out = sanitizeArticleHtml(
      '<form action="/x"><input name="a" /><button>Go</button></form>',
    )
    expect(out.toLowerCase()).not.toContain('<form')
    expect(out.toLowerCase()).not.toContain('<input')
    expect(out.toLowerCase()).not.toContain('<button')
  })

  it('removes svg payloads', () => {
    const out = sanitizeArticleHtml(
      '<svg><use href="#x" /></svg><p>safe</p>',
    )
    expect(out.toLowerCase()).not.toContain('<svg')
  })

  it('removes meta refresh', () => {
    const out = sanitizeArticleHtml('<meta http-equiv="refresh" content="0">')
    expect(out.toLowerCase()).not.toContain('<meta')
  })

  it('neutralises a nested obfuscated script', () => {
    const out = sanitizeArticleHtml(
      '<div><scr<script>ipt>alert(1)</script></div>',
    )
    expect(out.toLowerCase()).not.toContain('<script')
  })
})

describe('sanitizeArticleHtml — preserved content', () => {
  it('keeps headings', () => {
    for (const level of [1, 2, 3, 4, 5, 6]) {
      const out = sanitizeArticleHtml(`<h${level}>Title</h${level}>`)
      expect(out).toContain(`<h${level}>Title</h${level}>`)
    }
  })

  it('keeps inline formatting', () => {
    const out = sanitizeArticleHtml(
      '<p><strong>b</strong><em>i</em><u>u</u><s>s</s></p>',
    )
    expect(out).toContain('<strong>b</strong>')
    expect(out).toContain('<em>i</em>')
    expect(out).toContain('<u>u</u>')
    expect(out).toContain('<s>s</s>')
  })

  it('keeps lists and blockquotes', () => {
    const out = sanitizeArticleHtml(
      '<ul><li>a</li></ul><ol><li>b</li></ol><blockquote><p>q</p></blockquote>',
    )
    expect(out).toContain('<ul>')
    expect(out).toContain('<ol>')
    expect(out).toContain('<blockquote>')
  })

  it('keeps tables', () => {
    const out = sanitizeArticleHtml(
      '<table><thead><tr><th scope="col">H</th></tr></thead><tbody><tr><td colspan="2">C</td></tr></tbody></table>',
    )
    expect(out).toContain('<table>')
    expect(out).toContain('<th')
    expect(out).toContain('colspan="2"')
  })

  it('keeps code and preformatted blocks', () => {
    const out = sanitizeArticleHtml('<pre><code>const a = 1;</code></pre>')
    expect(out).toContain('<pre>')
    expect(out).toContain('const a = 1;')
  })

  it('keeps horizontal rules', () => {
    expect(sanitizeArticleHtml('<hr>')).toContain('<hr')
  })
})

describe('sanitizeArticleHtml — link and image hardening', () => {
  it('adds rel to links', () => {
    const out = sanitizeArticleHtml('<a href="https://example.com">x</a>')
    expect(out).toContain('rel="noopener noreferrer nofollow"')
  })

  it('keeps https and mailto links', () => {
    expect(sanitizeArticleHtml('<a href="https://a.example">x</a>')).toContain(
      'href="https://a.example"',
    )
    expect(sanitizeArticleHtml('<a href="mailto:a@b.com">x</a>')).toContain(
      'mailto:a@b.com',
    )
  })

  it('gives every image an alt attribute', () => {
    const out = sanitizeArticleHtml('<img src="https://a.example/x.png">')
    expect(out).toContain('alt=')
  })

  it('preserves an existing alt', () => {
    const out = sanitizeArticleHtml(
      '<img src="https://a.example/x.png" alt="A chart">',
    )
    expect(out).toContain('alt="A chart"')
  })

  it('removes protocol-relative image sources', () => {
    const out = sanitizeArticleHtml('<img src="//evil.example/x.png">')
    expect(out).not.toContain('evil.example')
  })
})

describe('sanitizeArticleHtml — general behaviour', () => {
  it('returns an empty string for nullish input', () => {
    expect(sanitizeArticleHtml(null)).toBe('')
    expect(sanitizeArticleHtml(undefined)).toBe('')
    expect(sanitizeArticleHtml('')).toBe('')
  })

  it('is idempotent', () => {
    const dirty =
      '<p>Text <strong>bold</strong> <a href="https://a.example">link</a></p>' +
      '<script>alert(1)</script>'
    const once = sanitizeArticleHtml(dirty)
    const twice = sanitizeArticleHtml(once)
    expect(twice).toBe(once)
  })

  it('preserves plain text content exactly', () => {
    const out = sanitizeArticleHtml('<p>Scholarships for nursing students</p>')
    expect(out).toContain('Scholarships for nursing students')
  })
})

describe('htmlToPlainText', () => {
  it('strips all markup', () => {
    const out = htmlToPlainText('<p>Hello <strong>world</strong></p>')
    expect(out).toBe('Hello world')
  })

  it('separates block elements so words do not merge', () => {
    // Without this, "OneTwo" would be a single word and the reading time and
    // search index would both be wrong.
    const out = htmlToPlainText('<p>One</p><p>Two</p>')
    expect(out).not.toContain('OneTwo')
    expect(out.replace(/\s+/g, ' ').trim()).toContain('One')
    expect(out.replace(/\s+/g, ' ').trim()).toContain('Two')
  })

  it('returns an empty string for empty input', () => {
    expect(htmlToPlainText('')).toBe('')
    expect(htmlToPlainText(null)).toBe('')
  })
})

describe('countWords and reading time', () => {
  it('counts whitespace-delimited words', () => {
    expect(countWords('one two three')).toBe(3)
    expect(countWords('')).toBe(0)
    expect(countWords('   ')).toBe(0)
    expect(countWords('single')).toBe(1)
  })

  it('returns zero reading minutes for no content', () => {
    expect(estimateReadingMinutes(0)).toBe(0)
  })

  it('never returns less than one minute for real content', () => {
    expect(estimateReadingMinutes(1)).toBe(1)
    expect(estimateReadingMinutes(10)).toBe(1)
  })

  it('scales with length', () => {
    expect(estimateReadingMinutes(200)).toBe(1)
    expect(estimateReadingMinutes(600)).toBe(3)
    expect(estimateReadingMinutes(1000)).toBe(5)
  })
})

describe('deriveArticleContent', () => {
  it('sanitises and derives every stored field in one pass', () => {
    const result = deriveArticleContent(
      '<p>One two three four five</p><script>alert(1)</script>',
    )

    expect(result.content).not.toContain('<script')
    expect(result.content_plain).toContain('One two three four five')
    expect(result.word_count).toBe(5)
    expect(result.reading_time_minutes).toBe(1)
  })

  it('returns zeros for empty content', () => {
    const result = deriveArticleContent('')
    expect(result.content).toBe('')
    expect(result.word_count).toBe(0)
    expect(result.reading_time_minutes).toBe(0)
  })

  it('yields an empty body when the input was only markup that is stripped', () => {
    // This is why publication is re-checked against the sanitised result: a
    // body of pure script tags must not count as "has content".
    const result = deriveArticleContent('<script>alert(1)</script>')
    expect(result.content.trim()).toBe('')
    expect(result.word_count).toBe(0)
  })
})