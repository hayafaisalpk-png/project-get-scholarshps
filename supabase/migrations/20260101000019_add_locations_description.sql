-- =============================================================================
-- 019_add_locations_description.sql
--
-- Corrective migration.
--
-- Found by exercising the public site (Phase 3):
--   /scholarships/location/texas returned 404 even though three published
--   scholarships carried that location.
--
-- Root cause: `locations` was the only taxonomy table created without a
-- `description` column. Every other taxonomy (categories, education_levels,
-- academic_fields, tags) has one, and both `getTermBySlug` and `getLocations`
-- select it. The query therefore failed with:
--   42703 column locations.description does not exist
--
-- The homepage's "Scholarships by location" block was silently empty for the
-- same reason — the reader logs the error and returns an empty list, which is
-- the correct failure mode but easy to miss.
--
-- A description is needed regardless: location landing pages need original
-- introductory copy, and the taxonomy reader is shared across all five kinds.
-- ---------------------------------------------------------------------------

alter table public.locations
  add column if not exists description text;

comment on column public.locations.description is
  'Short description used on the location landing page.';

-- Guard: the taxonomy reader selects `description` from every table it serves.
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'locations'
      and column_name = 'description'
  ) then
    raise exception 'public.locations.description is still missing';
  end if;
end;
$$;

notify pgrst, 'reload schema';
