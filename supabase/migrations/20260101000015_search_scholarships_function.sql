-- =============================================================================
-- 015_search_scholarships_function.sql
--
-- Moves scholarship search from PostgREST `.or()` chains into a single SQL
-- function.
--
-- WHY
--
-- Live verification against the real database (2026-10-15) showed the
-- PostgREST approach could not work correctly:
--
--   1. supabase-js `.order('published_at.desc.nullslast')` APPENDS the
--      direction, producing `published_at.desc.nullslast.asc` — a parse error.
--   2. Sorting by relevance requires ordering by `ts_rank(...)`, which is not a
--      real column and cannot appear in PostgREST's `order=` at all.
--   3. Filtering by five taxonomy groups means stacking `.or()` calls, each of
--      which ANDs together and is easy to get subtly wrong.
--
-- One SQL function is simpler, faster (single round trip, no OR-chain planning),
-- and gives us rank ordering and a total count for pagination.
--
-- SECURITY
--
-- Deliberately SECURITY INVOKER (the default, stated explicitly below) so that
-- the caller's Row Level Security policies still apply. A SECURITY DEFINER
-- function here would bypass RLS and could expose drafts.
-- =============================================================================

create or replace function public.search_scholarships(
  p_q                  text        default null,
  p_levels             text[]      default null,
  p_fields             text[]      default null,
  p_categories         text[]      default null,
  p_locations          text[]      default null,
  p_tags               text[]      default null,
  p_min_amount_cents   bigint      default null,
  p_max_amount_cents   bigint      default null,
  p_deadline           text        default 'any',
  p_renewable          boolean     default false,
  p_free_application   boolean     default false,
  p_international      boolean     default false,
  p_sort               text        default 'newest',
  p_page               integer     default 1,
  p_page_size          integer     default 12
)
returns table (
  id                      uuid,
  slug                    citext,
  title                   text,
  sponsor_name            text,
  summary                 text,
  award_amount_min_cents  bigint,
  award_amount_max_cents  bigint,
  award_amount_text       text,
  award_currency          text,
  number_of_awards        integer,
  is_renewable            boolean,
  application_fee_cents   integer,
  deadline                date,
  is_rolling              boolean,
  verification_status     public.verification_status,
  verified_at             timestamptz,
  last_reviewed_at        timestamptz,
  featured                boolean,
  published_at            timestamptz,
  is_expired              boolean,
  days_remaining          integer,
  search_rank             real,
  total_count             bigint
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $fn$
  -- Defensive clamping. These inputs arrive from a URL, so the function must not
  -- trust any of them: an unbounded page_size would let one request read the
  -- whole table.
  with params as (
    select
      nullif(btrim(coalesce(p_q, '')), '')                       as q,
      case when coalesce(cardinality(p_levels), 0)     > 0 then p_levels     end as levels,
      case when coalesce(cardinality(p_fields), 0)     > 0 then p_fields     end as fields,
      case when coalesce(cardinality(p_categories), 0) > 0 then p_categories end as categories,
      case when coalesce(cardinality(p_locations), 0)  > 0 then p_locations  end as locations,
      case when coalesce(cardinality(p_tags), 0)       > 0 then p_tags       end as tags,
      greatest(coalesce(p_min_amount_cents, 0), 0)                as min_amount,
      nullif(greatest(coalesce(p_max_amount_cents, 0), 0), 0)    as max_amount,
      case when p_deadline in ('open', 'week', 'month', 'closed') then p_deadline else 'any' end as deadline,
      coalesce(p_renewable, false)        as renewable,
      coalesce(p_free_application, false) as free_application,
      coalesce(p_international, false)    as international,
      case when p_sort in ('relevance', 'deadline', 'amount_desc', 'newest') then p_sort else 'newest' end as sort,
      greatest(coalesce(p_page, 1), 1)                            as page,
      least(greatest(coalesce(p_page_size, 12), 1), 50)           as page_size
  ),
  ranked as (
    select
      s.id,
      s.slug,
      s.title,
      s.sponsor_name,
      s.summary,
      s.award_amount_min_cents,
      s.award_amount_max_cents,
      s.award_amount_text,
      s.award_currency,
      s.number_of_awards,
      s.is_renewable,
      s.application_fee_cents,
      s.deadline,
      s.is_rolling,
      s.verification_status,
      s.verified_at,
      s.last_reviewed_at,
      s.featured,
      s.published_at,
      public.scholarship_is_expired(s.status, s.deadline, s.is_rolling) as is_expired,
      public.scholarship_days_remaining(s.deadline)                     as days_remaining,
      case
        when pr.q is not null
          then ts_rank(s.search_vector, websearch_to_tsquery('english', pr.q))
        else 0::real
      end as search_rank
    from public.scholarships s
    cross join params pr
    where s.status = 'published'
      and s.archived_at is null
      -- Full-text relevance. websearch_to_tsquery tolerates ordinary user input.
      and (pr.q is null or s.search_vector @@ websearch_to_tsquery('english', pr.q))
      -- Taxonomy: each supplied group is an OR within the group and an AND
      -- across groups ("undergraduate AND nursing").
      and (pr.levels is null or exists (
        select 1
        from public.scholarship_education_levels sel
        join public.education_levels el on el.id = sel.education_level_id
        where sel.scholarship_id = s.id and el.slug::text = any (pr.levels)
      ))
      and (pr.fields is null or exists (
        select 1
        from public.scholarship_fields sf
        join public.academic_fields af on af.id = sf.academic_field_id
        where sf.scholarship_id = s.id and af.slug::text = any (pr.fields)
      ))
      and (pr.categories is null or exists (
        select 1
        from public.scholarship_categories sc
        join public.categories c on c.id = sc.category_id
        where sc.scholarship_id = s.id and c.slug::text = any (pr.categories)
      ))
      and (pr.locations is null or exists (
        select 1
        from public.scholarship_locations sl
        join public.locations l on l.id = sl.location_id
        where sl.scholarship_id = s.id and l.slug::text = any (pr.locations)
      ))
      and (pr.tags is null or exists (
        select 1
        from public.scholarship_tags st
        join public.tags t on t.id = st.tag_id
        where st.scholarship_id = s.id and t.slug::text = any (pr.tags)
      ))
      -- Amount overlap: max >= requested min, and min <= requested max.
      and (
        pr.min_amount = 0
        or (s.award_amount_max_cents is not null and s.award_amount_max_cents >= pr.min_amount)
      )
      and (
        pr.max_amount is null
        or (s.award_amount_min_cents is not null and s.award_amount_min_cents <= pr.max_amount)
      )
      and (not pr.renewable or s.is_renewable)
      and (not pr.free_application or s.application_fee_cents = 0)
      -- International is a category (scholarship_categories -> categories.international).
      and (not pr.international or exists (
        select 1
        from public.scholarship_categories sic
        join public.categories ic on ic.id = sic.category_id
        where sic.scholarship_id = s.id and ic.slug = 'international'
      ))
      and case pr.deadline
        when 'open'   then (s.is_rolling or s.deadline >= current_date)
        when 'week'   then (not s.is_rolling and s.deadline between current_date and current_date + 7)
        when 'month'  then (not s.is_rolling and s.deadline between current_date and current_date + 30)
        when 'closed' then (not s.is_rolling and s.deadline < current_date)
        else true
      end
  )
  -- A single query with a conditional ORDER BY rather than one branch per sort.
  -- Each ORDER BY term is wrapped in `case when pr.sort = ... then ... end`, so a
  -- term that does not apply evaluates to NULL for every row and has no effect.
  -- `published_at desc` then acts as the default order and the tie-breaker.
  --
  -- Pagination uses row_number() rather than OFFSET because PostgreSQL rejects a
  -- variable OFFSET ("argument of OFFSET must not contain variables"). The cost
  -- is that the ordered set is materialised rather than skipped; acceptable at
  -- the current data volume and easy to revisit if the table grows large.
  select
    t.id,
    t.slug,
    t.title,
    t.sponsor_name,
    t.summary,
    t.award_amount_min_cents,
    t.award_amount_max_cents,
    t.award_amount_text,
    t.award_currency,
    t.number_of_awards,
    t.is_renewable,
    t.application_fee_cents,
    t.deadline,
    t.is_rolling,
    t.verification_status,
    t.verified_at,
    t.last_reviewed_at,
    t.featured,
    t.published_at,
    t.is_expired,
    t.days_remaining,
    t.search_rank,
    t.total_count
  from (
    select
      r.id,
      r.slug,
      r.title,
      r.sponsor_name,
      r.summary,
      r.award_amount_min_cents,
      r.award_amount_max_cents,
      r.award_amount_text,
      r.award_currency,
      r.number_of_awards,
      r.is_renewable,
      r.application_fee_cents,
      r.deadline,
      r.is_rolling,
      r.verification_status,
      r.verified_at,
      r.last_reviewed_at,
      r.featured,
      r.published_at,
      r.is_expired,
      r.days_remaining,
      r.search_rank,
      -- Window function so the total comes from the same scan, avoiding a second
      -- pass over the filtered set for every page request.
      count(*) over () as total_count,
      row_number() over (
        order by
          case when pr.sort = 'relevance' then r.search_rank end desc nulls last,
          case when pr.sort = 'deadline'    then r.is_rolling end asc nulls last,
          case when pr.sort = 'deadline'    then r.deadline end asc nulls last,
          case when pr.sort = 'amount_desc' then r.award_amount_max_cents end desc nulls last,
          r.published_at desc nulls last,
          r.id
      ) as rn
    from ranked r
    cross join params pr
  ) t
  cross join params pr
  where t.rn > (pr.page - 1) * pr.page_size
    and t.rn <= pr.page * pr.page_size
  order by t.rn;
$fn$;

comment on function public.search_scholarships(text, text[], text[], text[], text[], text[], bigint, bigint, text, boolean, boolean, boolean, text, integer, integer) is
  'Server-side scholarship search: taxonomy filters, weighted full-text relevance, deadline windows and pagination. SECURITY INVOKER so caller RLS applies.';

-- ---------------------------------------------------------------------------
-- Grants: callable by visitors, subject to RLS.
-- ---------------------------------------------------------------------------
revoke execute on function public.search_scholarships(text, text[], text[], text[], text[], text[], bigint, bigint, text, boolean, boolean, boolean, text, integer, integer) from public;

grant execute on function public.search_scholarships(text, text[], text[], text[], text[], text[], bigint, bigint, text, boolean, boolean, boolean, text, integer, integer)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Ask PostgREST to pick up the new function without waiting for its poll.
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';
