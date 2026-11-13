begin;

create function public.edit_clinic_schedule(
  schedule_key uuid, opening time, closing time, slot_length smallint, slot_capacity smallint
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  previous public.schedules;
  updated public.schedules;
begin
  perform clinic_private.require_role('nurse');
  select * into previous from public.schedules
  where id = schedule_key and cancelled_at is null for update;
  if not found then
    raise exception 'Choose an active schedule';
  end if;
  if (previous.clinic_date + least(previous.opens_at, opening)) at time zone 'Asia/Manila' <= clock_timestamp() then
    raise exception 'Only schedules that have not opened can be edited';
  end if;

  update public.schedules
  set opens_at = opening, closes_at = closing, slot_minutes = slot_length, capacity = slot_capacity
  where id = schedule_key returning * into updated;

  perform 1 from public.slots where schedule_id = schedule_key order by starts_at for update;
  if exists (
    select 1 from public.slots s
    where s.schedule_id = schedule_key and s.retired_at is null and s.held_count > 0
      and (s.held_count > slot_capacity
        or s.starts_at < ((updated.clinic_date + opening) at time zone 'Asia/Manila')
        or s.ends_at > ((updated.clinic_date + closing) at time zone 'Asia/Manila')
        or s.ends_at - s.starts_at <> make_interval(mins => slot_length)
        or mod(extract(epoch from s.starts_at - ((updated.clinic_date + opening) at time zone 'Asia/Manila')),
               slot_length * 60) <> 0)
  ) then
    raise exception 'Keep booked times and enough capacity for their existing requests';
  end if;

  update public.slots set retired_at = clock_timestamp()
  where schedule_id = schedule_key and retired_at is null and held_count = 0;

  insert into public.slots (schedule_id, starts_at, ends_at, capacity)
  select schedule_key, start_time at time zone 'Asia/Manila',
         (start_time + make_interval(mins => slot_length)) at time zone 'Asia/Manila', slot_capacity
  from generate_series(
    updated.clinic_date + opening, updated.clinic_date + closing - make_interval(mins => slot_length),
    make_interval(mins => slot_length)
  ) as times(start_time)
  on conflict (schedule_id, starts_at) do update
    set ends_at = excluded.ends_at, capacity = excluded.capacity, retired_at = null;

  perform clinic_private.log_event('schedule_edited', 'schedule', schedule_key, null,
    to_jsonb(previous), to_jsonb(updated));
end;
$$;

create function public.cancel_clinic_schedule(schedule_key uuid, explanation text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  previous public.schedules;
  updated public.schedules;
  request record;
begin
  perform clinic_private.require_role('nurse');
  if nullif(btrim(explanation), '') is null or char_length(explanation) > 1000 then
    raise exception 'Enter a cancellation reason of up to 1,000 characters';
  end if;
  select * into previous from public.schedules
  where id = schedule_key and cancelled_at is null for update;
  if not found or ((previous.clinic_date + previous.opens_at) at time zone 'Asia/Manila') <= clock_timestamp() then
    raise exception 'Choose an active schedule that has not opened';
  end if;

  for request in
    select a.id, a.status
    from public.appointments a join public.slots s on s.id = a.slot_id
    where s.schedule_id = schedule_key and a.status in ('pending', 'confirmed', 'checked_in', 'completed')
    order by a.id for update of a
  loop
    if request.status in ('checked_in', 'completed') then
      raise exception 'This schedule has visits that have already started';
    end if;
    perform public.change_clinic_appointment_status(request.id, 'cancelled', explanation);
  end loop;

  update public.schedules set cancelled_at = clock_timestamp() where id = schedule_key
  returning * into updated;
  perform clinic_private.log_event('schedule_cancelled', 'schedule', schedule_key, null,
    to_jsonb(previous), to_jsonb(updated));
end;
$$;

revoke all on function public.edit_clinic_schedule(uuid, time, time, smallint, smallint),
  public.cancel_clinic_schedule(uuid, text) from public, anon, service_role;
grant execute on function public.edit_clinic_schedule(uuid, time, time, smallint, smallint),
  public.cancel_clinic_schedule(uuid, text) to authenticated;

commit;
