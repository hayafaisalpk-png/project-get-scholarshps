-- Store an optional WhatsApp number supplied by a contact visitor.
alter table public.contact_submissions
  add column if not exists whatsapp_no text;

comment on column public.contact_submissions.whatsapp_no is
  'Optional contact-provided WhatsApp number; validated by the contact action.';
