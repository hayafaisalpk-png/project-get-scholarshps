import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Vitest configuration for unit and integration tests.
 *
 * These run in Node with a jsdom environment where DOM behaviour is needed.
 * They do NOT require a live Supabase project — anything touching the database
 * is exercised through mocked Supabase clients, and real RLS behaviour is
 * verified separately against a live project (see docs/TESTING.md).
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` throws when imported from a browser-like environment,
      // which includes Vitest's jsdom. Aliasing it to a stub lets unit tests
      // cover genuinely server-only modules without weakening the guard that
      // protects them in real builds.
      'server-only': fileURLToPath(
        new URL('./tests/stubs/server-only.ts', import.meta.url),
      ),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'node_modules/**', '.next/**'],
    // Deterministic, obviously-fake values so unit tests never depend on a
    // developer's real `.env.local`. These are NOT credentials — no test ever
    // performs a network call with them.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://test-project.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_key',
      NEXT_PUBLIC_SITE_URL: 'https://getscholarship.test',
      NEXT_PUBLIC_GA_MEASUREMENT_ID: '',
      NEXT_PUBLIC_ADSENSE_CLIENT_ID: '',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/app/**/layout.tsx',
        'src/**/index.ts',
        'src/**/*.test.{ts,tsx}',
      ],
    },
  },
})
