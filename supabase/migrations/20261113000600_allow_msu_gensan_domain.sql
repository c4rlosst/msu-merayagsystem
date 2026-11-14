insert into clinic_private.school_email_domains (domain)
values ('msugensan.edu.ph')
on conflict (domain) do nothing;
