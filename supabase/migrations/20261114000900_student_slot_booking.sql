-- Students can book an open slot again.
--
-- 1) The manual-calendar migration took away students' permission to call book_clinic_appointment.
--    Slot booking is the main way to book again, so give it back. Requests without a time
--    (request_clinic_appointment) keep working as the fallback.
-- 2) A slot booking already has a time. The nurse can confirm it directly; only a request that has no
--    time yet still has to be scheduled from the calendar. A confirmed slot keeps its place (its held
--    count is unchanged), and cancelling or denying still releases it.
--
-- The function below is the one from 20261113000800 with only the pending -> confirmed rule changed.

begin;

grant execute on function public.book_clinic_appointment(uuid, public.visit_reason, text, uuid, text, integer)
  to authenticated;

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
      when appointment.status = 'pending' and new_status = 'confirmed' and appointment.requested_start is null
        then raise exception 'Choose a calendar date and time to confirm';
      when appointment.status = 'pending' and new_status = 'confirmed' and appointment.requested_start <= clock_timestamp()
        then raise exception 'That time has passed. Deny this request and ask the student to book another time';
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

commit;
