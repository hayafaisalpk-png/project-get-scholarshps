/**
 * The single source of truth for which physical table backs each taxonomy kind.
 *
 * Reads (`listTaxonomy`) and writes (`createTaxonomyAction`,
 * `deleteTaxonomyAction`) must agree on this mapping. They were previously
 * defined twice and drifted: the admin screen read `article_tags` while the
 * save path wrote to `public.tags`, so a tag could be "created" successfully
 * and never appear in the list — or in the article form's Classification
 * section, which also reads `article_tags`.
 *
 * Categories and tags are the *article* taxonomy here. `public.categories` and
 * `public.tags` are the scholarship vocabulary and are a different thing.
 */
export type TaxonomyKind =
  | 'categories'
  | 'tags'
  | 'education_levels'
  | 'academic_fields'
  | 'locations'

export const TAXONOMY_TABLES = {
  categories: 'article_categories',
  tags: 'article_tags',
  education_levels: 'education_levels',
  academic_fields: 'academic_fields',
  locations: 'locations',
} as const satisfies Record<TaxonomyKind, string>
