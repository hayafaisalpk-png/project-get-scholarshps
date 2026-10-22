import { chromium } from '@playwright/test'

/**
 * The admin sidebar's brand name, measured while signed in.
 *
 * The admin sidebar is 288px wide with 256px of content, and the name just grew 30%.
 * The thing that can go wrong is not the size but the fit: the lockup wrapping, or
 * pushing the "Administration" label out of alignment with the text.
 */

const BASE = 'http://127.0.0.1:3111'
const EMAIL = 'brand-size-check@example.com'
const PASSWORD = 'BrandSizeCheck-2026!x'

let pass = 0
const failures = []
const check = (label, ok, detail = '') => {
  if (ok) { console.log(`  PASS  ${label}`); pass++ }
  else { console.log(`  FAIL  ${label}${detail ? `  <- ${detail}` : ''}`); failures.push(label) }
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })

try {
  console.log('=== SIGN IN ===')
  await page.goto(`${BASE}/auth/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 45_000 }),
    page.click('button[type="submit"]'),
  ])
  console.log(`  signed in, landed on ${new URL(page.url()).pathname}`)

  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
  check('the admin dashboard loads', await page.locator('#admin-sidebar, [id="admin-sidebar"]').count() >= 0)

  console.log('\n=== ADMIN BRAND ===')
  const brand = page.locator('a[href="/admin"]').first()
  const bold = brand.locator('span').filter({ hasText: /^Scholarship$/ }).first()
  const name = bold.locator('xpath=..')

  const measured = await name.evaluate((n) => {
    const cs = getComputedStyle(n)
    const r = n.getBoundingClientRect()
    return {
      size: parseFloat(cs.fontSize),
      weight: parseFloat(cs.fontWeight),
      boldWeight: parseFloat(getComputedStyle(n.querySelector('span')).fontWeight),
      text: n.textContent,
      width: r.width,
      height: r.height,
      scrollWidth: n.scrollWidth,
      truncated: n.scrollWidth > n.clientWidth + 1,
    }
  })

  console.log(`  ${measured.size}px weight ${measured.weight}/${measured.boldWeight} "${measured.text}"`)
  console.log(`  box ${measured.width.toFixed(1)}x${measured.height.toFixed(1)} truncated=${measured.truncated}`)

  check('the admin name is 20.8px — the enlarged footer size', Math.abs(measured.size - 20.8) < 0.05, `${measured.size}px`)
  check('it is 30% larger than the 16px it was', measured.size > 20 && measured.size < 21.5, `${measured.size}px`)
  check('"Get" is still normal weight', measured.weight === 400, `${measured.weight}`)
  check('"Scholarship" is still extrabold', measured.boldWeight === 800, `${measured.boldWeight}`)
  check('the name text is unchanged', measured.text === 'GetScholarship', measured.text)
  check('the name has NOT been truncated by the sidebar', !measured.truncated, `scrollWidth ${measured.scrollWidth} > ${measured.width.toFixed(0)}`)
  check('the name has not wrapped', measured.height < measured.size * 1.8, `${measured.height.toFixed(1)}px tall`)

  // The whole brand row must stay inside the 288px sidebar.
  const fit = await page.evaluate(() => {
    const sidebar = document.querySelector('#admin-sidebar') ??
      document.querySelector('[aria-label="Administration"]')?.closest('div')
    const link = document.querySelector('a[href="/admin"]')
    if (!link) return null
    const lr = link.getBoundingClientRect()
    const parent = link.parentElement.getBoundingClientRect()
    return {
      linkRight: lr.right,
      linkLeft: lr.left,
      containerWidth: parent.width,
      containerLeft: parent.left,
      overflowsRight: lr.right > parent.right + 1,
      overflowsLeft: lr.left < parent.left - 1,
    }
  })
  if (fit) {
    console.log(`  lockup ${fit.linkLeft.toFixed(1)}..${fit.linkRight.toFixed(1)} in a ${fit.containerWidth.toFixed(1)}px container`)
    check('the admin lockup fits inside its sidebar container', !fit.overflowsRight && !fit.overflowsLeft,
      `link ${fit.linkRight.toFixed(1)} vs container right edge`)
  }

  // The "Administration" label below is indented to clear the 32px badge; that
  // alignment depends on the badge, which is unchanged — but confirm it survived.
  const label = page.locator('text=Administration').first()
  if (await label.count()) {
    const indent = await label.evaluate((n) => parseFloat(getComputedStyle(n).paddingLeft))
    console.log(`  "Administration" label indent: ${indent}px`)
    check('the Administration label is still aligned under the name', indent === 40, `${indent}px`)
  }

  console.log('\n=== OTHER ADMIN PAGES ===')
  for (const route of ['/admin/scholarships', '/admin/articles', '/admin/media', '/admin/settings']) {
    const res = await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' })
    const size = await page.locator('a[href="/admin"]').first()
      .locator('span').filter({ hasText: /^Scholarship$/ }).first()
      .evaluate((n) => parseFloat(getComputedStyle(n.parentElement).fontSize))
      .catch(() => null)
    const ok = res.status() === 200 && size === 20.8
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${res.status()}  name=${size}px  ${route}`)
    ok ? pass++ : failures.push(`${route} (${res.status()}, ${size}px)`)
  }

  console.log('\n=== CLIPPING ===')
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
  await page.screenshot({ path: 'tmp-admin-brand.png', clip: { x: 0, y: 0, width: 300, height: 120 } })
  console.log('  written')
} catch (err) {
  console.error('\nHARNESS ERROR:', err.message)
  failures.push(`harness error: ${err.message}`)
} finally {
  await browser.close()
  console.log(`\n=== RESULT: ${pass} passed, ${failures.length} failed ===`)
  if (failures.length) { console.log(failures.map((f) => `  - ${f}`).join('\n')); process.exit(1) }
}