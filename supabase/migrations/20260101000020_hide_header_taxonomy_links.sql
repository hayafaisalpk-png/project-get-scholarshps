-- =============================================================================
-- 020_hide_header_taxonomy_links.sql
--
-- Editorial decision: the top navigation should not carry the scholarship
-- browse-by facets.
--
-- Removed from the header:
--   Find Scholarships          /scholarships
--   Scholarships by Level      /scholarships/education-level
--   Scholarships by Field      /scholarships/field
--   Scholarships by Location   /scholarships/location
--
-- Why `is_visible = false` rather than `delete`:
--   - Navigation is database-driven so editors can reorder or hide items without
--     a redeploy. `is_visible` is the supported mechanism for this.
--   - The `navigation_select_public` RLS policy already excludes invisible rows
--     from the anon/authenticated read, and `getNavigation()` in
--     `src/lib/navigation.ts` filters on `is_visible` as well. No application
--     change is needed, and the items stay reversible from the CMS.
--
-- Scope guard: `location = 'header'` only. Footer, legal and other navigation
-- areas are untouched, as are the pages themselves — the taxonomy landing
-- pages remain reachable from the homepage and from scholarship detail pages.
--
-- This migration is idempotent: re-running it updates the same rows to the same
-- state and creates nothing.
-- ---------------------------------------------------------------------------

update public.navigation_items
   set is_visible = false,
       updated_at = now()
 where location = 'header'
   and is_visible
   and href in (
     '/scholarships',
     '/scholarships/education-level',
     '/scholarships/field',
     '/scholarships/location'
   );

-- Guard: no visible header item may point at one of the removed paths.
do $$
declare
  remaining integer;
begin
  select count(*)
    into remaining
    from public.navigation_items
   where location = 'header'
     and is_visible
     and href in (
       '/scholarships',
       '/scholarships/education-level',
       '/scholarships/field',
       '/scholarships/location'
     );

  if remaining > 0 then
    raise exception
      'header navigation still exposes % removed facet link(s)', remaining;
  end if;
end;
$$;

notify pgrst, 'reload schema';