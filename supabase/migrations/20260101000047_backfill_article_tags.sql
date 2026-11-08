-- =============================================================================
-- 047_backfill_article_tags.sql
--
-- The taxonomy CMS read `article_tags` but wrote `public.tags`. A tag created
-- through /admin/taxonomy therefore landed in the scholarship tag table: it was
-- saved successfully, never appeared in the taxonomy list, and never appeared
-- in the article form's Classification section.
--
-- `public.tags` is not seeded and no other code path writes to it, so every row
-- there is a mis-routed article tag. Copy them across. This migration only
-- INSERTs: the original rows are left untouched, and re-running it is a no-op.
--
-- `public.categories` is deliberately NOT copied. Unlike `public.tags`, it is a
-- legitimate scholarship vocabulary seeded in `supabase/seed.sql`, so copying it
-- would put scholarship categories into the article classification list.
-- =============================================================================

insert into public.article_tags (slug, name, status)
select t.slug, t.name, t.status
from public.tags t
where t.archived_at is null
on conflict (slug) do nothing;
