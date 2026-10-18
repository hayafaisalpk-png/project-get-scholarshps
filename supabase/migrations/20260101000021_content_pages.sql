-- =============================================================================
-- 021_content_pages.sql
--
-- Database-driven static pages: About, Help, Privacy Policy, Terms of Use and
-- Editorial Standards.
--
-- WHY A NEW TABLE
--
-- `AGENTS.md` §2.8 forbids hardcoding CMS content in components, and navigation
-- already points at these five paths (`navigation_items`, seeded in
-- `supabase/seed.sql`). Before this migration the header and footer advertised
-- six URLs that returned 404, because no route existed for any of them.
--
-- Storing the copy in the database rather than in TSX means:
--   - the legal documents can be revised by an editor without a redeploy, which
--     matters because Terms and Privacy change more often than code does;
--   - every page renders through one component, so the heading order, prose
--     styling and metadata rules are identical on all five;
--   - a page can be unpublished (status = 'inactive') without deleting it, so a
--     live legal link is never dangling.
--
-- WHY DELETE IS NOT GRANTED
--
-- `authenticated` receives SELECT, INSERT and UPDATE but never DELETE. These
-- documents are the site's legal footing; removing one should require a
-- deliberate migration, not a stray CMS request. This mirrors `AGENTS.md` §2.1.
--
-- RLS mirrors `articles`: anonymous visitors read only active pages; anything
-- else needs an explicit permission.
--
-- This migration is idempotent — it creates the table if absent, replaces the
-- policies, and upserts the five seeded pages.
-- ---------------------------------------------------------------------------

create table if not exists public.content_pages (
  id          uuid primary key default gen_random_uuid(),
  slug        extensions.citext not null unique,
  title       text not null,
  -- Short summary used for the meta description and rendered under the title.
  excerpt     text,
  -- Sanitized HTML, rendered through the same allowlist as article content
  -- (`src/lib/sanitize.ts`). Sanitised again on render.
  body        text not null default '',
  status      public.taxonomy_status not null default 'active',
  sort_order  integer not null default 0,

  -- SEO
  seo_title       text,
  seo_description text,
  canonical_url   text,
  noindex         boolean not null default false,

  updated_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint content_pages_slug_not_blank check (char_length(btrim(slug)) > 0),
  constraint content_pages_title_not_blank check (char_length(btrim(title)) > 0),
  constraint content_pages_sort_order_valid check (sort_order >= 0)
);

comment on table public.content_pages is
  'Static informational and legal pages, rendered from database content.';

create index if not exists content_pages_status_order_idx
  on public.content_pages (status, sort_order);

select public.attach_updated_at_trigger('content_pages');

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.content_pages enable row level security;
alter table public.content_pages force row level security;

-- Public read: active pages only. An inactive page 404s for everyone without the
-- permission below, which is how a legal page is withdrawn safely.
drop policy if exists content_pages_select_public on public.content_pages;
create policy content_pages_select_public on public.content_pages
  for select to anon, authenticated
  using (
    status = 'active'
    or public.has_permission('settings.manage')
    or public.has_permission('seo.manage')
  );

-- Editorial write. `noindex` may be set by either capability owner; the rest of
-- the row by settings management.
drop policy if exists content_pages_insert_manage on public.content_pages;
create policy content_pages_insert_manage on public.content_pages
  for insert to authenticated
  with check (public.has_permission('settings.manage'));

drop policy if exists content_pages_update_manage on public.content_pages;
create policy content_pages_update_manage on public.content_pages
  for update to authenticated
  using (public.has_permission('settings.manage') or public.has_permission('seo.manage'))
  with check (public.has_permission('settings.manage') or public.has_permission('seo.manage'));

-- NOTE: deliberately no DELETE policy and no DELETE grant. See the header note.

-- -----------------------------------------------------------------------------
-- Privileges
--
-- `revoke all` first: tables inherit broad Supabase defaults, and RLS cannot
-- filter an operation such as TRUNCATE. This is the same correction made for
-- every other table in migration 013.
-- -----------------------------------------------------------------------------

revoke all on public.content_pages from anon, authenticated;
grant select on public.content_pages to anon, authenticated;
grant select, insert, update on public.content_pages to authenticated;

-- =============================================================================
-- Seed content
--
-- DRAFT COPY — REQUIRES LEGAL REVIEW BEFORE LAUNCH
--
-- These documents are drafted against the behaviour the code actually has, not
-- against a template. Nothing here claims a verification team, an office
-- address, a registration number, a response time or a statistic, because none
-- of those exist yet (`AGENTS.md` §2.7). Placeholders that would be a lie are
-- omitted rather than filled in.
--
-- `docs/DEVELOPMENT_ROADMAP.md` already records "legal/privacy review" as an
-- open decision blocking monetised launch. This seed does not discharge it.
-- =============================================================================

insert into public.content_pages (slug, title, excerpt, body, status, sort_order, seo_description)
values
  (
    'about',
    'About GetScholarship',
    'What GetScholarship is, what it does, and the standards it holds itself to.',
    $body$
<p>GetScholarship is a directory of scholarship and financial aid information. It exists to answer one question accurately and quickly: <strong>what funding exists, who is eligible for it, when it closes and where to apply.</strong></p>

<h2>What we do</h2>

<p>Every scholarship listed here is stored as a structured record rather than a page of prose. That record carries the award amount, the education levels and fields of study it covers, the eligibility conditions, the opening and closing dates, the official application link, and the documents an applicant is expected to prepare. Keeping that information in fields rather than paragraphs is what lets you filter by it.</p>

<p>Alongside the directory we publish guides: articles explaining how applications work, how financial aid is structured, and how to approach essays and personal statements. They are written to explain, not to sell.</p>

<h2>How we handle information</h2>

<p>We would rather show you fewer opportunities than show you a wrong one. A deadline that has already passed is kept and labelled as closed rather than quietly removed, because knowing that a scheme existed and has ended is itself useful. Awards we cannot state precisely are recorded as "amount not specified" rather than estimated.</p>

<p>Each record links to the awarding body's own page, and we prefer that page over our summary whenever the two disagree. If you find something wrong, please <a href="/contact?type=report">tell us</a> and we will correct it.</p>

<h2>What we do not do</h2>

<ul>
  <li>We do not charge an application fee, and we do not ask for payment to be listed.</li>
  <li>We do not claim to decide scholarship outcomes. Awarding bodies do that, and only they.</li>
  <li>We do not sell, rent or share your personal information.</li>
  <li>We do not offer matching, saved lists or application tracking, because those features do not exist here yet.</li>
</ul>

<h2>Questions</h2>

<p>The <a href="/help">Help page</a> answers the common questions about using the site. If it does not answer yours, <a href="/contact">contact us</a>.</p>
$body$,
    'active',
    1,
    'GetScholarship is a database-driven directory of scholarships and financial aid information. What we list, how we verify it, and what we do not do.'
  ),

  (
    'help',
    'Help',
    'How to search, filter and read a scholarship record on GetScholarship.',
    $body$
<p>This page explains how to use the site. For anything about a specific scholarship, the record itself and the awarding body's official page are the authority.</p>

<h2>Searching</h2>

<p>Use the search field for keywords such as a subject, a scholarship name or an awarding body. Keyword search is matched against the title, sponsor and description, and results are ranked by relevance.</p>

<p>The filters narrow the results. They combine, so a narrow combination can return nothing &mdash; if that happens, remove one filter and try again rather than assuming there is no funding available.</p>

<ul>
  <li><strong>Education level</strong> &mdash; the level the award is open to.</li>
  <li><strong>Field of study</strong> &mdash; the subject area the award is restricted to, where it is restricted.</li>
  <li><strong>Type</strong> &mdash; how the award is categorised, for example merit-based or need-based.</li>
  <li><strong>Deadline</strong> &mdash; filter to awards still open, closing this week, closing this month, or recently closed.</li>
  <li><strong>Other</strong> &mdash; renewable awards, and awards with no application fee.</li>
</ul>

<p>Every filter state is a shareable URL. Copy the address bar and the same results open for anyone else.</p>

<h2>Reading a record</h2>

<p>Each record shows the award amount, who is eligible, the dates, and a link to the official application. A few points worth knowing:</p>

<ul>
  <li><strong>Closed is not deleted.</strong> A scholarship whose deadline has passed keeps its page and is labelled closed. Recently closed records are useful when a similar scheme is likely to run again.</li>
  <li><strong>"Amount not specified" is not zero.</strong> It means the awarding body does not publish a figure, or it does not vary by awardee.</li>
  <li><strong>Always read the official page before applying.</strong> Our summary can only be as current as its last verification; the awarding body is the source of truth.</li>
</ul>

<h2>Found an error?</h2>

<p>If a deadline, amount, eligibility condition or link is wrong, please <a href="/contact?type=report">report it</a>. Reports go to the editorial team and are the fastest way to get a correction made. Please say which record and what is wrong with it.</p>

<h2>Still stuck?</h2>

<p><a href="/contact">Send us a message</a>. If your question is about your own application, the awarding body is usually the only party that can answer it.</p>
$body$,
    'active',
    2,
    'How to search, filter and read scholarship records on GetScholarship, what closed and amount-not-specified mean, and how to report an error.'
  ),

  (
    'privacy',
    'Privacy Policy',
    'What personal data GetScholarship collects, why, and how to have it removed.',
    $body$
<p>This policy describes what this website actually does with your data. Where something is not yet implemented, it says so rather than describing a system that does not exist.</p>

<h2>What we collect</h2>

<p><strong>If you only browse:</strong> the pages are served to your browser without us setting any cookie on you, and without an account. Scholarship and article content is public.</p>

<p><strong>If you contact us or report an error:</strong> we store the name, email address and message you submit, along with the time it was received and its status. This exists so a reply can be sent and so the same question is not answered twice. It is not used for marketing.</p>

<p><strong>If you create an editorial account:</strong> we store your email address and a hashed password, your display name, and a record of sign-ins and changes you make in the administration area. Those audit records are retained deliberately, so that changes to published content can be attributed.</p>

<h2>Cookies and advertising</h2>

<p>This site currently sets no advertising cookies and runs no analytics, because neither advertising nor analytics has been activated. Advertising and analytics are planned and will require consent before anything loads; a consent control will appear before that happens, and this policy will be updated at the same time.</p>

<h2>What we do not do</h2>

<ul>
  <li>We do not sell, rent or trade your personal information.</li>
  <li>We do not send marketing email. If we ever want to, we will ask you first.</li>
  <li>We do not ask for payment in connection with any scholarship listed here.</li>
</ul>

<h2>How long we keep it</h2>

<p>Contact messages and error reports are kept while the matter is open and for a reasonable period afterwards so the history stays useful. Account and audit data is kept for as long as the account exists and for as long as we may need to demonstrate what was published and who changed it.</p>

<h2>Your rights</h2>

<p>You can ask what we hold about you, ask for it to be corrected, or ask for it to be deleted. Contact us and we will deal with the request. Note that published scholarship and article content is editorial, not personal data, and is corrected rather than removed when it is wrong.</p>

<h2>Children</h2>

<p>This site is aimed at people applying for higher education, including school leavers. We do not knowingly collect personal information from children below the applicable age, and if you believe a child has sent us personal information, contact us and it will be deleted.</p>

<h2>Changes to this policy</h2>

<p>When this policy changes, the change will be made on this page. The date below is the last revision.</p>
$body$,
    'active',
    3,
    'What personal data GetScholarship collects, what it does not do, how long data is kept, and how to request access, correction or deletion.'
  ),

  (
    'terms',
    'Terms of Use',
    'The terms that apply to using GetScholarship.',
    $body$
<p>These terms apply to your use of this website. By using it you accept them. If you do not accept them, please do not use the site.</p>

<h2>Informational, not advisory</h2>

<p>Everything published here &mdash; scholarship records, articles and guides &mdash; is general information provided for guidance. It is not professional, legal or financial advice, and it is not a guarantee that any award exists, is open, or will be awarded to you.</p>

<p>Scholarship schemes change their rules, amounts and deadlines. The awarding body is the only authoritative source. Always read its official page and its own terms before applying.</p>

<h2>No guarantee of accuracy or availability</h2>

<p>We verify information as carefully as we can and correct errors when they are reported, but we do not warrant that the site is free of error, complete, or uninterrupted. We may change, suspend or withdraw any part of it at any time.</p>

<h2>Eligibility and decisions</h2>

<p>We do not award scholarships and we cannot influence, predict or guarantee an award decision. Whether you are eligible, and whether you are successful, is decided entirely by the awarding body under its own rules.</p>

<h2>Permitted use</h2>

<p>You may read, print and share the content here for personal, non-commercial use. You may not:</p>

<ul>
  <li>republish substantial parts of the content as your own;</li>
  <li>scrape, bulk-copy or systematically harvest the directory to build or feed another database;</li>
  <li>attempt to gain unauthorised access to the site or to the editorial system behind it;</li>
  <li>use automated systems in a way that degrades the service for others.</li>
</ul>

<p>Quoting a record with attribution and a link back is welcome. Systematic copying is not.</p>

<h2>No fees, ever</h2>

<p>We never ask for payment, bank details, card details or login credentials in connection with any scholarship listed here. Anyone doing so is not acting for us. Report it to us and to the awarding body.</p>

<h2>Limitation of liability</h2>

<p>To the extent permitted by law, we are not liable for decisions you make in reliance on information here, for losses arising from applying to an award, or for any loss arising from the site being unavailable or inaccurate. Nothing in these terms limits liability that cannot lawfully be limited.</p>

<h2>Ending use</h2>

<p>You may stop using the site at any time. We may restrict access where use breaks these terms, including automated scraping.</p>

<h2>Contact</h2>

<p>Questions about these terms can be sent to us through the <a href="/contact">contact page</a>.</p>
$body$,
    'active',
    4,
    'Terms of use for GetScholarship: informational content only, no guarantee of accuracy, permitted use, and no application fees.'
  ),

  (
    'editorial-standards',
    'Editorial Standards',
    'How GetScholarship records, verifies and corrects scholarship information.',
    $body$
<p>These standards describe how information enters this site and how it is corrected. They are published because a directory is only useful if you can trust what it says.</p>

<h2>Structure, not prose</h2>

<p>A scholarship is stored as a record with discrete fields: award amount, education levels, fields of study, eligibility, opening and closing dates, required documents, and the official application URL. This is deliberate. Information in fields can be filtered, compared and verified; information buried in a paragraph cannot.</p>

<h2>Sourcing</h2>

<p>Every record is built from the awarding body's own materials, and the official application link points at the awarding body rather than at an intermediary. Where a figure is not published, the record says "amount not specified" rather than carrying an estimate.</p>

<h2>Accuracy and verification</h2>

<ul>
  <li>Dates and amounts are recorded as stated by the awarding body at the time the record is written.</li>
  <li>Each record carries the date it was last verified, so you can judge how current the information is.</li>
  <li>Records whose details could not be confirmed are not published.</li>
  <li>A scholarship that has closed keeps its page, labelled as closed, with the date it closed. We do not delete closed records, because knowing that a scheme ran and ended is useful to an applicant looking for the next cycle.</li>
</ul>

<h2>Corrections</h2>

<p>Every scholarship page carries a "report incorrect information" link. Reports reach the editorial team with the record identified and a reason code. If a report is upheld the record is corrected and the verification date updated.</p>

<p>You can also <a href="/contact">contact us</a> about anything not covered by the report form.</p>

<h2>Articles and guides</h2>

<p>Editorial articles are written to explain how applications, aid and essays work in general terms. They do not promote a particular award, and they are reviewed before publication. An article that could not be substantiated is not published.</p>

<h2>Conflicts of interest</h2>

<p>We do not accept payment to list, rank or feature a scholarship, and we do not take a commission on awards. If a commercial relationship ever affects what appears on this site, it will be disclosed on the page itself.</p>

<h2>Feedback</h2>

<p>If a record is wrong, incomplete or out of date, please tell us. Accuracy is the only reason this directory is worth reading.</p>
$body$,
    'active',
    5,
    'How GetScholarship records, sources, verifies and corrects scholarship information, and how to report an error.'
  )
on conflict (slug) do update
  set title       = excluded.title,
      excerpt     = excluded.excerpt,
      body        = excluded.body,
      status      = excluded.status,
      sort_order  = excluded.sort_order,
      seo_description = excluded.seo_description,
      updated_at  = now();

notify pgrst, 'reload schema';