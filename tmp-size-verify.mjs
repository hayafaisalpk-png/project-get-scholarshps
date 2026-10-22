import { chromium } from '@playwright/test'

/**
 * Verifies the 1.3x enlargement of the name in the header and footer.
 *
 * The risk that matters is not the size itself but the width it costs: the lockup
 * got 30% wider, and the header has to hold it, the navigation and the auth control
 * on a 320px screen. Every viewport below is measured rather than assumed.
 */

const BASE = 'http://127.0.0.1:3111'

let pass = 0
const failures = []
const check = (label, ok, detail = '') => {
  if (ok) { console.log(`  PASS  ${label}`); pass++ }
  else { console.log(`  FAIL  ${label}${detail ? `  <- ${detail}` : ''}`); failures.push(label) }
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })

try {
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })

  for (const [where, expected] of [['header', 23.4], ['footer', 20.8]]) {
    console.log(`\n=== ${where.toUpperCase()} ===`)
    const scope = page.locator(where)
    const bold = scope.locator('span').filter({ hasText: /^Scholarship$/ }).first()
    const name = bold.locator('xpath=..')

    const measured = await name.evaluate((n) => {
      const cs = getComputedStyle(n)
      return {
        size: parseFloat(cs.fontSize),
        weight: parseFloat(cs.fontWeight),
        boldWeight: parseFloat(getComputedStyle(n.querySelector('span')).fontWeight),
        text: n.textContent,
      }
    })
    const box = await name.boundingBox()

    console.log(`  ${measured.size}px  (expected ${expected}px)  weight ${measured.weight}/${measured.boldWeight}`)
    check(`${where} name is ${expected}px`, Math.abs(measured.size - expected) < 0.05, `${measured.size}px`)
    check(`${where} "Get" is still normal weight`, measured.weight === 400, `${measured.weight}`)
    check(`${where} "Scholarship" is still extrabold`, measured.boldWeight === 800, `${measured.boldWeight}`)
    check(`${where} name text is unchanged`, measured.text === 'GetScholarship', measured.text)
    check(`${where} name has not wrapped`, box.height < expected * 1.8, `${box.height.toFixed(1)}px tall`)
  }

  console.log('\n=== WIDTH: did the lockup still fit? ===')
  for (const width of [320, 360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })

    const link = await page.locator('header a[href="/"]').first().boundingBox()
    const toggle = await page.locator('header button').first().boundingBox().catch(() => null)
    const bar = await page.locator('header .flex.h-16').first().boundingBox()

    console.log(`  ${width}px -> lockup ${link.width.toFixed(1)}px, bar row ${Math.round(bar.height)}px`)
    check(`${width}px: the lockup fits the viewport`,
      link.x >= 0 && link.x + link.width <= width,
      `ends at ${Math.round(link.x + link.width)}`)
    check(`${width}px: the bar did not grow taller than 64px`,
      Math.round(bar.height) === 64, `${Math.round(bar.height)}px`)
    if (toggle) {
      check(`${width}px: the toggle is still on screen`,
        toggle.x + toggle.width <= width + 1, `ends ${Math.round(toggle.x + toggle.width)}`)
    }
  }

  // Does the lockup collide with the navigation on a narrow screen?
  // Only VISIBLE navigation counts: the desktop nav is `hidden lg:block`, so below
  // `lg` its rect is 0x0 at the origin and comparing against it reports a collision
  // with nothing at all.
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })

    const overlap = await page.evaluate(() => {
      const link = document.querySelector('header a[href="/"]')
      const navs = [...document.querySelectorAll('header nav')]
        .map((n) => n.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0)
      if (!link) return { checked: false }
      const a = link.getBoundingClientRect()
      if (navs.length === 0) return { checked: false, reason: 'no visible nav at this width' }
      const nearest = Math.min(...navs.map((r) => r.left))
      return { checked: true, linkRight: a.right, navLeft: nearest, collides: a.right > nearest + 1 }
    })

    if (overlap.checked) {
      console.log(`  ${width}px -> lockup ends ${overlap.linkRight.toFixed(1)}, nav starts ${overlap.navLeft.toFixed(1)}`)
      check(`${width}px: the lockup does not overlap the visible navigation`, !overlap.collides)
    } else {
      console.log(`  ${width}px -> ${overlap.reason}`)
    }
  }

  console.log('\n=== CLIPPING ===')
  for (const [w, h, file] of [[1280, 80, 'tmp-size-1280.png'], [360, 80, 'tmp-size-360.png']]) {
    await page.setViewportSize({ width: w, height: 800 })
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: Math.min(w, 560), height: h } })
  }
  console.log('  written')
} catch (err) {
  console.error('\nHARNESS ERROR:', err.message)
  failures.push(`harness error: ${err.message}`)
} finally {
  await browser.close()
  console.log(`\n=== RESULT: ${pass} passed, ${failures.length} failed ===`)
  if (failures.length) { console.log(failures.map((f) => `  - ${f}`).join('\n')); process.exit(1) }
}