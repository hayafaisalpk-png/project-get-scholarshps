import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

/**
 * ESLint flat config.
 *
 * `eslint-config-next` v16 ships flat-config arrays directly, so no FlatCompat
 * layer is required. `next lint` was removed in Next.js 16 — linting runs
 * through the ESLint CLI (`npm run lint`).
 */
const config = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      '.next-dev/**',
      'out/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
]

export default config
