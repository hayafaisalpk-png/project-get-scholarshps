/**
 * Page-specific fallback keywords used when an editor has not set custom
 * keywords on a record.
 *
 * Each fallback leads with the page title (already a strong keyword signal),
 * then adds type-appropriate common terms, then the site name.
 */
export function getFallbackKeywords(
  title: string,
  type: "article" | "scholarship",
): string[] {
  const common =
    type === "article"
      ? ["scholarship guide", "student financial aid"]
      : ["international scholarships", "study abroad funding"];

  return [title, ...common, "GetScholarship"];
}
