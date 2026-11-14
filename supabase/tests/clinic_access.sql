-- Run against a disposable Supabase database after applying the migrations.
begin;

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-000000000001', 'first@clinic.test', now()),
  ('00000000-0000-4000-8000-000000000002', 'second@clinic.test', now()),
  ('00000000-0000-4000-8000-000000000003', 'nurse@clinic.test', now());
insert into clinic_private.school_email_domains (domain) values ('clinic.test');
insert into public.staff_roles (user_id, role) values ('00000000-0000-4000-8000-000000000003', 'nurse');
insert into public.profiles (user_id, student_id, full_name, course, year_level, contact_number) values
  ('00000000-0000-4000-8000-000000000001', 'test-student-one', 'First Student', 'Nursing', 1, '09000000001'),
  ('00000000-0000-4000-8000-000000000002', 'test-student-two', 'Second Student', 'Nursing', 1, '09000000002');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select public.publish_clinic_schedule(
  (now() at time zone 'Asia/Manila')::date + 30, time '08:00', time '08:30', 30::smallint, 1::smallint
);
select set_config('clinic_test.slot', (
  select id::text from public.slots
  where starts_at = (((now() at time zone 'Asia/Manila')::date + 30) + time '08:00') at time zone 'Asia/Manila'
), true);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('clinic_test.appointment', id::text, true)
from public.request_clinic_appointment(
  'urgent', 'General check-up', 'Synthetic concern for tests'
);

select set_config('clinic_test.second', id::text, true)
from public.request_clinic_appointment('flexible', 'Dental appointment', 'Test');

do $$
begin
  begin
    perform public.change_clinic_appointment_status(current_setting('clinic_test.appointment')::uuid, 'confirmed');
    raise exception 'Student confirmed an appointment';
  exception when raise_exception then
    if sqlerrm <> 'This appointment cannot move from pending to confirmed' then
      raise;
    end if;
  end;
end;
$$;

reset role;
insert into public.appointment_attachments (appointment_id, object_id, mime_type, size_bytes)
values (current_setting('clinic_test.appointment')::uuid, '00000000-0000-4000-8000-000000000010', 'application/pdf', 100);
insert into storage.objects (bucket_id, name)
values ('clinic-letters', '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000010');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
do $$
begin
  if not exists (select 1 from public.appointments where id = current_setting('clinic_test.appointment')::uuid)
     or not exists (select 1 from public.appointment_attachments where appointment_id = current_setting('clinic_test.appointment')::uuid) then
    raise exception 'Student cannot read their own appointment and attachment metadata';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
do $$
begin
  if exists (select 1 from public.appointments where id = current_setting('clinic_test.appointment')::uuid)
     or exists (select 1 from public.appointment_attachments where appointment_id = current_setting('clinic_test.appointment')::uuid)
     or exists (select 1 from storage.objects where bucket_id = 'clinic-letters')
     or exists (select 1 from public.profiles where student_id = 'test-student-one') then
    raise exception 'Student can read another student''s records';
  end if;
end;
$$;



do $$
begin
  begin
    perform public.clinic_appointment_history(current_setting('clinic_test.appointment')::uuid);
    raise exception 'Student can read another student''s appointment history';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.read_clinic_visit(current_setting('clinic_test.appointment')::uuid);
    raise exception 'Student can read clinical records';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
do $$
declare
  start_time timestamptz := (select starts_at from public.slots where id = current_setting('clinic_test.slot')::uuid);
  end_time timestamptz := start_time + interval '30 minutes';
begin
  perform public.schedule_clinic_request(current_setting('clinic_test.appointment')::uuid, start_time, end_time);
  if not exists (
    select 1 from public.appointments
    where id = current_setting('clinic_test.appointment')::uuid
      and status = 'confirmed' and requested_start = start_time and urgency = 'urgent'
  ) then
    raise exception 'The nurse could not confirm the requested appointment';
  end if;
  begin
    perform public.schedule_clinic_request(current_setting('clinic_test.second')::uuid, start_time, end_time);
    raise exception 'An overlapping appointment was confirmed';
  exception when raise_exception then
    if sqlerrm <> 'That time overlaps an existing visit. Choose another time' then raise; end if;
  end;
  perform public.change_clinic_appointment_status(current_setting('clinic_test.appointment')::uuid, 'cancelled');
  perform public.schedule_clinic_request(current_setting('clinic_test.second')::uuid, start_time, end_time);
end;
$$;

reset role;
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-4000-8000-000000000004', 'physician@clinic.test', now());
insert into public.staff_roles (user_id, role)
values ('00000000-0000-4000-8000-000000000004', 'physician');
insert into public.appointments (id, reference_number, student_id, slot_id, reason, concern, status)
values ('00000000-0000-4000-8000-000000000011', 'TEST-CERTIFICATE',
  '00000000-0000-4000-8000-000000000001', current_setting('clinic_test.slot')::uuid,
  'Medical certificate', 'Synthetic certificate visit', 'checked_in');

set local role authenticated;
select public.save_clinic_visit('00000000-0000-4000-8000-000000000011', '{"pulse":72,"notes":"Synthetic notes"}');
select public.change_clinic_appointment_status('00000000-0000-4000-8000-000000000011', 'completed');
do $$
begin
  begin
    perform public.release_clinic_certificate('00000000-0000-4000-8000-000000000011', 'First Student');
    raise exception 'Nurse released an unauthorized certificate';
  exception when raise_exception then
    if sqlerrm <> 'Only authorized certificates can be released' then raise; end if;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select public.read_clinic_visit('00000000-0000-4000-8000-000000000011');
select public.authorize_clinic_certificate('00000000-0000-4000-8000-000000000011', 'Synthetic certificate statement');



do $$
begin
  if exists (select 1 from public.certificates where appointment_id = '00000000-0000-4000-8000-000000000011') then
    raise exception 'Student read an authorized but unreleased certificate';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select public.release_clinic_certificate('00000000-0000-4000-8000-000000000011', 'First Student');
do $$
begin
  if not exists (
    select 1 from public.audit_log where reference_number = 'TEST-CERTIFICATE'
      and action = 'visit_record_accessed' and actor_role = 'physician'
  ) then
    raise exception 'Physician record access was not audited';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
do $$
begin
  if not exists (
    select 1 from public.certificates where appointment_id = '00000000-0000-4000-8000-000000000011'
      and status = 'released' and student_name = 'First Student'
  ) then
    raise exception 'Student cannot read their released certificate';
  end if;
end;
$$;

rollback;
