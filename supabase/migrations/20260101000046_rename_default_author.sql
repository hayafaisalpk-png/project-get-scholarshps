-- =============================================================================
-- 046_rename_default_author.sql
-- Rename the default public author from "GetScholarship Editorial Team" to
-- "By : Haya Faisal". Identified by the stable slug so the update is safe
-- regardless of the assigned UUID.
-- =============================================================================

update public.authors
set full_name = 'By : Haya Faisal',
    title     = 'Scholarship and Financial Aid Writer',
    bio       = 'Researches, verifies and explains scholarship and financial aid opportunities.',
    updated_at = now()
where slug = 'getscholarship-editorial-team';
