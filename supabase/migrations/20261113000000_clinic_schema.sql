begin;

create schema clinic_private;
revoke all on schema clinic_private from public, anon, authenticated;
create extension if not exists btree_gist with schema extensions;
set local search_path = public, extensions;

create type public.clinic_staff_role as enum ('nurse', 'physician', 'admin');
create type public.appointment_status as enum (
  'pending', 'confirmed', 'denied', 'cancelled', 'checked_in', 'completed', 'no_show'
);
create type public.visit_reason as enum (
  'Vital signs check', 'Medical consultation', 'General check-up', 'Dental appointment', 'Medical certificate'
);
create type public.certificate_status as enum ('awaiting_authorization', 'authorized', 'released');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  student_id text not null unique check (char_length(btrim(student_id)) between 1 and 50),
  full_name text not null check (char_length(btrim(full_name)) between 1 and 200),
  course text not null check (char_length(btrim(course)) between 1 and 120),
  year_level smallint not null check (year_level > 0),
  contact_number text not null check (char_length(btrim(contact_number)) between 1 and 40)
);

create table public.staff_roles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  role public.clinic_staff_role not null
);

create table clinic_private.sessions (
  token_hash bytea primary key check (octet_length(token_hash) = 32),
  user_id uuid not null references auth.users(id) on delete cascade,
  encrypted_credentials bytea not null,
  expires_at timestamptz not null
);
create index sessions_expiry_idx on clinic_private.sessions (expires_at);

create table clinic_private.school_email_domains (
  domain text primary key check (domain = lower(domain) and domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$')
);

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  clinic_date date not null,
  opens_at time not null,
  closes_at time not null,
  slot_minutes smallint not null check (slot_minutes > 0),
  capacity smallint not null check (capacity > 0),
  published_at timestamptz not null default now(),
  cancelled_at timestamptz,
  created_by uuid not null references public.staff_roles(user_id),
  check (closes_at > opens_at),
  check (extract(second from opens_at) = 0 and extract(second from closes_at) = 0),
  check (mod(extract(epoch from closes_at - opens_at), slot_minutes * 60) = 0),
  exclude using gist (
    tsrange(clinic_date + opens_at, clinic_date + closes_at, '[)') with &&
  ) where (cancelled_at is null)
);
create index schedules_date_idx on public.schedules (clinic_date);

create table public.slots (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  capacity smallint not null check (capacity > 0),
  held_count smallint not null default 0 check (held_count between 0 and capacity),
  retired_at timestamptz,
  unique (schedule_id, starts_at)
);
create index slots_start_idx on public.slots (starts_at);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  reference_number text not null unique,
  student_id uuid not null references public.profiles(user_id),
  slot_id uuid not null references public.slots(id),
  reason public.visit_reason not null,
  concern text not null check (char_length(btrim(concern)) between 1 and 4000),
  status public.appointment_status not null default 'pending',
  decision_reason text check (char_length(btrim(decision_reason)) between 1 and 1000),
  created_at timestamptz not null default now(),
  check (status <> 'denied' or decision_reason is not null)
);
create index appointments_student_idx on public.appointments (student_id, created_at desc);
create index appointments_status_idx on public.appointments (status, created_at);
create index appointments_slot_idx on public.appointments (slot_id);

create table public.appointment_attachments (
  appointment_id uuid primary key references public.appointments(id),
  object_id uuid not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'application/pdf')),
  size_bytes integer not null check (size_bytes between 1 and 5242880)
);

create table public.visit_records (
  appointment_id uuid primary key references public.appointments(id),
  temperature_c numeric(4,1) check (temperature_c > 0),
  systolic smallint check (systolic > 0),
  diastolic smallint check (diastolic > 0 and diastolic < systolic),
  pulse smallint check (pulse > 0),
  respiratory_rate smallint check (respiratory_rate > 0),
  spo2 smallint check (spo2 between 0 and 100),
  height_cm numeric(5,2) check (height_cm > 0),
  weight_kg numeric(5,2) check (weight_kg > 0),
  findings text check (char_length(findings) <= 8000),
  assessment text check (char_length(assessment) <= 8000),
  notes text check (char_length(notes) <= 8000),
  updated_by uuid not null references public.staff_roles(user_id),
  updated_at timestamptz not null default now(),
  check ((systolic is null) = (diastolic is null))
);

create table public.certificates (
  appointment_id uuid primary key references public.appointments(id),
  status public.certificate_status not null default 'awaiting_authorization',
  statement text check (char_length(btrim(statement)) between 1 and 8000),
  authorized_by uuid references public.staff_roles(user_id),
  authorized_at timestamptz,
  released_by uuid references public.staff_roles(user_id),
  released_at timestamptz,
  released_to text check (char_length(btrim(released_to)) between 1 and 200),
  check ((authorized_at is not null) = (status <> 'awaiting_authorization')),
  check ((authorized_at is null) = (authorized_by is null)),
  check ((authorized_at is null) = (statement is null)),
  check ((released_at is not null) = (status = 'released')),
  check ((released_at is null) = (released_by is null)),
  check ((released_at is null) = (released_to is null)),
  check (released_at >= authorized_at)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id),
  actor_role text not null check (actor_role in ('student', 'nurse', 'physician', 'admin')),
  action text not null,
  target_type text not null,
  target_id uuid not null,
  reference_number text,
  occurred_at timestamptz not null default clock_timestamp(),
  before_summary jsonb,
  after_summary jsonb
);
create index audit_log_time_idx on public.audit_log (occurred_at desc);
create index audit_log_actor_idx on public.audit_log (actor_id, occurred_at desc);
create index audit_log_action_idx on public.audit_log (action, occurred_at desc);
create index audit_log_reference_idx on public.audit_log (reference_number, occurred_at);

alter table clinic_private.sessions enable row level security;
alter table clinic_private.school_email_domains enable row level security;
create policy sessions_block_client_access on clinic_private.sessions as restrictive
  for all to anon, authenticated using (false) with check (false);
create policy school_domains_block_client_access on clinic_private.school_email_domains as restrictive
  for all to anon, authenticated using (false) with check (false);
alter table public.profiles enable row level security;
alter table public.staff_roles enable row level security;
alter table public.schedules enable row level security;
alter table public.slots enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_attachments enable row level security;
alter table public.visit_records enable row level security;
alter table public.certificates enable row level security;
alter table public.audit_log enable row level security;

revoke all on public.profiles, public.staff_roles, public.schedules, public.slots,
  public.appointments, public.appointment_attachments, public.visit_records,
  public.certificates, public.audit_log from public, anon, authenticated, service_role;

create policy staff_roles_self_read on public.staff_roles for select to authenticated
  using (user_id = (select auth.uid()));

create function public.current_clinic_role()
returns text language sql stable security invoker set search_path = '' as $$
  select coalesce((
    select role::text from public.staff_roles where user_id = (select auth.uid())
  ), 'student');
$$;
revoke all on function public.current_clinic_role() from public, anon;
grant execute on function public.current_clinic_role() to authenticated;

grant select on public.profiles, public.staff_roles, public.schedules, public.slots,
  public.appointments, public.appointment_attachments, public.certificates,
  public.audit_log to authenticated;

create policy profiles_self_read on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) and (select public.current_clinic_role()) = 'student');
grant insert, update on public.profiles to authenticated;
create policy profiles_self_insert on public.profiles for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.current_clinic_role()) = 'student');
create policy profiles_self_update on public.profiles for update to authenticated
  using (user_id = (select auth.uid()) and (select public.current_clinic_role()) = 'student')
  with check (user_id = (select auth.uid()) and (select public.current_clinic_role()) = 'student');

create policy schedules_read on public.schedules for select to authenticated using (
  (select public.current_clinic_role()) = 'nurse'
  or ((select public.current_clinic_role()) = 'student' and cancelled_at is null
      and published_at <= now() and clinic_date >= (now() at time zone 'Asia/Manila')::date)
);
create policy slots_read on public.slots for select to authenticated using (
  (select public.current_clinic_role()) = 'nurse'
  or ((select public.current_clinic_role()) = 'student' and retired_at is null and starts_at > now()
      and exists (select 1 from public.schedules where id = schedule_id and cancelled_at is null))
);
create policy appointments_read on public.appointments for select to authenticated using (
  (select public.current_clinic_role()) = 'nurse'
  or ((select public.current_clinic_role()) = 'student' and student_id = (select auth.uid()))
);
create policy attachments_read on public.appointment_attachments for select to authenticated using (
  exists (select 1 from public.appointments where id = appointment_id)
);
create policy visit_records_require_audited_read on public.visit_records as restrictive
  for all to anon, authenticated using (false) with check (false);
create policy certificates_read on public.certificates for select to authenticated using (
  (select public.current_clinic_role()) = 'nurse'
  or ((select public.current_clinic_role()) = 'student' and status = 'released'
      and exists (select 1 from public.appointments where id = appointment_id and student_id = (select auth.uid())))
);
create policy audit_staff_read on public.audit_log for select to authenticated
  using ((select public.current_clinic_role()) in ('nurse', 'admin'));

create function clinic_private.reject_audit_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Audit events are append-only';
end;
$$;
create trigger audit_log_append_only before update or delete or truncate on public.audit_log
  for each statement execute function clinic_private.reject_audit_mutation();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('clinic-letters', 'clinic-letters', false, 5242880, array['image/jpeg', 'image/png', 'application/pdf']);

create policy clinic_letters_server_only on storage.objects as restrictive
  for all to anon, authenticated
  using (bucket_id <> 'clinic-letters') with check (bucket_id <> 'clinic-letters');

commit;
