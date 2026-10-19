-- Rename only the header navigation label; the destination remains /help.
update public.navigation_items
set label = 'How To Search'
where location = 'header'
  and href = '/help'
  and label = 'Help';
