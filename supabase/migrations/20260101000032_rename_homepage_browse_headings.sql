-- Keep the homepage browse headings concise while preserving their
-- database-driven/editorial configuration.
update public.homepage_sections
set heading = case key
  when 'by-level' then 'By Education Level'
  when 'by-field' then 'By Field of Study'
  when 'by-category' then 'Types'
  when 'by-location' then 'By Location'
  else heading
end
where key in ('by-level', 'by-field', 'by-category', 'by-location');
