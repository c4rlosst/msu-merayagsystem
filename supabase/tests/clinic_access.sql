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
from public.book_clinic_appointment(
  current_setting('clinic_test.slot')::uuid, 'General check-up', 'Synthetic concern for tests'
);

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
  begin
    perform public.book_clinic_appointment(current_setting('clinic_test.slot')::uuid, 'Dental appointment', 'Test');
    raise exception 'An already full slot accepted another booking';
  exception when raise_exception then
    if sqlerrm <> 'This time is no longer available. Choose another slot' then
      raise;
    end if;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select public.change_clinic_appointment_status(current_setting('clinic_test.appointment')::uuid, 'cancelled');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select * from public.book_clinic_appointment(current_setting('clinic_test.slot')::uuid, 'Dental appointment', 'Test');

rollback;
