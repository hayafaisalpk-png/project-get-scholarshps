-- =============================================================================
-- seed.sql
-- Safe, idempotent development seed data.
--
-- SAFETY RULES observed here:
--   * Contains NO DELETE, TRUNCATE or DROP.
--   * Every insert is idempotent (ON CONFLICT DO NOTHING / DO UPDATE).
--   * Contains NO fabricated scholarship records. Development example
--     scholarships are opt-in via the SEED_FAKE_SCHOLARSHIPS flag and are
--     clearly labelled as fictional sample data.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Roles
-- -----------------------------------------------------------------------------
insert into public.roles (key, name, description, is_system) values
  ('super_admin', 'Super Administrator',
   'Unrestricted access, including role management and system settings.', true),
  ('admin', 'Administrator',
   'Full CMS management. Cannot manage roles.', true),
  ('editor', 'Editor',
   'Manages and publishes articles and scholarships, taxonomy and media.', true),
  ('author', 'Author',
   'Creates and edits own drafts. Cannot publish.', true),
  ('reviewer', 'Reviewer',
   'Reviews and approves or rejects content. Cannot publish or manage users.', true),
  ('student', 'Registered Student',
   'Account management only. No administrative access.', true)
on conflict (key) do update
  set name        = excluded.name,
      description = excluded.description,
      is_system   = excluded.is_system;

-- -----------------------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------------------
insert into public.permissions (key, category, description) values
  ('scholarship.manage',       'scholarship', 'Create and edit scholarship records'),
  ('scholarship.publish',      'scholarship', 'Publish, schedule or expire scholarships'),
  ('scholarship.delete',       'scholarship', 'Permanently delete scholarship records'),
  ('scholarship.verify',       'scholarship', 'Record verification results'),
  ('article.manage',           'article',     'Create and edit any article'),
  ('article.publish',          'article',     'Publish, schedule or archive articles'),
  ('article.delete',           'article',     'Delete articles'),
  ('article.review',           'article',     'Approve or reject submitted articles'),
  ('taxonomy.manage',          'taxonomy',    'Manage categories, tags, levels, fields, locations'),
  ('media.upload',             'media',       'Upload files to storage'),
  ('media.manage',             'media',       'Edit and delete media assets'),
  ('user.manage',              'users',       'View and manage user profiles'),
  ('role.manage',              'users',       'Assign roles to users'),
  ('settings.manage',          'settings',    'Manage site settings'),
  ('navigation.manage',        'settings',    'Manage navigation menus'),
  ('homepage.manage',          'settings',    'Manage homepage sections'),
  ('newsletter.manage',        'newsletter',  'Manage newsletter subscribers'),
  ('contact.manage',           'inbox',       'Manage contact submissions'),
  ('report.manage',            'inbox',       'Review content error reports'),
  ('ads.manage',               'ads',         'Manage ad placements'),
  ('seo.manage',               'seo',         'Manage redirects and SEO overrides'),
  ('audit.view',               'audit',       'View audit logs')
on conflict (key) do update
  set category    = excluded.category,
      description = excluded.description;

-- -----------------------------------------------------------------------------
-- Role -> permission grants
--
-- Author deliberately lacks every *.publish and *.delete permission.
-- Reviewer may review but not publish.
-- Student receives no permissions at all.
-- -----------------------------------------------------------------------------
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.key = 'super_admin'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.key = 'admin'
  and p.key in (
    'scholarship.manage', 'scholarship.publish', 'scholarship.delete', 'scholarship.verify',
    'article.manage', 'article.publish', 'article.delete', 'article.review',
    'taxonomy.manage', 'media.upload', 'media.manage',
    'user.manage', 'role.manage',
    'settings.manage', 'navigation.manage', 'homepage.manage',
    'newsletter.manage', 'contact.manage', 'report.manage',
    'ads.manage', 'seo.manage', 'audit.view'
  )
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.key = 'editor'
  and p.key in (
    'scholarship.manage', 'scholarship.publish', 'scholarship.verify',
    'article.manage', 'article.publish',
    'taxonomy.manage', 'media.upload', 'media.manage',
    'navigation.manage', 'homepage.manage',
    'report.manage', 'seo.manage'
  )
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.key = 'author'
  and p.key in ('article.manage', 'media.upload')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.key = 'reviewer'
  and p.key in ('article.review', 'article.manage', 'scholarship.verify', 'report.manage')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Education levels
-- -----------------------------------------------------------------------------
insert into public.education_levels (slug, name, description, rank, sort_order) values
  ('high-school',        'High School',        'For secondary school students.',                 10, 1),
  ('community-college',  'Community College',  'For two-year college programmes.',              20, 2),
  ('undergraduate',      'Undergraduate',      'For students pursuing a bachelor''s degree.',   30, 3),
  ('postgraduate',       'Postgraduate',       'For students pursuing a master''s degree.',      40, 4),
  ('graduate',           'Graduate',           'For students in graduate-level study.',          50, 5),
  ('doctoral',           'Doctoral',           'For doctoral and PhD candidates.',              60, 6)
on conflict (slug) do update
  set name   = excluded.name,
      rank   = excluded.rank,
      status = 'active';

-- -----------------------------------------------------------------------------
-- Scholarship categories
-- -----------------------------------------------------------------------------
insert into public.categories (slug, name, description, sort_order) values
  ('merit-based',    'Merit-Based',    'Awarded for academic, artistic or extracurricular achievement.', 1),
  ('need-based',     'Need-Based',     'Awarded based on demonstrated financial need.',                    2),
  ('renewable',      'Renewable',      'Can be awarded again for each year of study.',                     3),
  ('international',  'International',  'Open to students from outside the awarding country.',             4),
  ('field-specific', 'Field-Specific', 'Restricted to a particular field of study.',                       5),
  ('community-service','Community Service','Recognises community impact and service.',                    6)
on conflict (slug) do update
  set name        = excluded.name,
      description = excluded.description,
      status      = 'active';

-- -----------------------------------------------------------------------------
-- Academic fields
-- -----------------------------------------------------------------------------
insert into public.academic_fields (slug, name, description, parent_group, sort_order) values
  ('stem',            'Science, Technology, Engineering & Mathematics', 'STEM disciplines.',                'stem',     1),
  ('computer-science','Computer Science',                                'Computing disciplines.',            'stem',     2),
  ('engineering',     'Engineering',                                     'Engineering disciplines.',           'stem',     3),
  ('nursing',         'Nursing',                                         'Nursing and allied health.',         'health',   4),
  ('health',          'Health Sciences',                                 'Medicine and health.',              'health',   5),
  ('business',        'Business',                                        'Business and commerce.',            'business', 6),
  ('education',       'Education',                                       'Teaching and education.',            'arts',     7),
  ('arts',            'Arts and Humanities',                              'Arts, music and humanities.',        'arts',     8),
  ('social-sciences', 'Social Sciences',                                 'Sociology, psychology, politics.',   'arts',     9)
on conflict (slug) do update
  set name         = excluded.name,
      description  = excluded.description,
      parent_group = excluded.parent_group,
      status       = 'active';

-- -----------------------------------------------------------------------------
-- Article categories
-- -----------------------------------------------------------------------------
insert into public.article_categories (slug, name, description, sort_order) values
  ('applications',   'Scholarship Applications', 'How to find, prepare for and submit applications.', 1),
  ('financial-aid',  'Financial Aid',            'Grants, loans and aid strategies.',                  2),
  ('essays',         'Essays and Personal Statements', 'Writing winning essays.',                    3),
  ('college-life',   'College Life',             'Transition, budgeting and student life.',             4),
  ('career',         'Careers and Study Paths',  'Choosing a major and planning a career.',             5)
on conflict (slug) do update
  set name   = excluded.name,
      status = 'active';

-- -----------------------------------------------------------------------------
-- Homepage sections
-- -----------------------------------------------------------------------------
insert into public.homepage_sections (key, heading, subheading, sort_order, config) values
  ('hero',                'Find scholarships that actually fit you',
   'Search thousands of verified scholarships by level, field and location.',
   1,  '{"layout":"search-first"}'),
  ('stats',               NULL, NULL, 2, '{}'),
  ('featured',            'Featured Scholarships',
   'Hand-picked opportunities from our editorial team.', 3, '{"limit":6}'),
  ('deadlines',           'Closing Soon',
   'Applications with the nearest deadlines.', 4, '{"limit":6,"window_days":30}'),
  ('recent',              'Recently Added',
   'The newest opportunities on GetScholarship.', 5, '{"limit":8}'),
  ('by-level',            'Scholarships by Education Level',
   'Find funding for the stage of study you are at.', 6, '{"limit":6}'),
  ('by-field',            'Scholarships by Field of Study',
   'Funding for the subject you want to study.', 7, '{"limit":6}'),
  ('by-location',         'Scholarships by Location',
   'Opportunities available where you live or study.', 8, '{"limit":8}'),
  ('by-category',         'Types of Scholarships',
   'Merit-based, need-based, renewable and more.', 9, '{"limit":6}'),
  ('guides',              'Application Tips and Guides',
   'Practical advice for every stage of the process.', 10, '{"limit":3}'),
  ('articles',            'Latest Guides and Articles',
   'Fresh thinking on funding your education.', 11, '{"limit":3}'),
  ('faq',                 'Frequently Asked Questions',
   'Common questions from students.', 12, '{}'),
  ('newsletter',          'Stay Updated on New Scholarships',
   'A short, occasional email. No spam.', 13, '{}'),
  ('trust',               'How We Verify Scholarships',
   'Our editorial standards explained.', 14, '{}')
on conflict (key) do update
  set heading    = excluded.heading,
      subheading = excluded.subheading,
      sort_order = excluded.sort_order,
      config     = excluded.config,
      is_visible = true;

-- -----------------------------------------------------------------------------
-- Ad placements — all disabled by default. Advertising is not enabled until
-- AdSense approval and the consent implementation are complete.
-- -----------------------------------------------------------------------------
insert into public.ad_placements (key, display_name, description, is_enabled, sort_order) values
  ('homepage_top',      'Homepage — below hero',      'After the hero search block.',        false, 1),
  ('search_results',    'Search results — below fold','After the first page of results.',     false, 2),
  ('detail_inline',     'Scholarship detail — inline','Within long scholarship detail pages.', false, 3),
  ('article_inline',    'Article — inline',           'Within article body content.',         false, 4),
  ('article_sidebar',   'Article — sidebar',          'Desktop article sidebar.',             false, 5)
on conflict (key) do update
  set display_name = excluded.display_name,
      description  = excluded.description,
      sort_order   = excluded.sort_order;

-- -----------------------------------------------------------------------------
-- Site settings
--
-- Secrets are never stored here. This table is CMS configuration only.
-- -----------------------------------------------------------------------------
insert into public.site_settings (key, value, value_type, "group", label, description, is_public)
values
  ('general.site_name',       '"GetScholarship"', 'string', 'general', 'Site name',
   'Displayed in the header, footer and browser tab.', true),
  ('general.tagline',         '"Find scholarships, grants and financial aid"',
                              'string', 'general', 'Tagline', 'Short marketing tagline.', true),
  ('general.description',     '"Search verified scholarships, grants and financial aid opportunities by education level, field of study and location."',
                              'text', 'general', 'Site description', 'Default meta description.', true),
  ('seo.default_title',       '"GetScholarship — Find Scholarships, Grants & Financial Aid"',
                              'string', 'seo', 'Default title', 'Used when a page has no specific title.', true),
  ('seo.default_description', '"Search verified scholarships by education level, field of study, award amount and deadline."',
                              'text', 'seo', 'Default description', 'Fallback meta description.', true),
  ('seo.twitter_handle',      '""', 'string', 'seo', 'Twitter handle', 'Without the @.', true),
  ('social.facebook_url',     '""', 'url', 'social', 'Facebook URL', '', true),
  ('social.instagram_url',    '""', 'url', 'social', 'Instagram URL', '', true),
  ('social.linkedin_url',     '""', 'url', 'social', 'LinkedIn URL', '', true),
  ('social.youtube_url',      '""', 'url', 'social', 'YouTube URL', '', true),
  ('newsletter.enabled',      'false', 'boolean', 'newsletter', 'Enable newsletter',
   'Master switch for the signup form.', false),
  ('newsletter.heading',      '"Stay Updated on New Scholarships"', 'string',
                              'newsletter', 'Heading', '', true),
  ('ads.enabled',             'false', 'boolean', 'ads', 'Enable advertising',
   'Master switch. Also requires AdSense approval and ad consent.', false),
  ('privacy.consent_version', '"1"', 'string', 'privacy', 'Consent version',
   'Bump when the consent presentation changes materially.', true),
  ('privacy.require_consent', 'true', 'boolean', 'privacy', 'Require consent',
   'Block analytics and ad scripts until consent is given.', true),
  ('verification.disclaimer', '"Information is provided for guidance. Always confirm details on the official provider website before applying."',
                              'string', 'verification', 'Verification disclaimer',
   'Shown alongside verified scholarship data.', true),
  ('contact.email',           '"hello@getscholarship.online"', 'string',
                              'contact', 'Contact email', '', true),
  ('publishing.default_author_id', 'null', 'string', 'publishing', 'Default author',
   'Fallback byline for articles.', false),
  ('site.maintenance_mode',   'false', 'boolean', 'general', 'Maintenance mode',
   'Shows a maintenance page to all visitors.', false)
on conflict (key) do update
  set value       = excluded.value,
      value_type  = excluded.value_type,
      "group"     = excluded."group",
      label       = excluded.label,
      description = excluded.description,
      is_public   = excluded.is_public;

-- -----------------------------------------------------------------------------
-- Primary navigation
-- -----------------------------------------------------------------------------
insert into public.navigation_items (label, href, location, sort_order)
values
  ('Find Scholarships', '/scholarships', 'header', 1),
  ('Scholarships by Level', '/scholarships/education-level', 'header', 2),
  ('Scholarships by Field', '/scholarships/field', 'header', 3),
  ('Scholarships by Location', '/scholarships/location', 'header', 4),
  ('Articles', '/articles', 'header', 5),
  ('About', '/about', 'header', 90),
  ('Contact', '/contact', 'header', 91),
  ('Help', '/help', 'header', 92)
on conflict do nothing;

insert into public.navigation_items (label, href, location, sort_order)
values
  ('About Us', '/about', 'footer_column_1', 1),
  ('Contact Us', '/contact', 'footer_column_1', 2),
  ('Help Centre', '/help', 'footer_column_1', 3),
  ('Privacy Policy', '/privacy', 'legal', 1),
  ('Terms of Use', '/terms', 'legal', 2),
  ('Editorial Standards', '/editorial-standards', 'legal', 3)
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Default public author
-- -----------------------------------------------------------------------------
insert into public.authors (slug, full_name, title, bio)
values (
  'getscholarship-editorial-team',
  'GetScholarship Editorial Team',
  'Scholarship and Financial Aid Writers',
  'Our editors research, verify and explain scholarship and financial aid opportunities.'
)
on conflict (slug) do update
  set full_name = excluded.full_name,
      title     = excluded.title,
      bio       = excluded.bio,
      is_active = true;

-- -----------------------------------------------------------------------------
-- OPTIONAL fictional development sample data
--
-- Disabled by default. These records are clearly marked as sample data and
-- MUST NOT be treated as real scholarships. Add sample rows only inside a
-- local development database.
--
-- (Intentionally not a psql \set directive, so this file can be applied by
-- any client: supabase db reset, psql -f, or the Dashboard SQL editor.)
--
