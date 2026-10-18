-- =============================================================================
-- 026_public_newsletter_enabled_setting.sql
--
-- The newsletter signup block could never render.
--
-- WHAT WAS BROKEN
--
-- `newsletter.enabled` was seeded with `is_public = false`. The policy
-- `site_settings_select_public` (migration 010) reads:
--
--   using (is_public or public.has_permission('settings.manage'))
--
-- and `getPublicSettings()` in `src/lib/settings.ts` additionally filters
-- `.eq('is_public', true)` before returning anything to a page. So an anonymous
-- visitor — who can never hold `settings.manage` — could not read the flag, and
-- `NewsletterBlock` therefore evaluated to `null` unconditionally.
--
-- The feature was not visibly broken: the footer looked correct because the block
-- correctly renders nothing when disabled. That is precisely why it had to be
-- found by temporarily flipping the flag and looking for the form, rather than by
-- reading the code — a gate that can only ever be closed looks identical to a
-- gate that is working.
--
-- WHY MAKING IT PUBLIC IS CORRECT
--
-- `is_public` exists so that non-sensitive configuration is readable by the
-- server while secrets and ad/analytics switches stay out of the browser's reach.
-- A boolean that decides whether a signup form is drawn is not sensitive: the
-- presence or absence of the form already tells any visitor that value. There is
-- nothing to protect by hiding it.
--
-- CONTRAST — what stays private, and why
--
--   ads.*, analytics.*  remain private. Loading an ad or analytics script is a
--                       decision made in the browser, and a public flag would let
--                       anyone read the publisher ID. `isProduction()` and the
--                       consent gate are what gate those, not this column.
--
-- This migration is idempotent.
-- ---------------------------------------------------------------------------

update public.site_settings
   set is_public = true
 where key = 'newsletter.enabled';

-- Guard: the block cannot work without this, so fail loudly rather than shipping
-- a permanently-disabled feature.
do $$
begin
  if not exists (
    select 1
      from public.site_settings
     where key = 'newsletter.enabled'
       and is_public
  ) then
    raise exception
      'newsletter.enabled is not publicly readable — the signup block can never render';
  end if;
end;
$$;

notify pgrst, 'reload schema';