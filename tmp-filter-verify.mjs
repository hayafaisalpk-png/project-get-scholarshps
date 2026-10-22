import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const results = []
const check = (name, pass, detail = '') =>
  results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)

const browser = await chromium.launch()

/** Unique scholarship titles currently listed. */
const rowTitles = async (p) =>
  p.evaluate(() => {
    const seen = new Set()
    for (const a of document.querySelectorAll('main a[href^="/scholarships/"]')) {
      const t = a.textContent.replace(/^View details for\s*/i, '').trim()
      if (t) seen.add(t)
    }
    return [...seen]
  })

const live = async (p) => {
  const t = await p.locator('[aria-live="polite"]').first().innerText()
  return t.trim()
}

/** Wait until the results summary has settled after a navigation. */
const settle = async (p) => {
  await p.waitForLoadState('networkidle')
  await p.waitForFunction(
    () => !document.querySelector('[aria-live="polite"]')?.textContent?.includes('…'),
    null,
    { timeout: 15000 },
  )
  await p.waitForTimeout(250)
}

/* ---------------------------------------------------------------- WITH JS -- */
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

const hydration = []
page.on('console', (m) => {
  if (/hydrat|did not match/i.test(m.text())) hydration.push(m.text().slice(0, 160))
})

await page.goto(`${BASE}/scholarships`, { waitUntil: 'networkidle' })
await settle(page)

const baseLive = await live(page)
const baseRows = await rowTitles(page)
check('baseline lists the 6 fixtures', baseRows.length === 6, baseLive)

// 1. The redundant button is gone when JS is available
check(
  'no "Apply filters" button when JS is on',
  (await page.getByRole('button', { name: /apply filters/i }).count()) === 0,
)

// 2. CHECKBOX: renewable -> Graduate Research Grant is the only renewable fixture
const renewable = page.getByRole('checkbox', { name: /renewable awards/i })
await Promise.all([page.waitForURL(/renewable=1/, { timeout: 20000 }), renewable.check()])
await settle(page)
check('checkbox click changes the URL with no button press', page.url().includes('renewable=1'), page.url())

const renewRows = await rowTitles(page)
const renewLive = await live(page)
check('checkbox narrowed the result set', renewRows.length === 1, `${baseLive} -> ${renewLive}`)
check(
  'the surviving row is the renewable one',
  renewRows[0]?.includes('Graduate Research Grant'),
  JSON.stringify(renewRows),
)
check('aria-live summary updated', renewLive !== baseLive, renewLive)
check('checkbox stays ticked after the round trip', await renewable.isChecked())

// 3. A second checkbox combines in ONE url
const noFee = page.getByRole('checkbox', { name: /no application fee/i })
await Promise.all([page.waitForURL(/freeApplication=1/, { timeout: 20000 }), noFee.check()])
await settle(page)
check(
  'two checkboxes land in one URL',
  page.url().includes('renewable=1') && page.url().includes('freeApplication=1'),
  page.url(),
)
const bothRows = await rowTitles(page)
check(
  'combined filters are ANDed (no fixture is both)',
  bothRows.length === 0,
  `${renewLive} + no-fee -> ${await live(page)}`,
)

// 4. Unchecking removes it
await Promise.all([
  page.waitForURL((u) => !u.search.includes('freeApplication'), { timeout: 20000 }),
  noFee.uncheck(),
])
await settle(page)
check('unchecking drops the param', !page.url().includes('freeApplication'), page.url())
check('unchecking restores the previous set', (await rowTitles(page)).length === 1)

// 5. RADIO: deadline = this week -> only the fixture with a 4-day deadline
await page.goto(`${BASE}/scholarships`, { waitUntil: 'networkidle' })
await settle(page)
const thisWeek = page.getByRole('radio', { name: /closing this week/i })
await Promise.all([page.waitForURL(/deadline=week/, { timeout: 20000 }), thisWeek.check()])
await settle(page)
const weekRows = await rowTitles(page)
check('deadline radio auto-submits', page.url().includes('deadline=week'), page.url())
check(
  'deadline filter narrows to the imminent fixture',
  weekRows.length === 1 && weekRows[0]?.includes('Deadline This Week'),
  `${await live(page)} | ${JSON.stringify(weekRows)}`,
)
check('radio stays selected', await thisWeek.isChecked())

// 6. LEVEL checkbox updates the url and re-runs the query.
//    The fixtures carry no education-level joins, so 0 is the CORRECT answer
//    here; what is being asserted is that the click re-queried at all.
const undergrad = page.getByRole('checkbox', { name: /^undergraduate$/i }).first()
await Promise.all([page.waitForURL(/level=undergraduate/, { timeout: 20000 }), undergrad.check()])
await settle(page)
check(
  'level checkbox combines with the existing filters',
  page.url().includes('level=undergraduate') && page.url().includes('deadline=week'),
  page.url(),
)
check(
  'level+week yields nothing (fixtures have no level joins)',
  (await rowTitles(page)).length === 0,
  await live(page),
)

// 7. SORT auto-submits and preserves the filters
await page.goto(`${BASE}/scholarships?renewable=1`, { waitUntil: 'networkidle' })
await settle(page)
await Promise.all([
  page.waitForURL(/sort=amount_desc/, { timeout: 20000 }),
  page.selectOption('#sort', 'amount_desc'),
])
check('sort select auto-submits', page.url().includes('sort=amount_desc'), page.url())
check('sort preserves active filters', page.url().includes('renewable=1'), page.url())
check('results still narrowed after sort', (await rowTitles(page)).length === 1)

// 8. Clear all
await page.getByRole('link', { name: /clear all/i }).first().click()
await page.waitForURL(/\/scholarships$/, { timeout: 20000 })
await settle(page)
check('"Clear all" resets to bare /scholarships', new URL(page.url()).search === '', page.url())
check('"Clear all" restores the full set', (await rowTitles(page)).length === 6)

// 9. Back button
await page.goBack()
await settle(page)
check('back restores the previous filter', page.url().includes('renewable=1'), page.url())

// 10. Filtered pages stay noindex
await page.goto(`${BASE}/scholarships?renewable=1`, { waitUntil: 'networkidle' })
check(
  'filtered URL is canonical + noindex',
  (await page.locator('link[rel="canonical"]').getAttribute('href'))?.includes('/scholarships') &&
    (await page.locator('meta[name="robots"]').getAttribute('content'))?.includes('noindex'),
)

check('no hydration mismatches (JS on)', hydration.length === 0, hydration.join(' | '))
await ctx.close()

/* -------------------------------------------------------------- WITHOUT JS -- */
const noJsCtx = await browser.newContext({ javaScriptEnabled: false })
const noJs = await noJsCtx.newPage()
await noJs.goto(`${BASE}/scholarships`, { waitUntil: 'domcontentloaded' })

const applyBtn = noJs.getByRole('button', { name: /apply filters/i })
check('without JS: "Apply filters" button is present', (await applyBtn.count()) === 1)

const noJsBox = noJs.getByRole('checkbox', { name: /renewable awards/i })
await noJsBox.check()
await noJs.waitForTimeout(600)
check('without JS: ticking alone does not navigate', !noJs.url().includes('renewable='), noJs.url())

await Promise.all([noJs.waitForURL(/renewable=1/, { timeout: 20000 }), applyBtn.click()])
check('without JS: the button applies the filter', noJs.url().includes('renewable=1'), noJs.url())

const noJsGo = noJs.getByRole('button', { name: /^go$/i })
check('without JS: sort "Go" button is present', (await noJsGo.count()) === 1)

await browser.close()

console.log('\n' + results.join('\n'))
const passed = results.filter((r) => r.startsWith('PASS')).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed === results.length ? 0 : 1)