-- =============================================================================
-- 045_add_keywords_to_articles_and_scholarships.sql
-- SEO meta keywords stored as PostgreSQL text arrays on articles and
-- scholarships, so editors can manage per-page keywords through the CMS.
-- =============================================================================

-- Add keywords to articles
ALTER TABLE public.articles
ADD COLUMN IF NOT EXISTS keywords TEXT[] NOT NULL DEFAULT '{}';

-- Add keywords to scholarships
ALTER TABLE public.scholarships
ADD COLUMN IF NOT EXISTS keywords TEXT[] NOT NULL DEFAULT '{}';

-- Ensure existing NULL values are replaced (belt and braces for NOT NULL DEFAULT)
UPDATE public.articles
SET keywords = '{}'
WHERE keywords IS NULL;

UPDATE public.scholarships
SET keywords = '{}'
WHERE keywords IS NULL;

comment on column public.articles.keywords is
  'SEO meta keywords for the article page, stored as a text array.';
comment on column public.scholarships.keywords is
  'SEO meta keywords for the scholarship page, stored as a text array.';
