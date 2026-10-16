/**
 * Stub for the `server-only` package used by Vitest.
 *
 * The real package throws on import from a client bundle, which is exactly the
 * protection we want in the application. It also throws when imported from a
 * test, because Vitest runs in a jsdom environment that resolves the
 * "browser" condition.
 *
 * Aliasing it here lets unit tests exercise genuinely server-only logic
 * (sanitisation, queries) without weakening the guard in real builds.
 */
export {}