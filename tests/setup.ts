/**
 * Vitest global setup.
 *
 * Provides a jsdom matchMedia polyfill (required by Tailwind-driven responsive
 * helpers and several UI primitives) and fails tests that log React warnings,
 * so accessibility and hook problems surface early.
 */
import { afterEach, beforeEach, vi } from 'vitest'

beforeEach(() => {
  if (typeof window !== 'undefined' && !window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  }
})

afterEach(() => {
  vi.clearAllMocks()
})
