begin;

create function clinic_private.care_appointment(appointment_key uuid, actor_role text)
returns public.appointments language plpgsql security definer set search_path = '' as $$
declare
  appointment public.appointments;
begin
  select * into appointment from public.appointments
  where id = appointment_key
    and (actor_role = 'nurse' or (status = 'completed' and reason = 'Medical certificate'))
  for update;
  if not found then
    raise exception 'Visit is unavailable' using errcode = '42501';
  end if;
  return appointment;
end;
$$;

create function public.read_clinic_visit(appointment_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor_role text := public.current_clinic_role();
  appointment public.appointments;
  clinical jsonb;
begin
  if auth.uid() is null or actor_role not in ('nurse', 'physician') then
    raise exception 'Visit is unavailable' using errcode = '42501';
  end if;
  appointment := clinic_private.care_appointment(appointment_key, actor_role);
  select to_jsonb(v) - 'updated_by' into clinical
  from public.visit_records v where v.appointment_id = appointment_key;
  perform clinic_private.log_event('visit_record_accessed', 'visit_record', appointment_key,
    appointment.reference_number, null, jsonb_build_object('record_exists', clinical is not null));
  return clinical;
end;
$$;

create function public.save_clinic_visit(appointment_key uuid, changes jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := clinic_private.require_role('nurse');
  appointment public.appointments;
  previous jsonb;
  updated jsonb;
  fields text[];
begin
  appointment := clinic_private.care_appointment(appointment_key, 'nurse');
  if appointment.status <> 'checked_in' then
    raise exception 'Check in the student before recording the visit';
  end if;
  if jsonb_typeof(changes) is distinct from 'object' or changes = '{}'::jsonb then
    raise exception 'Provide at least one visit field';
  end if;
  if exists (
    select 1 from jsonb_each(changes) as input(field, value)
    where case
      when field in ('findings', 'assessment', 'notes') then jsonb_typeof(value) not in ('string', 'null')
      when field in ('temperature_c', 'systolic', 'diastolic', 'pulse', 'respiratory_rate', 'spo2', 'height_cm', 'weight_kg')
        then jsonb_typeof(value) not in ('number', 'null')
      else true
    end
  ) then
    raise exception 'Provide supported visit fields with valid values';
  end if;

  select to_jsonb(v) into previous from public.visit_records v where v.appointment_id = appointment_key;
  updated := coalesce(previous, '{}'::jsonb) || changes || jsonb_build_object(
    'appointment_id', appointment_key, 'updated_by', actor, 'updated_at', clock_timestamp()
  );

  insert into public.visit_records
  select v.* from jsonb_populate_record(null::public.visit_records, updated) v
  on conflict (appointment_id) do update set
    temperature_c = excluded.temperature_c, systolic = excluded.systolic, diastolic = excluded.diastolic,
    pulse = excluded.pulse, respiratory_rate = excluded.respiratory_rate, spo2 = excluded.spo2,
    height_cm = excluded.height_cm, weight_kg = excluded.weight_kg, findings = excluded.findings,
    assessment = excluded.assessment, notes = excluded.notes,
    updated_by = excluded.updated_by, updated_at = excluded.updated_at;

  select array_agg(field order by field) into fields from jsonb_object_keys(changes) as input(field)
  where field in ('temperature_c', 'systolic', 'diastolic', 'pulse', 'respiratory_rate', 'spo2', 'height_cm', 'weight_kg');
  if fields is not null then
    perform clinic_private.log_event('vital_signs_saved', 'visit_record', appointment_key,
      appointment.reference_number, jsonb_build_object('updated_at', previous -> 'updated_at'),
      jsonb_build_object('fields', fields, 'updated_at', updated -> 'updated_at'));
  end if;
  select array_agg(field order by field) into fields from jsonb_object_keys(changes) as input(field)
  where field in ('findings', 'assessment', 'notes');
  if fields is not null then
    perform clinic_private.log_event('consultation_saved', 'visit_record', appointment_key,
      appointment.reference_number, jsonb_build_object('updated_at', previous -> 'updated_at'),
      jsonb_build_object('fields', fields, 'updated_at', updated -> 'updated_at'));
  end if;
end;
$$;

create function public.list_clinic_certificate_queue()
returns table (appointment_id uuid, reference_number text, full_name text, visit_date date)
language plpgsql security definer set search_path = '' as $$
begin
  perform clinic_private.require_role('physician');
  return query
    select a.id, a.reference_number, p.full_name, s.clinic_date
    from public.certificates c
    join public.appointments a on a.id = c.appointment_id
    join public.profiles p on p.user_id = a.student_id
    join public.slots sl on sl.id = a.slot_id
    join public.schedules s on s.id = sl.schedule_id
    where c.status = 'awaiting_authorization' and a.status = 'completed' and a.reason = 'Medical certificate'
    order by s.clinic_date, a.id;
end;
$$;

alter table public.certificates add column student_name text;
update public.certificates c
set student_name = p.full_name
from public.appointments a join public.profiles p on p.user_id = a.student_id
where a.id = c.appointment_id and c.authorized_at is not null;
alter table public.certificates add constraint certificates_student_snapshot
  check ((authorized_at is null) = (student_name is null));

create function public.authorize_clinic_certificate(appointment_key uuid, certificate_statement text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := clinic_private.require_role('physician');
  appointment public.appointments;
begin
  appointment := clinic_private.care_appointment(appointment_key, 'physician');
  if nullif(btrim(certificate_statement), '') is null or char_length(certificate_statement) > 8000 then
    raise exception 'Enter a certificate statement of up to 8,000 characters';
  end if;
  update public.certificates c
  set status = 'authorized', statement = certificate_statement, authorized_by = actor,
      authorized_at = clock_timestamp(), student_name = p.full_name
  from public.profiles p
  where c.appointment_id = appointment_key and c.status = 'awaiting_authorization'
    and p.user_id = appointment.student_id;
  if not found then
    raise exception 'Only certificates awaiting authorization can be authorized';
  end if;
  perform clinic_private.log_event('certificate_authorized', 'certificate', appointment_key,
    appointment.reference_number, jsonb_build_object('status', 'awaiting_authorization'),
    jsonb_build_object('status', 'authorized'));
end;
$$;

create function public.release_clinic_certificate(appointment_key uuid, recipient text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := clinic_private.require_role('nurse');
  appointment public.appointments;
  released_time timestamptz;
begin
  appointment := clinic_private.care_appointment(appointment_key, 'nurse');
  if nullif(btrim(recipient), '') is null or char_length(recipient) > 200 then
    raise exception 'Enter the release recipient, up to 200 characters';
  end if;
  update public.certificates set status = 'released', released_by = actor,
    released_at = clock_timestamp(), released_to = btrim(recipient)
  where appointment_id = appointment_key and status = 'authorized'
  returning released_at into released_time;
  if not found then
    raise exception 'Only authorized certificates can be released';
  end if;
  perform clinic_private.log_event('certificate_released', 'certificate', appointment_key,
    appointment.reference_number, jsonb_build_object('status', 'authorized'),
    jsonb_build_object('status', 'released', 'released_at', released_time));
end;
$$;

revoke all on function public.read_clinic_visit(uuid), public.save_clinic_visit(uuid, jsonb),
  public.list_clinic_certificate_queue(), public.authorize_clinic_certificate(uuid, text),
  public.release_clinic_certificate(uuid, text) from public, anon, service_role;
grant execute on function public.read_clinic_visit(uuid), public.save_clinic_visit(uuid, jsonb),
  public.list_clinic_certificate_queue(), public.authorize_clinic_certificate(uuid, text),
  public.release_clinic_certificate(uuid, text) to authenticated;

commit;
