-- Track whether an authorized editor has opened a contact message.
alter table public.contact_submissions
  add column if not exists read_at timestamptz;

create index if not exists contact_unread_idx
  on public.contact_submissions (read_at)
  where read_at is null;

comment on column public.contact_submissions.read_at is
  'Timestamp when an authorized editor first opened the message.';
