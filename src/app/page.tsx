/**
 * Temporary Phase 1 placeholder.
 *
 * Replaced by the database-driven homepage in Phase 3. Present only to verify
 * that the toolchain (Next 16 + Tailwind v4 + fonts + proxy) builds cleanly.
 */
export default function HomePage() {
  return (
    <main className="container-page flex min-h-dvh items-center justify-center py-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-brand-800">GetScholarship</h1>
        <p className="mt-4 text-ink-600">
          Phase 1 foundation is installed. The database-driven homepage is
          scheduled for Phase 3.
        </p>
      </div>
    </main>
  )
}
