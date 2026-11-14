begin;

create type public.clinic_urgency as enum ('urgent', 'soon', 'flexible');
alter table public.appointments
  alter column slot_id drop not null,
  alter column requested_start drop not null,
  alter column requested_end drop not null,
  add column urgency public.clinic_urgency not null default 'flexible',
  add constraint appointment_schedule_pair check (
    (requested_start is null) = (requested_end is null)
    and (requested_start is not null or (slot_id is null and status in ('pending', 'cancelled', 'denied')))
  );

create index appointments_calendar_idx on public.appointments (requested_start)
  where requested_start is not null;


create function public.request_clinic_appointment(
  requested_urgency public.clinic_urgency, visit_reason public.visit_reason, student_concern text,
  letter_object uuid default null, letter_mime text default null, letter_size integer default null
)
returns table (id uuid, reference_number text)
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := clinic_private.require_role('student');
  appointment public.appointments;
  serial text;
  profile_owner uuid;
begin
  select profiles.user_id into profile_owner
  from public.profiles
  join auth.users on users.id = profiles.user_id
  join clinic_private.school_email_domains on domain = lower(split_part(users.email, '@', 2))
  where profiles.user_id = actor and users.email_confirmed_at is not null
  for update of profiles;
  if not found then
    raise exception 'Verify your school email and complete your profile first';
  end if;
  if (
    select count(*) from public.audit_log
    where actor_id = actor and action = 'request_submitted'
      and occurred_at > clock_timestamp() - interval '1 minute'
  ) >= 5 then
    raise exception 'Too many booking requests. Try again in one minute';
  end if;

  if letter_object is null then
    if visit_reason = 'Medical certificate' or letter_mime is not null or letter_size is not null then
      raise exception 'Attach a referral or excuse letter for this request';
    end if;
  elsif not exists (
    select 1 from storage.objects
    where bucket_id = 'clinic-letters' and name = actor::text || '/' || letter_object::text
      and metadata ->> 'mimetype' = letter_mime and metadata ->> 'size' = letter_size::text
  ) then
    raise exception 'Upload a valid letter before booking';
  end if;

  serial := nextval('clinic_private.appointment_reference')::text;
  insert into public.appointments (reference_number, student_id, urgency, reason, concern)
  values ('CLN-' || to_char(now() at time zone 'Asia/Manila', 'YYYY') || '-' ||
          lpad(serial, greatest(6, length(serial)), '0'), actor, requested_urgency, visit_reason, student_concern)
  returning * into appointment;

  if letter_object is not null then
    insert into public.appointment_attachments (appointment_id, object_id, mime_type, size_bytes)
    values (appointment.id, letter_object, letter_mime, letter_size);
  end if;
  perform clinic_private.log_event('request_submitted', 'appointment', appointment.id,
    appointment.reference_number, null, jsonb_build_object('status', appointment.status, 'urgency', requested_urgency));
  return query select appointment.id, appointment.reference_number;
end;
$$;

create or replace function public.change_clinic_appointment_status(
  appointment_key uuid, new_status public.appointment_status, explanation text default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  actor_role text := public.current_clinic_role();
  appointment public.appointments;
  slot_end timestamptz;
  slot_day date;
  event_action text;
begin
  if actor is null or actor_role not in ('student', 'nurse') or new_status is null then
    raise exception 'Appointment action is unavailable' using errcode = '42501';
  end if;
  select * into appointment from public.appointments
  where id = appointment_key and (actor_role = 'nurse' or student_id = actor)
  for update;
  if not found then
    raise exception 'Appointment action is unavailable' using errcode = '42501';
  end if;

  if new_status = 'cancelled' and appointment.status in ('pending', 'confirmed') then
    event_action := 'appointment_cancelled';
  elsif actor_role = 'nurse' then
    case
      when appointment.status = 'pending' and new_status = 'confirmed' then raise exception 'Choose a calendar date and time to confirm';
      when appointment.status = 'pending' and new_status = 'denied' then event_action := 'appointment_denied';
      when appointment.status = 'confirmed' and new_status = 'checked_in' then event_action := 'appointment_checked_in';
      when appointment.status = 'checked_in' and new_status = 'completed' then event_action := 'appointment_completed';
      when appointment.status = 'confirmed' and new_status = 'no_show' then event_action := 'appointment_no_show';
      else null;
    end case;
  end if;
  if event_action is null then
    raise exception 'This appointment cannot move from % to %', appointment.status, new_status;
  end if;
  if new_status = 'denied' and nullif(btrim(explanation), '') is null then
    raise exception 'Enter a reason for denying this request';
  end if;
  if new_status = 'no_show' then
    slot_end := appointment.requested_end;
    if slot_end > clock_timestamp() then
      raise exception 'Wait until the appointment time ends to record a no-show';
    end if;
  end if;
  if new_status = 'checked_in' then
    slot_day := (appointment.requested_start at time zone 'Asia/Manila')::date;
    if slot_day <> (clock_timestamp() at time zone 'Asia/Manila')::date then
      raise exception 'Check-in is available on the appointment date';
    end if;
  end if;

  if new_status in ('cancelled', 'denied') then
    update public.slots set held_count = held_count - 1 where id = appointment.slot_id;
  end if;
  update public.appointments
  set status = new_status, decision_reason = case when new_status in ('denied', 'cancelled') then explanation end
  where id = appointment_key;

  perform clinic_private.log_event(event_action, 'appointment', appointment_key,
    appointment.reference_number, jsonb_build_object('status', appointment.status),
    jsonb_build_object('status', new_status, 'reason_recorded', explanation is not null));

  if new_status = 'completed' and appointment.reason = 'Medical certificate' then
    insert into public.certificates (appointment_id) values (appointment_key);
    perform clinic_private.log_event('certificate_created', 'certificate', appointment_key,
      appointment.reference_number, null, jsonb_build_object('status', 'awaiting_authorization'));
  end if;
end;
$$;



create or replace function public.list_clinic_certificate_queue()
returns table (appointment_id uuid, reference_number text, full_name text, visit_date date)
language plpgsql security definer set search_path = '' as $$
begin
  perform clinic_private.require_role('physician');
  return query
    select a.id, a.reference_number, p.full_name, (a.requested_start at time zone 'Asia/Manila')::date
    from public.certificates c
    join public.appointments a on a.id = c.appointment_id
    join public.profiles p on p.user_id = a.student_id
    where c.status = 'awaiting_authorization' and a.status = 'completed' and a.reason = 'Medical certificate'
    order by a.requested_start, a.id;
end;
$$;



create function public.schedule_clinic_request(appointment_key uuid, visit_start timestamptz, visit_end timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare
  appointment public.appointments;
begin
  perform clinic_private.require_role('nurse');
  if visit_start is null or visit_end is null or visit_start <= clock_timestamp() or
     visit_end <= visit_start or (visit_start at time zone 'Asia/Manila')::date <>
                                  (visit_end at time zone 'Asia/Manila')::date then
    raise exception 'Choose a future start and end time on the same day';
  end if;

  perform pg_advisory_xact_lock(609117, 1);
  select * into appointment from public.appointments where id = appointment_key for update;
  if not found or appointment.status <> 'pending' then
    raise exception 'Only pending requests can be scheduled';
  end if;
  if exists (
    select 1 from public.appointments a
    where a.id <> appointment_key and a.status in ('confirmed', 'checked_in', 'completed', 'no_show')
      and a.requested_start < visit_end and a.requested_end > visit_start
  ) then
    raise exception 'That time overlaps an existing visit. Choose another time';
  end if;

  if appointment.slot_id is not null then
    update public.slots set held_count = held_count - 1 where id = appointment.slot_id;
  end if;
  update public.appointments set slot_id = null, requested_start = visit_start,
    requested_end = visit_end, status = 'confirmed' where id = appointment_key;
  perform clinic_private.log_event('appointment_confirmed', 'appointment', appointment_key,
    appointment.reference_number, jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', 'confirmed', 'starts_at', visit_start, 'ends_at', visit_end));
end;
$$;

revoke execute on function public.book_clinic_appointment(uuid, public.visit_reason, text, uuid, text, integer) from authenticated;
revoke all on function public.request_clinic_appointment(public.clinic_urgency, public.visit_reason, text, uuid, text, integer),
  public.schedule_clinic_request(uuid, timestamptz, timestamptz) from public, anon, service_role;
grant execute on function public.request_clinic_appointment(public.clinic_urgency, public.visit_reason, text, uuid, text, integer),
  public.schedule_clinic_request(uuid, timestamptz, timestamptz) to authenticated;

commit;