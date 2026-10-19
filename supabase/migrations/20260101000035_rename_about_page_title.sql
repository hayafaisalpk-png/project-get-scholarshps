-- Update the public About page heading without changing its route or content.
update public.content_pages
set title = 'About Us'
where slug = 'about'
  and title = 'About GetScholarship';
