/**
 * Select a bounded list without repeating records shown in an earlier block.
 *
 * The candidates keep their query order, so a recent list remains newest-first.
 * A local `seen` set also protects the UI if a future data source itself returns
 * the same record more than once.
 */
export function selectUniqueScholarships<T extends { id: string }>(
  candidates: readonly T[],
  excludedIds: ReadonlySet<string>,
  limit: number,
): T[] {
  if (limit <= 0) return []

  const selected: T[] = []
  const seen = new Set(excludedIds)

  for (const candidate of candidates) {
    if (seen.has(candidate.id)) continue

    seen.add(candidate.id)
    selected.push(candidate)

    if (selected.length >= limit) break
  }

  return selected
}
