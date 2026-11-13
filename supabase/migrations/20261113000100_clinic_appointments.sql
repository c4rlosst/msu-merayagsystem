begin;

create sequence clinic_private.appointment_reference;

create function clinic_private.require_role(expected text)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  actual text;
begin
  select role::text into actual from public.staff_roles where user_id = actor;
  if actor is null or coalesce(actual, 'student') <> expected then
    raise exception 'This action requires the % role', expected using errcode = '42501';
  end if;
  return actor;
end;
$$;

create function clinic_private.log_event(
  event_action text, target_kind text, target uuid, reference text,
  previous jsonb, current jsonb
)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_log (
    actor_id, actor_role, action, target_type, target_id, reference_number, before_summary, after_summary
  ) values (
    auth.uid(),
    coalesce((select role::text from public.staff_roles where user_id = auth.uid()), 'student'),
    event_action, target_kind, target, reference, previous, current
  );
$$;

create function public.publish_clinic_schedule(
  clinic_day date, opening time, closing time, slot_length smallint, slot_capacity smallint
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := clinic_private.require_role('nurse');
  schedule public.schedules;
begin
  if (clinic_day + opening) at time zone 'Asia/Manila' <= now() then
    raise exception 'Choose a future opening time';
  end if;
  insert into public.schedules (clinic_date, opens_at, closes_at, slot_minutes, capacity, created_by)
  values (clinic_day, opening, closing, slot_length, slot_capacity, actor)
  returning * into schedule;

  insert into public.slots (schedule_id, starts_at, ends_at, capacity)
  select schedule.id, slot_start at time zone 'Asia/Manila',
         (slot_start + make_interval(mins => slot_length)) at time zone 'Asia/Manila', slot_capacity
  from generate_series(
    clinic_day + opening, clinic_day + closing - make_interval(mins => slot_length),
    make_interval(mins => slot_length)
  ) as slots(slot_start);

  perform clinic_private.log_event('schedule_created', 'schedule', schedule.id, null, null, to_jsonb(schedule));
  return schedule.id;
end;
$$;

create function public.book_clinic_appointment(
  selected_slot uuid, visit_reason public.visit_reason, student_concern text,
  letter_object uuid default null, letter_mime text default null, letter_size integer default null
)
returns table (id uuid, reference_number text)
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := clinic_private.require_role('student');
  appointment public.appointments;
  serial text;
  selected_schedule uuid;
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

  select schedule_id into selected_schedule from public.slots where slots.id = selected_slot;
  perform 1 from public.schedules
  where schedules.id = selected_schedule and cancelled_at is null and published_at <= now()
  for share;
  if not found then
    raise exception 'Choose a published clinic slot';
  end if;

  update public.slots set held_count = held_count + 1
  where slots.id = selected_slot and retired_at is null
    and starts_at > clock_timestamp() and held_count < capacity;
  if not found then
    raise exception 'This time is no longer available. Choose another slot';
  end if;

  serial := nextval('clinic_private.appointment_reference')::text;
  insert into public.appointments (reference_number, student_id, slot_id, reason, concern)
  values ('CLN-' || to_char(now() at time zone 'Asia/Manila', 'YYYY') || '-' ||
          lpad(serial, greatest(6, length(serial)), '0'), actor, selected_slot, visit_reason, student_concern)
  returning * into appointment;

  if letter_object is not null then
    insert into public.appointment_attachments (appointment_id, object_id, mime_type, size_bytes)
    values (appointment.id, letter_object, letter_mime, letter_size);
  end if;
  perform clinic_private.log_event('request_submitted', 'appointment', appointment.id,
    appointment.reference_number, null, jsonb_build_object('status', appointment.status, 'slot_id', selected_slot));
  return query select appointment.id, appointment.reference_number;
end;
$$;

create function public.change_clinic_appointment_status(
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
      when appointment.status = 'pending' and new_status = 'confirmed' then event_action := 'appointment_confirmed';
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
    select ends_at into slot_end from public.slots where id = appointment.slot_id;
    if slot_end > clock_timestamp() then
      raise exception 'Wait until the appointment time ends to record a no-show';
    end if;
  end if;
  if new_status = 'checked_in' then
    select (starts_at at time zone 'Asia/Manila')::date into slot_day
    from public.slots where id = appointment.slot_id;
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

revoke all on function public.publish_clinic_schedule(date, time, time, smallint, smallint),
  public.book_clinic_appointment(uuid, public.visit_reason, text, uuid, text, integer),
  public.change_clinic_appointment_status(uuid, public.appointment_status, text)
  from public, anon, service_role;
grant execute on function public.publish_clinic_schedule(date, time, time, smallint, smallint),
  public.book_clinic_appointment(uuid, public.visit_reason, text, uuid, text, integer),
  public.change_clinic_appointment_status(uuid, public.appointment_status, text) to authenticated;

commit;
