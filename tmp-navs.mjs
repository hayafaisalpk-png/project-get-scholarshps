import { chromium } from '@playwright/test'

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 320, height: 800 }, deviceScaleFactor: 1 })
await p.goto('http://127.0.0.1:3111/', { waitUntil: 'networkidle' })

const navs = await p.evaluate(() => {
  const out = []
  document.querySelectorAll('header nav').forEach((n, i) => {
    const r = n.getBoundingClientRect()
    out.push({
      i,
      label: n.getAttribute('aria-label'),
      cls: n.className.toString().slice(0, 60),
      rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
      visible: r.width > 0 && r.height > 0,
    })
  })
  return out
})
console.log(JSON.stringify(navs, null, 2))
await b.close()