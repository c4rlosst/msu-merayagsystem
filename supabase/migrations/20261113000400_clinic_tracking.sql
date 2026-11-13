begin;

alter table public.appointments add column requested_start timestamptz;
alter table public.appointments add column requested_end timestamptz;
update public.appointments a
set requested_start = s.starts_at, requested_end = s.ends_at
from public.slots s where s.id = a.slot_id;
alter table public.appointments
  alter column requested_start set not null,
  alter column requested_end set not null,
  add constraint appointment_requested_interval check (requested_end > requested_start);

create function clinic_private.snapshot_appointment_time()
returns trigger language plpgsql set search_path = '' as $$
begin
  select s.starts_at, s.ends_at into new.requested_start, new.requested_end
  from public.slots s where s.id = new.slot_id;
  return new;
end;
$$;
create trigger appointment_time_snapshot before insert on public.appointments
  for each row execute function clinic_private.snapshot_appointment_time();

create function public.clinic_appointment_history(appointment_key uuid)
returns table (occurred_at timestamptz, status public.appointment_status)
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := clinic_private.require_role('student');
begin
  if not exists (select 1 from public.appointments where id = appointment_key and student_id = actor) then
    raise exception 'Appointment is unavailable' using errcode = '42501';
  end if;
  return query
    select e.occurred_at, (e.after_summary ->> 'status')::public.appointment_status
    from public.audit_log e
    where e.target_type = 'appointment' and e.target_id = appointment_key
      and e.action in ('request_submitted', 'appointment_confirmed', 'appointment_denied',
        'appointment_cancelled', 'appointment_checked_in', 'appointment_completed', 'appointment_no_show')
    order by e.id;
end;
$$;
create index audit_log_target_idx on public.audit_log (target_type, target_id, id);

create function public.clinic_request_student(appointment_key uuid)
returns table (student_number text, full_name text, course text, year_level smallint, contact_number text, school_email text)
language plpgsql security definer set search_path = '' as $$
begin
  perform clinic_private.require_role('nurse');
  return query
    select p.student_id, p.full_name, p.course, p.year_level, p.contact_number, u.email::text
    from public.appointments a
    join public.profiles p on a.student_id = p.user_id
    join auth.users u on u.id = p.user_id
    where a.id = appointment_key;
end;
$$;

revoke all on function public.clinic_appointment_history(uuid), public.clinic_request_student(uuid)
  from public, anon, service_role;
grant execute on function public.clinic_appointment_history(uuid), public.clinic_request_student(uuid)
  to authenticated;

commit;
