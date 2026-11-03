/**
 * Parse a comma/semicolon/newline-separated keyword string into a clean
 * PostgreSQL text array.
 *
 * - Trims whitespace around each keyword
 * - Drops empty keywords
 * - Deduplicates (first occurrence wins)
 * - Caps each keyword at 100 characters
 * - Caps the total at 20 keywords
 *
 * Safe to call with an empty string: returns `[]`.
 */
export function parseKeywords(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[,;\n]/)
        .map((keyword) => keyword.trim())
        .filter(Boolean)
        .map((keyword) => keyword.slice(0, 100))
    ),
  ).slice(0, 20);
}

/**
 * Format a keyword array (as read from the database) back into a
 * comma-separated string for display in a textarea.
 */
export function formatKeywords(keywords: string[] | null): string {
  return (keywords ?? []).join(", ");
}
