import { expect, test } from '@playwright/test'

test.describe('public smoke journeys', () => {
  test('homepage loads with the primary search journey', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/GetScholarship/i)
    await expect(page.getByPlaceholder(/search by keyword/i)).toBeVisible()
  })

  test('scholarship search page loads', async ({ page }) => {
    const response = await page.goto('/scholarships')
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: /scholarships/i }).first()).toBeVisible()
  })

  test('scholarship search accepts a query', async ({ page }) => {
    await page.goto('/scholarships?q=engineering')
    await expect(page).toHaveURL(/q=engineering/)
  })

  test('articles index loads', async ({ page }) => {
    const response = await page.goto('/articles')
    expect(response?.status()).toBe(200)
  })

  test('about page loads', async ({ page }) => {
    expect((await page.goto('/about'))?.status()).toBe(200)
  })

  test('help page loads', async ({ page }) => {
    expect((await page.goto('/help'))?.status()).toBe(200)
  })

  test('contact page exposes a labelled form', async ({ page }) => {
    await page.goto('/contact')
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.locator('form')).toBeVisible()
  })

  test('privacy page loads', async ({ page }) => {
    expect((await page.goto('/privacy'))?.status()).toBe(200)
  })

  test('terms page loads', async ({ page }) => {
    expect((await page.goto('/terms'))?.status()).toBe(200)
  })

  test('editorial standards page loads', async ({ page }) => {
    expect((await page.goto('/editorial-standards'))?.status()).toBe(200)
  })

  test('sign-in page loads', async ({ page }) => {
    expect((await page.goto('/auth/login'))?.status()).toBe(200)
    await expect(page.getByLabel(/email/i)).toBeVisible()
  })

  test('forgot-password page loads', async ({ page }) => {
    expect((await page.goto('/auth/forgot-password'))?.status()).toBe(200)
  })

  test('reset-password page loads', async ({ page }) => {
    expect((await page.goto('/auth/reset-password'))?.status()).toBe(200)
  })

  test('robots file is available', async ({ request }) => {
    const response = await request.get('/robots.txt')
    expect(response.status()).toBe(200)
    expect(await response.text()).toContain('Sitemap:')
  })

  test('sitemap index is available', async ({ request }) => {
    const response = await request.get('/sitemap.xml')
    expect(response.status()).toBe(200)
    expect(await response.text()).toContain('<sitemapindex')
  })

  test('unknown route returns a real 404', async ({ page }) => {
    const response = await page.goto('/this-route-does-not-exist')
    expect(response?.status()).toBe(404)
  })

  test('consent banner is keyboard reachable', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('dialog', { name: /privacy preferences/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /reject optional/i })).toBeVisible()
  })

  test('homepage remains usable at mobile width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await expect(page.locator('body')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
})
